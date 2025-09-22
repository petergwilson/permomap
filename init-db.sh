#!/bin/bash
set -e

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
if [ -f "/docker-entrypoint-initdb.d/permolat_tracks_june12.sql" ]; then
  echo "Restoring permolat_tracks table from permolat_tracks_june12.sql..."
  pg_restore -U postgres -d permolatmap -t permolat_tracks /docker-entrypoint-initdb.d/permolat_tracks_june12.sql
  echo "Restoration of permolat_tracks table completed."
else
  echo "permolat_tracks_june12.sql file not found."
fi

# Then restore the dev dump file
if [ -f "/docker-entrypoint-initdb.d/permomap_dev_dump_20250706.sql_dump" ]; then
  echo "Restoring from permomap_dev_dump_20250706.sql_dump..."
  pg_restore -U postgres -d permolatmap --no-acl --no-owner /docker-entrypoint-initdb.d/permomap_dev_dump_20250706.sql_dump
  echo "Database restoration from dev dump completed."
else
  echo "permomap_dev_dump_20250706.sql_dump file not found."
fi

echo "All database restoration tasks completed."
