A very basic TODO file, which most likely doesn't capture everything. 

A first task for someone wanting to understand Git/Github is to update this TODO file with the notes of the Permolat meeting held on 03 June 2025 where the concept for this mapping system was extensively discussed.

1. Get alpha test of the system online and available to users

Done, 27/07/2025, online at https://www.wilsonenv.nz/permomap. Dockerfile created for local installs. However dockerfile will need some updating once other minor changes to the test system are undertaken. Thinking of a meson build system to keep the dockerfile up to date with Postgresql, code versions, database schema etc. There is an architecture choice to be made about sourcing of geospatial layers for local builds - does it work off a central server (i.e. the pg_featureserv hosted at www.wilsonenv.nz) or does use a local link to a hosted layer at the relevant remote host (eg LINZ, Koordinates etc). The more I think about it the more issues are created if it goes away from a central server, although I think the code should always show how to do it directly. The local copies can't branch too much from the actual production system, and updating databases requires updating logic (which the production geoserver has), and which can be challenging for local installs. 

Code should thus reference the production geoserver but contain commented out links to show how it can be done manually, any manual links will need own account at the various online services. 
  
3. Enable a small, trusted group of users to start editing track information and test the system, reporting faults and errors

27/07/2025, in place, beginning. 
   
5. WILL NEED A TESTING/STAGING SITE ESTABLISHED - TAKE ADVICE

27/07/2025. In place. 

7. Build, train, and mentor (as necessary) a core group of maintainers/committers

Starting on this, time permitting for all these volunteers. 
  
9. Improve database schema, thinking of all possible future uses. I encourage a big focus on this, to avoid issues many years down the track.

27/07/2025, schema improvements agreed are:
-Staging table for edits
-Production table for moderated/approved entries
-Use nextval() for IDs sequence, to avoid multiple session errors
-Still thinking to occur on how to finalise the merging of track geometry and trackstate
   
11. Focus on usability of frontend platform
-27/07/2025 entry fields will now be locked to a single user per field, preventing conflicts at the client end. OnEntry and OnBlur events will define the beginning and end of the per-user locks.
-Still a lot of work to occur on the underlining and strikethrough functions to show past edits.
-User logic needs beefing up to handle multiple users. 
  
13. Think of offline app development, data-sharing and re-use for other navigation apps. 
