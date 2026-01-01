#SQL Schema

As of 02 January 2026:

Schema approach has been simplified, to avoid the need for array storage in database. 

permomap_tracks - primary track layer
permomap_track_versions - versions of the primary track layer that are in edit or awaiting approval by moderators

The armchair software engineer/trampers' guide to track philosophy:
===================================================================

What on earth is a track? 

Tracks are seemingly simple, yet deceptively hard to define. For most people, track is a line, a route between a start point and an end-point, between destinations. This might be a road-end, a hut, a campsite, 
a river-crossing, or another feature like a mountain peak, a bushline, or between tracks (a junction of tracks). It is also something that you walk on, a track might be hard, soft, wide, stony, bumpy. It might be nearly a road, or in the other extreme, a barely visible set of indentations on the ground. It might not even be made by humans - an animal track. It may not have been made legally (noting here, that I don't necessarily link "legal" with "needed", or "useful'). It might be made for a different recreation than tramping - hunting/pest-control, mountain-biking, 4WDing, 

The challenge lies in the seeming simplicity. If a track is user-defined, or trip-defined, its ephemeral, it exists for the purpose of that trip, and whilst many outdoor folk might agree on average what a track is, a 
user-based approach to track definition will produce substantial edge cases. Whilst fine for cultural purposes, it would not work for engineering a database that is designed to withstand years, perhaps decades of use and differing interpretations of what a track might be. 

DOC and other government agencies have a list of tracks, however, their list fluctuates based on policy and funding, and also, may not have a 

A feature of tracks is that a "track" cannot always be fully defined, and does not have a consistent topological relationship across time/space.
Think of the following scenarios:
a) A track as an end to end  feature, from one point to another. 
b) If so, what features - road end to hut, road end to river crossing, road-end to another road-end, via other tracks, based on a concept of a "trip"
c) 





As of 27 September 2025, thanks to David Rowley (most of my original thoughts made it too complicated):

Examples:

CREATE TABLE users (
	user_id SERIAL  PRIMARY KEY
	-- other columns
);

CREATE TABLE track_versions (
	version_id BIGSERIAL PRIMARY KEY,
	parent_version_id BIGINT NULL, -- NULL if this is the first version, else the parent version it was derived from
	--geom GEOMETARY NOT NULL,
	comments TEXT NOT NULL, -- User who modifies might want to write something here.
	added_by INT NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
	added_timestamp TIMESTAMPTZ NOT NULL,
	moderated_by INT NULL REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE, -- NULL if not approved yet.
	moderated_timestamp TIMESTAMPTZ NOT NULL
);


CREATE TABLE track_sections (
	section_id BIGSERIAL PRIMARY KEY,
	section_name VARCHAR(100) NOT NULL,
	current_version_id INT NOT NULL REFERENCES track_versions ON DELETE CASCADE ON UPDATE CASCADE,
	added_by INT NOT NULL REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
	added_timestamp TIMESTAMPTZ NOT NULL
);

This approach suggested by David, is a far better approach. 

*There are some issues that still need resolution I think:
* The current permolat_tracks layer has many fields - at least 20.
* How geometries are handled - there could be multiple geometries flying around, particularly where there are highlighted segments of tracks.
* The geoserver can handle one geometry column per served layer.
* This would result in a lot of whole-row replication for minor changes - particularly for the geometry field. 
* The current client logic isn't hard-coded, it tries to keep as much of the decisions around visibility/user based roles as close to the database as possible
* In particular, you can serve any layer in the client, and it will show the fields that come from the geoserver
* There is a need to have control over diffing, and show versions based on users, roles, time, and so on. This suits a changeset approach and database triggers. 
* ChatGPT gave me a changeset schema that might address it, see below in appendix a
* However, there is substantial additional complexity in this - at the advantage of less nearly-same-row replication

  


Appendix A - changeset approach (noting this is conceptual)

  -- =========================
-- 1) CHANGE HISTORY TABLES
-- =========================

-- One row per logical update to permolat_tracks
CREATE TABLE public.permolat_tracks_change_set (
  id           bigserial PRIMARY KEY,
  track_id     integer NOT NULL
               REFERENCES public.permolat_tracks(id) ON DELETE CASCADE,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  username     text        NOT NULL,
  userrole     text        NOT NULL,
  txid         bigint      NOT NULL DEFAULT txid_current(),
  client_ref   text                -- optional: request id, UI screen, etc.
);

