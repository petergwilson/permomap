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

echo "PostGIS extension created, restoring permolat_tracks table..."

# Run pg_restore to restore the permolat_tracks table
pg_restore -U postgres -d permolatmap -t permolat_tracks /docker-entrypoint-initdb.d/permolat_tracks_june12.sql

echo "Restoration of permolat_tracks table completed."
