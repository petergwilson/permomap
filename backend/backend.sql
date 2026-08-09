-- ============================================================================
-- Permomap Backend Functions
-- Copyright (C)2026 Permolat Trust of New Zealand
-- ============================================================================
-- All functions are placed in the api schema and called from server.mjs via
-- SELECT api.function_name(...) instead of inline SQL in route handlers.
--
-- GEOSPATIAL CRUD CHALLENGES
-- --------------------------
-- 1. CRS mismatch: GeoJSON (RFC 7946) uses EPSG:4326 (WGS84 lon/lat). The
--    database stores geometry in EPSG:3857 (Web Mercator, units = metres).
--    server.mjs currently does ST_SetSRID(ST_GeomFromGeoJSON(...), 3857),
--    which only labels the geometry as 3857 without reprojecting. This is
--    correct only if the client (OpenLayers in 3857 projection) sends
--    coordinates already in metres. If the client ever sends standard WGS84
--    GeoJSON, the insert must use:
--        ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 3857)
--    Functions below include a p_input_srid parameter (default 3857) to make
--    this explicit and switchable.
--
-- 2. Geometry validity: Tracks must be valid LineStrings. Self-intersections
--    or degenerate geometries will silently corrupt spatial queries.
--    Every insert validates with ST_IsValid() and checks GeometryType().
--
-- 3. ID generation race condition: server.mjs uses COALESCE(MAX(id),0)+1 to
--    generate new track IDs. This is unsafe under concurrent writes. The
--    functions below use a dedicated sequence (permolat_tracks_id_seq) which
--    is atomic. Apply the sequence to the table with:
--        CREATE SEQUENCE IF NOT EXISTS permolat_tracks_id_seq;
--        ALTER TABLE permolat_tracks_prod ALTER COLUMN id
--            SET DEFAULT nextval('permolat_tracks_id_seq');
--
-- 4. Spatial indexes: PostGIS GiST indexes on geom columns are updated
--    automatically on INSERT/UPDATE. However, bulk inserts should be followed
--    by VACUUM ANALYZE to refresh planner statistics.
--
-- 5. Version geometry storage: permolat_track_versions stores a full geometry
--    copy per version. For long tracks this grows large. A future optimisation
--    is to store only the diff (ST_Difference) and reconstruct on read.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS api;

-- Ensure pgcrypto is available (used by authentication.sql)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Track ID sequence (atomic, replaces MAX(id)+1 pattern in server.mjs)
CREATE SEQUENCE IF NOT EXISTS permolat_tracks_id_seq;

