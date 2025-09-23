#SQL Schema
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