-- One row per column that actually changed within a change_set
CREATE TABLE public.permolat_tracks_change_item (
  change_set_id bigint NOT NULL
                REFERENCES public.permolat_tracks_change_set(id)
                ON DELETE CASCADE,
  column_name   text   NOT NULL,      -- e.g., 'trackname', 'geom', ...
  column_type   regtype NOT NULL,      -- e.g., 'text'::regtype, 'geometry'::regtype
  old_value     jsonb,                 -- previous value (typed -> json)
  new_value     jsonb,                 -- new value
  PRIMARY KEY (change_set_id, column_name)
);

-- Helpful indexes for history queries
CREATE INDEX ON public.permolat_tracks_change_set (track_id, changed_at DESC);
CREATE INDEX ON public.permolat_tracks_change_item (column_name);


-- ==========================================================
-- 2) PASS APP USER / ROLE TO THE DB (per request/txn; sample)
-- ==========================================================
-- From your app (once per transaction):
--   SELECT set_config('app.username', :username, true);
--   SELECT set_config('app.userrole', :userrole, true);
--
-- If you don't set these, the trigger will fall back to CURRENT_USER and 'unknown'.


-- ========================================
-- 3) TRIGGER: RECORD ONLY WHAT ACTUALLY CHANGED
-- ========================================
CREATE OR REPLACE FUNCTION public.permolat_tracks_audit() RETURNS trigger AS $$
DECLARE
  who   text := coalesce(current_setting('app.username', true), current_user::text);
  role_ text := coalesce(current_setting('app.userrole', true), 'unknown');
  cs_id bigint;

  -- Exclude columns we do NOT want to diff as regular scalar jsonb.
  -- 'geom' is handled separately with ST_Equals + GeoJSON.
  -- (Nothing else is special on this table.)
  excluded_cols text[] := ARRAY['geom'];

  j_new jsonb;
  j_old jsonb;