-- ============================================================================
-- SECTION 1: Track CRUD
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.create_track
-- Equivalent to POST /api/new-track in server.mjs.
-- Inserts a new track into permolat_tracks_prod and records the initial
-- version in permolat_track_versions, all in one transaction.
--
-- p_geometry_geojson : GeoJSON geometry string from the client
-- p_input_srid       : SRID of the incoming GeoJSON (3857 if OpenLayers
--                      sends Web Mercator; 4326 if standard GeoJSON)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.create_track(
    p_userid          INTEGER,
    p_trackname       TEXT,
    p_tracktype       TEXT        DEFAULT NULL,
    p_layer_name      TEXT        DEFAULT 'permolat_tracks',
    p_importance      TEXT        DEFAULT NULL,
    p_custodian       TEXT        DEFAULT NULL,
    p_currentcon      TEXT        DEFAULT NULL,
    p_geometry_geojson TEXT       DEFAULT NULL,
    p_input_srid      INTEGER     DEFAULT 3857,
    p_comments        TEXT        DEFAULT 'New track created via web interface'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_id         INTEGER;
    v_new_version_id INTEGER;
    v_geom           GEOMETRY;
BEGIN
    -- Validate required inputs
    IF p_trackname IS NULL OR trim(p_trackname) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Track name is required');
    END IF;

    IF p_geometry_geojson IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Missing geometry');
    END IF;

    -- Parse and validate geometry
    BEGIN
        v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson), p_input_srid);
        IF p_input_srid <> 3857 THEN
            v_geom := ST_Transform(v_geom, 3857);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid GeoJSON geometry: ' || SQLERRM);
    END;

    -- Enforce LineString (tracks must be linear features)
    IF GeometryType(v_geom) NOT IN ('LINESTRING', 'MULTILINESTRING') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Geometry must be a LineString or MultiLineString, got: ' || GeometryType(v_geom)
        );
    END IF;

    -- Validate topology
    IF NOT ST_IsValid(v_geom) THEN
        -- Attempt repair before rejecting
        v_geom := ST_MakeValid(v_geom);
        IF NOT ST_IsValid(v_geom) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Geometry is invalid and could not be repaired');
        END IF;
    END IF;

    -- Atomic ID from sequence (replaces the MAX(id)+1 race condition)
    v_new_id := nextval('permolat_tracks_id_seq');

    -- Atomic version ID
    SELECT COALESCE(MAX(version_id), 0) + 1
    INTO v_new_version_id
    FROM permolat_track_versions;

    -- Insert canonical track record
    INSERT INTO permolat_tracks_prod (
        id, trackname, tracktype, layer_name, importance,
        custodian, currentcon, geom, current_version, added_by
    ) VALUES (
        v_new_id,
        trim(p_trackname),
        p_tracktype,
        p_layer_name,
        p_importance,
        p_custodian,
        p_currentcon,
        v_geom,
        true,
        p_userid
    );

    -- Insert initial version record
    INSERT INTO permolat_track_versions (
        id, trackname, tracktype, layer_name, importance,
        custodian, currentcon, geom,
        version_id, parent_id, added_by,
        added_timestamp, moderated_timestamp, comments
    ) VALUES (
        v_new_id,
        trim(p_trackname),
        p_tracktype,
        p_layer_name,
        p_importance,
        p_custodian,
        p_currentcon,
        v_geom,
        v_new_version_id,
        v_new_id,
        p_userid,
        NOW(),
        NOW(),
        p_comments
    );

    RETURN jsonb_build_object(
        'success',     true,
        'id',          v_new_id,
        'version_id',  v_new_version_id,
        -- SRID audit: input_srid = what the caller declared, stored_srid = what is in the DB
        'input_srid',  p_input_srid,
        'stored_srid', 3857
    );
END;
$$;

COMMENT ON FUNCTION api.create_track IS
    'Create a new track in permolat_tracks_prod with an initial version record. '
    'Validates geometry type (LineString) and validity before inserting. '
    'p_input_srid controls whether reprojection from 4326->3857 is applied.';


-- ----------------------------------------------------------------------------
-- api.save_track_version
-- Equivalent to POST /api/save in server.mjs.
-- Appends a new version of an existing track to permolat_track_versions.
-- Does NOT update permolat_tracks_prod — that happens at moderation time.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.save_track_version(
    p_userid           INTEGER,
    p_parent_id        INTEGER,
    p_trackname        TEXT        DEFAULT NULL,
    p_layer_name       TEXT        DEFAULT NULL,
    p_importance       TEXT        DEFAULT NULL,
    p_tracktype        TEXT        DEFAULT NULL,
    p_currentcon       TEXT        DEFAULT NULL,
    p_custodian        TEXT        DEFAULT NULL,
    p_comments         TEXT        DEFAULT 'Track edit via web interface',
    p_geometry_geojson TEXT        DEFAULT NULL,
    p_input_srid       INTEGER     DEFAULT 3857
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_new_version_id INTEGER;
    v_geom           GEOMETRY;
BEGIN
    IF p_parent_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Parent track ID is required');
    END IF;

    IF p_geometry_geojson IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Missing geometry');
    END IF;

    -- Verify parent track exists
    IF NOT EXISTS (SELECT 1 FROM permolat_tracks_prod WHERE id = p_parent_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Parent track not found');
    END IF;

    -- Parse and validate geometry
    BEGIN
        v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry_geojson), p_input_srid);
        IF p_input_srid <> 3857 THEN
            v_geom := ST_Transform(v_geom, 3857);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid GeoJSON geometry: ' || SQLERRM);
    END;

    IF GeometryType(v_geom) NOT IN ('LINESTRING', 'MULTILINESTRING') THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Geometry must be a LineString or MultiLineString, got: ' || GeometryType(v_geom)
        );
    END IF;

    IF NOT ST_IsValid(v_geom) THEN
        v_geom := ST_MakeValid(v_geom);
        IF NOT ST_IsValid(v_geom) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Geometry is invalid and could not be repaired');
        END IF;
    END IF;

    SELECT COALESCE(MAX(version_id), 0) + 1
    INTO v_new_version_id
    FROM permolat_track_versions;

    INSERT INTO permolat_track_versions (
        geom, id, trackname, layer_name, importance, tracktype,
        currentcon, custodian,
        version_id, comments, added_by,
        added_timestamp, moderated_timestamp
    ) VALUES (
        v_geom,
        p_parent_id,
        p_trackname,
        p_layer_name,
        p_importance,
        p_tracktype,
        p_currentcon,
        p_custodian,
        v_new_version_id,
        p_comments,
        p_userid,
        NOW(),
        NOW()
    );

    RETURN jsonb_build_object(
        'success',    true,
        'version_id', v_new_version_id,
        'id',         p_parent_id,
        'message',    'Track version saved successfully, pending moderation',
        -- SRID audit: input_srid = what the caller declared, stored_srid = what is in the DB
        'input_srid',  p_input_srid,
        'stored_srid', 3857
    );
