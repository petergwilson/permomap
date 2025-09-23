#!/bin/bash
set -e

# Note that the name of this file is significant. It ensures that it runs after the Postgres DB is initialized.

# Wait for PostgreSQL to be ready
until pg_isready -U postgres -d permolatmap; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "PostgreSQL is ready, creating PostGIS extension..."

# Create PostGIS extension
psql -U postgres -d permolatmap -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -U postgres -d permolatmap -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"

echo "PostGIS extension created, restoring database from dumps..."

# First restore the permolat_tracks dump file
if [ -f "/docker-entrypoint-initdb.d/permolat_tracks.sql" ]; then
  echo "Restoring permolat_tracks table from permolat_tracks.sql..."
  pg_restore -U postgres -d permolatmap -t permolat_tracks /docker-entrypoint-initdb.d/permolat_tracks.sql
  echo "Restoration of permolat_tracks table completed."
else
  echo "permolat_tracks.sql file not found."
fi

echo "All database restoration tasks completed."

echo "Loading DOC huts GeoJSON data..."
if [ -f "/docker-entrypoint-initdb.d/doc-huts.geojson" ]; then
  echo "Loading doc-huts.geojson into database..."
  ogr2ogr -f "PostgreSQL" PG:"dbname=permolatmap user=postgres" "/docker-entrypoint-initdb.d/doc-huts.geojson" -nln doc_huts -lco GEOMETRY_NAME=geom -lco FID=gid -overwrite
  echo "DOC huts data loaded successfully."
else
  echo "doc-huts.geojson file not found."
fi

echo "Loading DOC tracks GeoJSON data..."
if [ -f "/docker-entrypoint-initdb.d/doc-tracks.geojson" ]; then
  echo "Loading doc-tracks.geojson into database..."
  ogr2ogr -f "PostgreSQL" PG:"dbname=permolatmap user=postgres" "/docker-entrypoint-initdb.d/doc-tracks.geojson" -nln doc_tracks -lco GEOMETRY_NAME=geom -lco FID=gid -overwrite
  echo "DOC tracks data loaded successfully."
else
  echo "doc-tracks.geojson file not found."
fi

echo "All database initialization tasks completed."