BEGIN
  -- Fast exit if nothing changed at all
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  -- Create a change set header row (one per UPDATE)
  INSERT INTO public.permolat_tracks_change_set(track_id, username, userrole)
  VALUES (NEW.id, who, role_)
  RETURNING id INTO cs_id;

  -- Build JSONB versions for simple, non-geom columns
  j_new := to_jsonb(NEW) - excluded_cols;
  j_old := to_jsonb(OLD) - excluded_cols;

  -- Insert one change_item per scalar/array/JSON column that changed
  INSERT INTO public.permolat_tracks_change_item(
    change_set_id, column_name, column_type, old_value, new_value
  )
  SELECT
    cs_id,
    n.key AS column_name,
    -- Look up the regtype of the column id -> column name
    (SELECT atttypid::regtype
       FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = TG_TABLE_SCHEMA
        AND c.relname  = TG_TABLE_NAME
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = n.key
      LIMIT 1) AS column_type,
    o.value AS old_value,
    n.value AS new_value
  FROM jsonb_each(j_new) AS n
  LEFT JOIN jsonb_each(j_old) AS o ON o.key = n.key
  WHERE (o.value IS DISTINCT FROM n.value);

  -- Geometry handled separately: compare with ST_Equals and serialize to GeoJSON
  IF (NEW.geom IS NULL AND OLD.geom IS NOT NULL)
     OR (NEW.geom IS NOT NULL AND OLD.geom IS NULL)
     OR (NEW.geom IS NOT NULL AND OLD.geom IS NOT NULL AND NOT ST_Equals(NEW.geom, OLD.geom))
  THEN
    INSERT INTO public.permolat_tracks_change_item(
      change_set_id, column_name, column_type, old_value, new_value
    )
    VALUES (
      cs_id,
      'geom',
      'geometry',
      CASE WHEN OLD.geom IS NULL THEN NULL
           ELSE to_jsonb(ST_AsGeoJSON(OLD.geom)::json) END,
      CASE WHEN NEW.geom IS NULL THEN NULL
           ELSE to_jsonb(ST_AsGeoJSON(NEW.geom)::json) END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_permolat_tracks_audit ON public.permolat_tracks;

CREATE TRIGGER trg_permolat_tracks_audit
AFTER UPDATE ON public.permolat_tracks
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION public.permolat_tracks_audit();


-- ===========================================
-- 4) OPTIONAL: CAPTURE INITIAL INSERT STATE
--    (comment out if you don't want this)
-- ===========================================
CREATE OR REPLACE FUNCTION public.permolat_tracks_audit_initial() RETURNS trigger AS $$
DECLARE
  who   text := coalesce(current_setting('app.username', true), current_user::text);
  role_ text := coalesce(current_setting('app.userrole', true), 'unknown');
  cs_id bigint;
  excluded_cols text[] := ARRAY['geom'];
BEGIN
  INSERT INTO public.permolat_tracks_change_set(track_id, username, userrole)
  VALUES (NEW.id, who, role_)
  RETURNING id INTO cs_id;

  -- Seed items for all non-null non-geom columns
  INSERT INTO public.permolat_tracks_change_item(
    change_set_id, column_name, column_type, old_value, new_value
  )
  SELECT
    cs_id,
    n.key,
    (SELECT atttypid::regtype
       FROM pg_attribute a
       JOIN pg_class c ON a.attrelid = c.oid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = TG_TABLE_SCHEMA
        AND c.relname  = TG_TABLE_NAME
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND a.attname = n.key
      LIMIT 1),
    NULL,
    n.value
  FROM jsonb_each(to_jsonb(NEW) - excluded_cols) AS n
  WHERE n.value IS NOT NULL;

  -- Seed geom if present
  IF NEW.geom IS NOT NULL THEN
    INSERT INTO public.permolat_tracks_change_item(
      change_set_id, column_name, column_type, old_value, new_value
    )
    VALUES (
      cs_id,
      'geom',
      'geometry',
      NULL,
      to_jsonb(ST_AsGeoJSON(NEW.geom)::json)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_permolat_tracks_audit_initial ON public.permolat_tracks;



As of 23 September 2025, this may update any testing versions you have prior to this. 

Table structure

##permolat_tracks
--primary tracks layer
--insert details here
ALTER TABLE permolat_tracks
ADD COLUMN multiple_status boolean DEFAULT false -- enables the association with overlays,
ADD COLUMN status_overlay_links integer[] -- links to geometry_overlays
ADD COLUMN existing_track_info_field_links[] --- links to permolat_tracks_edit_table for each of the editable columns, client will default to the existing text in absence of any links in the link_tables, 
commits by a moderator update the final version of the "pending" fields and copy over into the primary fields which are the main ones read by the public. 

--This approach is designed as meta-schema, making it possible to easily make any geospatial layer live for edits - with a similar one-many approach for information sharing. 

##permomap_users
--user information
--will move to OAuth for authorisation, user and their roles will still be listed here

##permolat_tracks_edits
--Information on track edits
--The advantage of this schema is that any future overlays can also be linked with simple schema changes and some backpopulation, which could even be scripted (based on spatial relationships).
--These are the "many" part of the arrays in the 
CREATE TABLE permolat_tracks_edits
ADD COLUMN edit_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY -- #primary_key
ADD COLUMN user_id integer -- id of the user who made the edit
ADD COLUMN user_role integer -- role of the user who made it (we aren't bothering with row level security, userclass will be the generic postgres user for normal users, moderatorclass for moderators, client will default to publicclass,
ADD COLUMN timestamp integer,
ADD COLUMN thetext text,
ADD COLUMN operation text --the operation that occurred (probably, to record a moderation decision etc
ADD COLUMN status text; -- (live, pending, old) client uses this to determine what to show to different user classes
ADD COLUMN field_name text; --the field name of the field being edited for reference and error checking.
--Note that the geometry here itself doesn't show the information associated with it, this is just the geometry
--This will also show the track information fields as the primary layer HOWEVER, this will show in a different section of the client
--(Below the map).

##permolat_track_status_overlay
--INHERITS from the permolat_tracks table, meaning that as changes are made to the parent table, they'll replicate here (mostly)
--Advantage in the meta-schema concept is that only one table will need to be edited if things are added
CREATE TABLE permolat_track_status_overlay --call all non-primary geometries an overlay to avoid confusion
INHERITS (permolat_tracks);
