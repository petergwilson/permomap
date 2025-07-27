A very basic TODO file, which most likely doesn't capture everything. 

A first task for someone wanting to understand Git/Github is to update this TODO file with the notes of the Permolat meeting held on 03 June 2025 where the concept for this mapping system was extensively discussed.

1. Get alpha test of the system online and available to users

Done, 27/07/2025, online at https://www.wilsonenv.nz/permomap. Dockerfile created for local installs. However dockerfile will need some updating once other minor changes to the test system are undertaken. Thinking of a meson build system to keep the dockerfile up to date with Postgresql, code versions, database schema etc. 
  
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
