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

## Development

### Running frontend (webserver) locally

Ensure you have node and npm installed, at least version 16. 
The node_modules for the client are at ./node_modules
Currently using vite as a development environment, running on port 5431 (default HTTP port for vite)

Make sure that the layer URLs match your database settings, see below. 
You will need your own API key for external layers from the LINZ Data Service, please get from https://data.linz.govt.nz/ 

```shell
npm start - to spin up a vite server on localhost
npm run build - currently builds to ./dist.

If you are building to ./dist, please check vite.config.js to ensure that the base of the url is correct for your setup.
This seems to be causing endless issues I'd like to understand more.

The api routes to the server middleware are in vite.config.js as well. 


```
### Running database locally

Install Postgresql (should work with versions above 17) as you will need JSON support.
Install Postgis, latest version. 
Open up port 5432, to local traffic
Install pg_featurserv, instructions here:

https://github.com/CrunchyData/pg_featureserv
Open up port 9000 (HTTP for pg_featurserv), also port 9050 (or your choice) for HTTPS, if you want secure services (probably not needed for localhost

A sample pg_config

Testing data:

Download the testing data from ./sql:
permolat_tracks.sql

The sql is in pg_dump custom format (-Fc) so needs pg_restore to load

pg_restore -U <username> -d <database_name> -t permolat_tracks permolat_tracks_june12.sql

PLEASE NOTE THAT THIS IS TEST DATA ONLY, NOT FOR PUBLIC CONSUMPTION

### Running backend locally

The backend server is required to run the middleware to connect to the database, maintain state/cookies etc
It runs on port 3000. You will need to make sure this port is open to at least localhost:XXXX (usually 5173) with appropriate firewall settings
The server node-modules are in ./backend/node_modules. These are currently stored separately from the main application.

Make sure that the URLs in server.js match the your database settings above. The application won't serve layers without this. 

To run the backend, node server.js

You could build the backend before runnning it, but I haven't done this so far, as the modules for it are separate to the rest of the project. 

Note that you need the Postgres DB running on your machine as well. 

## Production

Alpha production testing is currently running on an Ubuntu 22 instance (Azure cloud), using Apache2 as the webserver, Node for the backend, an optimised pg_featureserv instance as the geoserver, and Postgresql 17 as the database. 

