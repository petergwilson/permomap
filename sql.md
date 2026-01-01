#SQL Schema

As of 02 January 2026:

Schema approach has been simplified, to avoid the need for array storage in database. 

permomap_tracks - primary track layer
permomap_track_versions - versions of the primary track layer that are in edit or awaiting approval by moderators

The armchair software engineer/trampers' guide to track philosophy:
===================================================================

What on earth is a track? 

Tracks are seemingly simple, yet deceptively hard to define. For most people, track is a line, a route between a start point and an end-point, between destinations. This might be a road-end, a hut, a campsite, 
a river-crossing, or another feature like a mountain peak, a bushline, or between tracks (a junction of tracks). It is also something that you walk on, a track might be hard, soft, wide, stony, bumpy. It might be nearly a road, or in the other extreme, a barely visible set of indentations on the ground. It might not even be made by humans - an animal track. It may not have been made legally (noting here, that I don't necessarily link "legal" with "needed", or "useful'). It might be made for  different recreation than tramping - hunting/pest-control, mountain-biking, 4WDing, farming, infrastructure, and so on. The mode of recreation or purpose defines the basket of things that might be a "track". A tramper looks for a different track to 4WDer might be looking for a "track", they are both physical features on the ground, but in the 4WD case it is wider and needs to support 4 wheels and a chassis. Broad agreement is possible on what a "track as physical feature is", with some overlap between the different types of use.  

But what about a track as a route between a start point and end-point. This is "track as route". This sort of track might be a collection of many physical tracks, some parts of non-physical tracks. It might be the intended route of a person or group, it might be the actual route, it might exist culturally but not on the ground - "the five passes track in Mt Aspiring National Park" comes to mind here - few trampers would describe this as a track - it's a route, and trampers might get upset as it starts to develop tracking, or bits of physical track on the ground. But how can it be a "route" as well as a "track" - in engineering, "routing algorithm" would be closer. It's user defined - a layer on top of something physical. GPS software uses "routes" and "tracks/tracking" interchangeably here. 

So there's really two types of tracks here - 
1) a track as a visible physical feature on the ground, a category of widths, surfaces, types, which at one end blurs into the underlying terrain, and at the other end, blurs into a road (noting, many highway standard roads are called "tracks"). 
2) a track as a set of instructions, intention (routing algorithm), or past-action from a start-point to an end-point over terrain. It might not even involve physical tracks at all. 

In short, there's no fixed definition of a "track". It is defined culturally, but anchored physically, although the anchoring can change meaning slowly based on a common acceptance of what a track is, or isn't. Topographical maps have traditionally focused on the physical features of a track, usualy, reliant on reporting from government departments and councils on the form and nature of it. The topographical "track" is what underpins most NZers concept of a track - some physical feature that existed, or once existed on the ground. 

Outdoor people translate between track as a physical feature and track as a route effortlessly. It shouldn't be assumed everyone does. "Off track" is a scary concept to someone who has never been in the hills at all. To me, it's a scarier concept to my feet - I don't like blisters from hard surfaces, and DOC bored walks. 

The point of all this discussion is to illustrate that tracks change their meaning. If a piece of software is to last, its underlying schema needs to reflect that tracks change their meaning over time, have contested meaning, and be able to handle this. There is thus no offical, canonical, set of truth about what a track is and isn't. There's past-practice and history, and a likely consistent common understanding, but no fixed scheme can exist. If one was to, it would create an unnecessary straitjacket for future use that cannot be anticipated in advance. 

Thus any database schema to define tracks, must reflect the cultural concept of a track if it is to be of any success. This means - a physical feature on the ground, that is commonly understood and agreed, it might have a different intention for use, but can be used by others (big things tend to not like small tracks, and fast things may not like slow things - vice versa too). This is the approach taken by topographical maps, and whilst not perfect, topographical maps have existed in NZ for 100 years or more, and work, and so this is the approach taken here. 

The next challenge is harder. Tracks are spatial and temporal - they move in space and time. This is highly contextual. In some places, moving a track from one side of the valley to another wouldn't be seen as a change at all, in other places - it'd would be the new east-side, true left track, versus the old track. In recent years, with the gradual pullout of the Department of Conservation from the backcountry, the community has taken on the maintenance work of some former DOC tracks, as well as opening up old NZ Forest Service routes. Debates about what a "track" is fortunately don't appear, showing that the concept is strong culturally. 