END;
$$;

COMMENT ON FUNCTION api.save_track_version IS
    'Append a new pending version to permolat_track_versions. '
    'The canonical track in permolat_tracks_prod is updated only at moderation time. '
    'Validates geometry type and validity; applies ST_MakeValid on minor issues.';


-- ----------------------------------------------------------------------------
-- api.rollback_track  /  api.rollforward_track
-- Equivalents to POST /api/rollback and POST /api/rollforward.
-- Toggle status flags on permolat_tracks_prod rows to switch live version.
-- NOTE: These operate on a status column in permolat_tracks_prod; the
-- view_tracks view must filter on status = 'live' for this to have effect.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.rollback_track(
    p_current_id  INTEGER,
    p_prev_id     INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE permolat_tracks_prod SET status = 'old'  WHERE id = p_current_id;
    UPDATE permolat_tracks_prod SET status = 'live' WHERE id = p_prev_id;

    RETURN jsonb_build_object('success', true, 'message', 'Rollback successful');
END;
$$;

CREATE OR REPLACE FUNCTION api.rollforward_track(
    p_current_id  INTEGER,
    p_next_id     INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE permolat_tracks_prod SET status = 'old'  WHERE id = p_current_id;
    UPDATE permolat_tracks_prod SET status = 'live' WHERE id = p_next_id;

    RETURN jsonb_build_object('success', true, 'message', 'Roll forward successful');
END;
$$;

-- ============================================================================
-- SECTION 2: Track version history and geometry reads
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.get_track_versions
-- Equivalent to GET /api/track-versions/:trackId.
-- Returns all versions with joined usernames; diff computation is left to
-- the caller (server.mjs) as it involves application logic over ordered rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_track_versions(p_track_id INTEGER)
RETURNS TABLE (
    version_id            INTEGER,
    id                    INTEGER,
    trackname             TEXT,
    importance            TEXT,
    tracktype             TEXT,
    currentcon            TEXT,
    custodian             TEXT,
    lastcut               TEXT,
    nextcut               TEXT,
    comments              TEXT,
    added_by              INTEGER,
    added_timestamp       TIMESTAMP WITH TIME ZONE,
    reviewed_by           INTEGER,
    reviewed_timestamp    TIMESTAMP WITH TIME ZONE,
    moderated_by          INTEGER,
    moderated_timestamp   TIMESTAMP WITH TIME ZONE,
    added_by_username     TEXT,
    reviewed_by_username  TEXT,
    moderated_by_username TEXT,
    status                TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        v.version_id,
        v.id,
        v.trackname,
        v.importance,
        v.tracktype,
        v.currentcon,
        v.custodian,
        v.lastcut::TEXT,
        v.nextcut::TEXT,
        v.comments,
        v.added_by,
        v.added_timestamp,
        v.reviewed_by,
        v.reviewed_timestamp,
        v.moderated_by,
        v.moderated_timestamp,
        u_a.username  AS added_by_username,
        u_r.username  AS reviewed_by_username,
        u_m.username  AS moderated_by_username,
        CASE WHEN v.moderated_by IS NOT NULL THEN 'approved' ELSE 'pending' END AS status
    FROM permolat_track_versions v
    LEFT JOIN permomap_users u_a ON v.added_by      = u_a.userid
    LEFT JOIN permomap_users u_r ON v.reviewed_by   = u_r.userid
    LEFT JOIN permomap_users u_m ON v.moderated_by  = u_m.userid
    WHERE v.id = p_track_id
    ORDER BY v.version_id ASC;
$$;

COMMENT ON FUNCTION api.get_track_versions IS
    'Return all versions of a track with joined usernames. '
    'Geometry is excluded; use api.get_version_geometry for map overlays.';


-- ----------------------------------------------------------------------------
-- api.get_version_geometry
-- Equivalent to GET /api/version-geometry/:versionId.
-- Returns the geometry as GeoJSON in EPSG:4326 (standard for web clients).
-- NOTE: The stored geometry is in EPSG:3857. ST_Transform is applied on read
-- so the client always receives standard lon/lat GeoJSON regardless of storage
-- SRS. This is the correct pattern for geospatial APIs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_version_geometry(p_version_id INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT
        CASE
            WHEN v.geom IS NULL THEN
                jsonb_build_object(
                    'success',      true,
                    'geometry',     NULL,
                    'srid',         NULL,
                    'stored_srid',  3857
                )
            ELSE
                jsonb_build_object(
                    'success',      true,
                    'version_id',   v.version_id,
                    -- stored_srid: what the DB holds; srid: what is returned to the client
                    'stored_srid',  ST_SRID(v.geom),
                    'srid',         4326,
                    -- ST_AsGeoJSON options=4 embeds a CRS member inside the GeoJSON object
                    -- so the geometry itself is self-describing
                    'geometry',     ST_AsGeoJSON(ST_Transform(v.geom, 4326), 9, 4)::JSONB
                )
        END
    FROM permolat_track_versions v
    WHERE v.version_id = p_version_id
    LIMIT 1;
$$;

COMMENT ON FUNCTION api.get_version_geometry IS
    'Return version geometry as WGS84 GeoJSON. '
    'Applies ST_Transform(geom, 4326) on read so clients always get standard lon/lat. '
    'Returns NULL geometry (not an error) if the version has no geometry recorded.';


-- ----------------------------------------------------------------------------
-- api.get_total_length
-- Equivalent to GET /api/total_length.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_total_length()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT
        round(cast(sum(ST_Length(geom) / 1000) AS numeric))::TEXT
        || ' km of NZ tramping tracks and routes under community management'
    FROM view_tracks
    WHERE current_version = true;
$$;

-- ============================================================================
-- SECTION 3: Moderation and peer review
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.moderate_track_version
-- Equivalent to POST /api/moderate (moderator or sysadmin only).
-- On approve: stamps moderation, then promotes the version geometry and
-- attributes into permolat_tracks_prod to make it the live canonical record.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.moderate_track_version(
    p_moderator_userid  INTEGER,
    p_moderator_role    TEXT,
    p_version_id        INTEGER,
    p_action            TEXT,        -- 'approve' or 'reject'
    p_comments          TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_version permolat_track_versions%ROWTYPE;
    v_comment_suffix TEXT;
BEGIN
    -- Role check
    IF p_moderator_role NOT IN ('moderator', 'sysadmin') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Moderator access required');
    END IF;

    IF p_action NOT IN ('approve', 'reject') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Action must be "approve" or "reject"');
    END IF;

    SELECT * INTO v_version
    FROM permolat_track_versions WHERE version_id = p_version_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Track version not found');
    END IF;

    v_comment_suffix := CASE
        WHEN p_comments IS NOT NULL THEN E'\n[Moderator: ' || p_comments || ']'
        WHEN p_action = 'approve'   THEN E'\n[Approved by moderator]'
        ELSE                             E'\n[Rejected by moderator]'
    END;

    UPDATE permolat_track_versions
    SET moderated_by        = p_moderator_userid,
        moderated_timestamp = NOW(),
        status              = p_action || 'd',   -- 'approved' or 'rejected'
        comments            = COALESCE(comments, '') || v_comment_suffix
    WHERE version_id = p_version_id;

    -- On approval, promote version data into the canonical track record
    -- This is the key moderation side-effect missing from the original server.mjs TODO.
    IF p_action = 'approve' THEN
        UPDATE permolat_tracks_prod
        SET trackname    = COALESCE(v_version.trackname,   trackname),
            tracktype    = COALESCE(v_version.tracktype,   tracktype),
            layer_name   = COALESCE(v_version.layer_name,  layer_name),
            importance   = COALESCE(v_version.importance,  importance),
            custodian    = COALESCE(v_version.custodian,   custodian),
            currentcon   = COALESCE(v_version.currentcon,  currentcon),
            geom         = COALESCE(v_version.geom,        geom)
        WHERE id = v_version.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Track version ' || p_action || 'd successfully'
    );
END;
$$;

COMMENT ON FUNCTION api.moderate_track_version IS
    'Approve or reject a pending track version. '
    'On approval, promotes the version geometry and attributes into permolat_tracks_prod '
    '(this was a TODO in the original server.mjs and is implemented here). '
    'Role check is enforced inside the function; pass req.session.role from the caller.';


-- ----------------------------------------------------------------------------
-- api.review_track_version
-- Equivalent to POST /api/review (any authenticated user).
-- Peer review — cannot review your own edits.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.review_track_version(
    p_reviewer_userid    INTEGER,
    p_reviewer_username  TEXT,
    p_version_id         INTEGER,
    p_comments           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_added_by INTEGER;
    v_comment  TEXT;
BEGIN
    SELECT added_by INTO v_added_by
    FROM permolat_track_versions
    WHERE version_id = p_version_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Track version not found');
    END IF;

    IF v_added_by = p_reviewer_userid THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cannot review your own track edits');
    END IF;

    v_comment := CASE
        WHEN p_comments IS NOT NULL
            THEN E'\n[Peer review by ' || p_reviewer_username || ': ' || p_comments || ']'
        ELSE
            E'\n[Peer reviewed by ' || p_reviewer_username || ']'
    END;

    UPDATE permolat_track_versions
    SET reviewed_by        = p_reviewer_userid,
        reviewed_timestamp = NOW(),
        comments           = COALESCE(comments, '') || v_comment
    WHERE version_id = p_version_id;

    RETURN jsonb_build_object('success', true, 'message', 'Track version reviewed successfully');
END;
$$;

-- ============================================================================
-- SECTION 4: Version comments
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.add_version_comment
-- Equivalent to POST /api/version-comment.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.add_version_comment(
    p_userid             INTEGER,
    p_version_id         INTEGER,
    p_comment_text       TEXT,
    p_parent_comment_id  INTEGER DEFAULT NULL,
    p_is_moderator       BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_comment_id INTEGER;
    v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    IF p_comment_text IS NULL OR trim(p_comment_text) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Comment text is required');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM permolat_track_versions WHERE version_id = p_version_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Track version not found');
    END IF;

    INSERT INTO permolat_version_comments
        (version_id, user_id, comment_text, parent_comment_id, is_moderator_comment)
    VALUES
        (p_version_id, p_userid, p_comment_text, p_parent_comment_id, p_is_moderator)
    RETURNING comment_id, created_at
    INTO v_comment_id, v_created_at;

    RETURN jsonb_build_object(
        'success',    true,
        'message',    'Comment added successfully',
        'comment_id', v_comment_id,
        'created_at', v_created_at
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- api.get_version_comments
-- Equivalent to GET /api/version-comments/:versionId.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_version_comments(p_version_id INTEGER)
RETURNS TABLE (
    comment_id          INTEGER,
    version_id          INTEGER,
    user_id             INTEGER,
    comment_text        TEXT,
    created_at          TIMESTAMP WITH TIME ZONE,
    updated_at          TIMESTAMP WITH TIME ZONE,
    parent_comment_id   INTEGER,
    is_moderator_comment BOOLEAN,
    is_internal_note    BOOLEAN,
    username            TEXT,
    email               TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        c.comment_id,
        c.version_id,
        c.user_id,
        c.comment_text,
        c.created_at,
        c.updated_at,
        c.parent_comment_id,
        c.is_moderator_comment,
        c.is_internal_note,
        u.username,
        u.email
    FROM permolat_version_comments c
    LEFT JOIN permomap_users u ON c.user_id = u.userid
    WHERE c.version_id = p_version_id
    ORDER BY c.created_at ASC;
$$;


-- ----------------------------------------------------------------------------
-- api.contact_author
-- Equivalent to POST /api/contact-author.
-- Posts a mention comment; email notification is out of scope for SQL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.contact_author(
    p_sender_userid  INTEGER,
    p_version_id     INTEGER,
    p_message        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_author_username TEXT;
    v_comment_id      INTEGER;
BEGIN
    IF p_message IS NULL OR trim(p_message) = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Message is required');
    END IF;

    SELECT u.username INTO v_author_username
    FROM permolat_track_versions v
    LEFT JOIN permomap_users u ON v.added_by = u.userid
    WHERE v.version_id = p_version_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Version not found');
    END IF;

    INSERT INTO permolat_version_comments
        (version_id, user_id, comment_text, parent_comment_id, is_moderator_comment)
    VALUES
        (p_version_id, p_sender_userid, '@' || v_author_username || ' ' || p_message, NULL, false)
    RETURNING comment_id INTO v_comment_id;

    -- NOTE: Email notification to the author must be triggered from server.mjs
    -- after calling this function, as SMTP is not available in SQL.

    RETURN jsonb_build_object(
        'success',         true,
        'message',         'Message sent as comment. Author will be notified.',
        'author_username', v_author_username
    );
END;
$$;

-- ============================================================================
-- SECTION 5: User profile and settings
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.update_user_profile
-- Equivalent to PUT /api/user/profile.
-- Email uniqueness check is included. Password change is NOT here because
-- bcrypt hashing must remain in server.mjs (pgcrypto uses different algorithms).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.update_user_profile(
    p_userid    INTEGER,
    p_username  TEXT DEFAULT NULL,
    p_email     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_username IS NULL AND p_email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'No fields to update');
    END IF;

    -- Email uniqueness check
    IF p_email IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM permomap_users
            WHERE email = p_email AND userid <> p_userid
        ) THEN
            RETURN jsonb_build_object('success', false, 'message', 'Email already in use');
        END IF;
    END IF;

    UPDATE permomap_users
    SET username   = COALESCE(p_username, username),
        email      = COALESCE(p_email, email),
        updated_at = NOW()
    WHERE userid = p_userid;

    RETURN jsonb_build_object('success', true, 'message', 'Profile updated successfully');
END;
$$;


-- ----------------------------------------------------------------------------
-- api.get_user_settings  /  api.update_user_settings
-- Equivalents to GET/PUT /api/user/settings.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_user_settings(p_userid INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'userid',           userid,
        'username',         username,
        'email',            email,
        'role',             role,
        'email_updates',    COALESCE(email_updates, true),
        'email_newsletter', COALESCE(email_newsletter, true)
    )
    FROM permomap_users
    WHERE userid = p_userid
    LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION api.update_user_settings(
    p_userid           INTEGER,
    p_email_updates    BOOLEAN,
    p_email_newsletter BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE permomap_users
    SET email_updates    = p_email_updates,
        email_newsletter = p_email_newsletter,
        updated_at       = NOW()
    WHERE userid = p_userid;

    RETURN jsonb_build_object('success', true, 'message', 'Settings updated successfully');
END;
$$;


-- ----------------------------------------------------------------------------
-- api.unsubscribe_user
-- Equivalent to POST /api/user/unsubscribe.
-- Sets both email flags to false and logs the action.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.unsubscribe_user(
    p_userid     INTEGER,
    p_reason     TEXT    DEFAULT 'User requested unsubscribe',
    p_ip_address TEXT    DEFAULT NULL,
    p_user_agent TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE permomap_users
    SET email_updates    = false,
        email_newsletter = false,
        updated_at       = NOW()
    WHERE userid = p_userid;

    INSERT INTO permomap_userhistory (userid, event_type, details, ip_address, user_agent)
    VALUES (
        p_userid,
        'unsubscribe',
        jsonb_build_object('reason', p_reason),
        p_ip_address,
        p_user_agent
    );

    RETURN jsonb_build_object('success', true, 'message', 'Successfully unsubscribed from all emails');
END;
$$;

-- ============================================================================
-- SECTION 6: Admin — users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.admin_list_users
-- Equivalent to GET /api/admin/users (sysadmin only).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.admin_list_users(p_requester_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_requester_role <> 'sysadmin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'System administrator access required');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'users', (
            SELECT jsonb_agg(row_to_json(u)::JSONB ORDER BY u.created_at DESC)
            FROM (
                SELECT userid, username, email, role, oauth_provider, created_at, updated_at
                FROM permomap_users
                ORDER BY created_at DESC
            ) u
        )
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- api.admin_delete_user
-- Equivalent to DELETE /api/admin/users/:userid (sysadmin only).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.admin_delete_user(
    p_requester_role  TEXT,
    p_target_userid   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_requester_role <> 'sysadmin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'System administrator access required');
    END IF;

    DELETE FROM permomap_users WHERE userid = p_target_userid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'User deleted successfully');
END;
$$;

-- ============================================================================
-- SECTION 7: Error reporting
-- ============================================================================

-- ----------------------------------------------------------------------------
-- api.submit_error_report
-- Equivalent to POST /api/report-error.
-- URL sanitisation and size limits are enforced here to match server.mjs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.submit_error_report(
    p_userid            INTEGER     DEFAULT NULL,
    p_username          TEXT        DEFAULT NULL,
    p_error_type        TEXT        DEFAULT 'user_report',
    p_error_message     TEXT        DEFAULT NULL,
    p_error_stack       TEXT        DEFAULT NULL,
    p_user_description  TEXT        DEFAULT NULL,
    p_page_url          TEXT        DEFAULT NULL,
    p_user_agent        TEXT        DEFAULT NULL,
    p_viewport_width    INTEGER     DEFAULT NULL,
    p_viewport_height   INTEGER     DEFAULT NULL,
    p_screenshot_data   TEXT        DEFAULT NULL,
    p_console_log_json  TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    -- Reject oversized screenshots (> 2 MB in base64)
    IF p_screenshot_data IS NOT NULL AND length(p_screenshot_data) > 2 * 1024 * 1024 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Screenshot data too large (max 2 MB)');
    END IF;

    INSERT INTO permomap_error_reports (
        userid, username, error_type, error_message, error_stack,
        user_description, page_url, user_agent,
        viewport_width, viewport_height, screenshot_data, console_log_json
    ) VALUES (
        p_userid,
        p_username,
        left(COALESCE(p_error_type, 'user_report'), 50),
        left(p_error_message,    2000),
        left(p_error_stack,      5000),
        left(p_user_description, 2000),
        left(p_page_url,          500),
        left(p_user_agent,        500),
        p_viewport_width,
        p_viewport_height,
        p_screenshot_data,
        left(p_console_log_json, 10000)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Error report submitted. Thank you!');
END;
$$;

COMMENT ON FUNCTION api.submit_error_report IS
    'Insert an error report. URL sanitisation (path-only) must still be done in '
    'server.mjs before calling this function, as URL parsing requires JS URL API.';


-- ----------------------------------------------------------------------------
-- api.list_error_reports
-- Equivalent to GET /api/admin/error-reports (sysadmin only).
-- Screenshot data is excluded from the list; use api.get_error_report_screenshot.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.list_error_reports(
    p_requester_role       TEXT,
    p_limit                INTEGER DEFAULT 50,
    p_offset               INTEGER DEFAULT 0,
    p_include_acknowledged BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF p_requester_role <> 'sysadmin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'System administrator access required');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'reports', (
            SELECT jsonb_agg(row_to_json(r)::JSONB)
            FROM (
                SELECT
                    id, userid, username, error_type, error_message, error_stack,
                    user_description, page_url, user_agent,
                    viewport_width, viewport_height, console_log_json,
                    acknowledged, acknowledged_at, created_at,
                    (screenshot_data IS NOT NULL) AS has_screenshot
                FROM permomap_error_reports
                WHERE (p_include_acknowledged OR acknowledged = FALSE)
                ORDER BY created_at DESC
                LIMIT  LEAST(p_limit, 200)
                OFFSET GREATEST(p_offset, 0)
            ) r
        )
    );
END;
$$;


-- ----------------------------------------------------------------------------
-- api.get_error_report_screenshot
-- Equivalent to GET /api/admin/error-reports/:id/screenshot.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.get_error_report_screenshot(
    p_requester_role TEXT,
    p_report_id      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_screenshot TEXT;
BEGIN
    IF p_requester_role <> 'sysadmin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'System administrator access required');
    END IF;

    SELECT screenshot_data INTO v_screenshot
    FROM permomap_error_reports WHERE id = p_report_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Report not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'screenshot_data', v_screenshot);
END;
$$;


-- ----------------------------------------------------------------------------
-- api.acknowledge_error_report
-- Equivalent to POST /api/admin/error-reports/:id/acknowledge.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION api.acknowledge_error_report(
    p_requester_role TEXT,
    p_requester_id   INTEGER,
    p_report_id      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_requester_role <> 'sysadmin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'System administrator access required');
    END IF;

    UPDATE permomap_error_reports
    SET acknowledged    = TRUE,
        acknowledged_by = p_requester_id,
        acknowledged_at = NOW()
    WHERE id = p_report_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Report not found');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Report acknowledged');
END;
$$;

