# permomap
## concept

Online mapping system and app to record and display information about community managed huts and tracks in New Zealand. 

Currently running in a limited, alpha-trial mode at https://www.wilsonenv.nz/permomap/. Will migrate to another URL once fully operational and tested. 

This project contains a number of components to build a culture and system for reporting on, managing, and contributing to the upkeep of backcountry huts, routes, and tracks across New Zealand which receive minimal or no maintenance by the Department of Conservation, and/or land managing agencies. It is primarily geospatial, and a companion project to https://www.remotehuts.co.nz/.

Software license (GPL) vested in the Permolat Trust of New Zealand Inc. 

TODO in https://github.com/petergwilson/permomap/edit/main/TODO.md

Instructions on understanding/training in the geospatial software stack that this application uses are to come. Meanwhile, if you want to learn and contribute, email petergwilson@gmail.com directly. 

## culture
Slack for this project is here: https://app.slack.com/client/T029TN85MFA/C091KG0HP16

Contributers of all ages and technical ability are encouraged, and will be supported in software engineering, geospatial applications, and an understanding of New Zealand mountain culture. Community standards about the use of the application may be set and applied to all users. Committers/maintainers will be chosen from amongst the group of contributers peer choice. Both software contributers and content contributers/moderators are encouraged. 

For the application itself, appropriate design and engineering choices should ensure that self-moderation applies, and any need for moderation is minimal.

A core group of maintainers accept commits, and also (currently) maintain the server. 

### A service to the backcountry community
Design philosophy is:
* Expand the group of track-cutters, track maintainers, interested people, trampers and hunters that comment and review on recreation and conservation work
* At all times, maintain the confidence of those that have gone before, and are doing this work with proven, manual systems. If in doubt, seek their guidance. Technical decisions must implement a guiding philosophy.
* Limited to community managed "permolat" tracks at this point. 
* Fully open, but different levels of permissions based on user status. Editors of content are recorded. 
* All content recorded - essentially a spatial github, no deletions allowed. Historical edits form part of an archive of effort in the backcountry
* All contributions, software, hardware, content, and physical (i.e. track cutting and hut work) are acknowledged and attributed where people want them acknowledged. Party members are to be acknowledged as well if they want acknowledgement, not just the contributor/editor. 
* Peer review of content built into system design to encourage it at all levels. 
* Sustainability - ensure information reuse and avoid technical obsolesecene. An example is automatically saving spatial and non-spatial information to a spreadsheet

## System

### Backend 

Built with Javascript, running on NodeJS, with Postgresql running Postgis, using pg_tileserv and pg_featureserv. Links to these projects are below:
* https://www.postgresql.org/, https://www.postgis.net/, https://nodejs.org/en/, https://github.com/CrunchyData/pg_tileserv, https://github.com/CrunchyData/pg_featureserv
* Currently running on Azure VM, hosted by Peter Wilson
* Schema information is available in backend/
* Server code/instructions/setup also in backend/

### Frontend 
* HTML/Javascript, Primarily using the openlayers library. https://openlayers.org/
* Web services running on Apache2 webserver, running on Azure VM, hosted by Peter Wilson
* HTML/Javascript code in /frontend