The challenge arises in trying to capture this information in a computer systems. Computers don't know context unless programmed, and this requires careful thought. What's easy in a human head gets harder when it hits a database schema and table definition. 
-What is the relationship of the state of a track to the underlying "primary". Is a track made up of a discrete set of finite "segments", is it more than this? Do some tracks support being split up into segments? What about showcasing the state of a track over time? 
-At what point does a change to a track, such as a cut around a slip, or a better line up a spur, or a complete replacement due to major flooding, become an all new track? 
-At what point does a route that may have no physical features on the ground, but yet is of importance sufficient to spatially capture it, cease to be a track? 
-At what point does a track that might have been maintained by DOC, but for which information is wrong, and which the community have picked up, be reported on by the community and not DOC? 
-What about cases of misnamed tracks, wrong spatial captures on the topomap, old versions versus new versions, GIS artifacts such as polygons in the wrong place, different coordinate systems, GPS signal quality, official linestrings and polygons that don't make sense. 

There is no clear or easy answer to any of these cases, nor I imagine a bunch of other questions I and the outdoor community have not thought of. 

Any database design cannot resolve these questions, but has to anticipate them and deal with them accordingly. It also has to anticipate other issues, such as: 
-data quality, including future changes in positioning information
-validation/verification/trust of data
-use and reuse
-official versus community information about tracks - where is the cut-off between DOC and community
-information retrieval for use in other systems, archival, new maintainers
-peer-review
-avoiding single-user/single-organisation capture and control 

These issues, and more, are dealt with by the following principles. If they haven't been, or you have suggestions, please add them. 

Principle 1) 
1.1 Permomap defines a "track" as a singular physical feature on the ground that supports recreation and is distinguishable from the surrounding terrain. There's no limit on the concept of "recreation", but at this point, mostly foot or pedal powered recreation. 4WD tracks are an edge case and a potential boundary at one end - pest control/trapping lines put in for biodiversity management purposes but also used for recreation are the other. The existence of a physical track needs to supported by evidence and/or intent (in the case of new tracks) or community support through peer-review. 

1.2 The state of a track is different to the underlying primary track. Thus track state is implemented as a loose overlay that applies, like a highlighter pen, to the underlying track. A track can have many segments as an overlay that show its status. Similarly, a track does not need segments to show state - state can be shown in the primary track layer, or delegated to a set of segments (for instance, a longer track). Track information can be returned to the primary layer too. 

1.3 The bounds of a track, or its neighbourhood, is set to 1km or the bounding box of another track (whichever comes first), so any spatial movements of a track, such as a cut or recut, within this 500m bounding box will be treated as an adjustment to the primary track. Outside of 1km (excluding the case of other tracks in the neighbourhood), the "name" of the track, or its identifier will be flagged for discussion and/or potential merging by moderators.

1.4 All track information edits and updates require a user account. Peer review is by other users, with a single user to review and confirm. Moderators are to approve publishing/go-live. All user edits and amendments are saved. Monthly updates to track information are saved online at https://github.com/petergwilson/permomap/archive/ in CSV form,

Implementation:
-permomap_tracks - primary table for track information including geometry, id, current_version
-permomap_track_version - table for version information, inherited from the parent. As new edits are made a new row is added, with the changes outlined. The server can produce a diff (set of changes) across versions, for review and moderation. Upon moderation approval, the current_version of the permomap_tracks table integer is set to the id of the version in the permomap_track_version. 
-permomap_segments - Overlay table containing a more basic set of information about the current track status, for track cutters-reviewers. All GIS information goes into this at first (regardless of proximity or otherwise to existing primary tracks) to handle artifacts/accuracy. There is a separate interface for merging, editing this information. All info is accepted into the permomap_segments table, with a UUID for the segment entry. Once accepted by reviewer/moderator, a row in the permomap_segment_to_primary table is entered with a unique ID for the primary track as well, which attachs them. If the primary track flag for "multiple_status" is set to "true" the permomap_segments attached to this track are then shown as an overlay (using a VIEW in the geoserver) over that track, with a level of transparency. 
-Unattached segments can also be shown if needed - but do not have to. 
-ABILITY TO MERGE HERE - needs implementation. 

Principle 2) Open source
2.1 Permomap uses open source systems, mainly, Postgresql (v18), Postgis (v3 and above), pg_tileserv, pg_featureserve, Javascript/Typescript, HTML, OAuth2. 

Principle 3) Trust
3.1 Permomap aims to build trust, support, for community mapping. 




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
