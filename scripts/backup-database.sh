#!/bin/bash

###########################################
# Quick Backup Script
# Creates a timestamped backup of local database
###########################################

set -e

LOCAL_DB="gis"
LOCAL_USER="postgres"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/gis_backup_${TIMESTAMP}.dump"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating backup of $LOCAL_DB database..."
pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup created successfully!"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $BACKUP_SIZE"
    
    # Keep only last 10 backups
    echo ""
    echo "Cleaning up old backups (keeping last 10)..."
    ls -t "$BACKUP_DIR"/gis_backup_*.dump | tail -n +11 | xargs -r rm
    echo "✓ Cleanup complete"
else
    echo "✗ Backup failed"
    exit 1
fi
