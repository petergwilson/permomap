#!/bin/bash

###########################################
# Database Deployment Script
# Deploys local PostgreSQL database to remote host via SSH tunnel/mount
#
# ⚠️  COMMITTER USE ONLY ⚠️
# This script is for repository committers with deployment access.
# Regular contributors should not need to run this script.
# Production deployment requires:
#   - SSHFS mount configured and active
#   - SSH access to production server
#   - PostgreSQL administrative privileges on remote host
###########################################

set -e  # Exit on error

# Configuration
LOCAL_DB="gis"
LOCAL_USER="postgres"
REMOTE_MOUNT="${REMOTE_MOUNT:-/mnt/remote}"  # Local mount point to remote filesystem
REMOTE_HOST="${REMOTE_HOST:-your-remote-host.com}"  # For SSH commands
REMOTE_USER="${REMOTE_USER:-peter}"
REMOTE_DB="gis"
REMOTE_PG_USER="postgres"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/gis_deploy_${TIMESTAMP}.dump"
REMOTE_BACKUP_PATH="${REMOTE_MOUNT}/tmp/gis_deploy_${TIMESTAMP}.dump"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PostgreSQL Database Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Creating backup directory...${NC}"
    mkdir -p "$BACKUP_DIR"
fi

# Check if remote mount point exists and is accessible
if [ ! -d "$REMOTE_MOUNT" ]; then
    echo -e "${RED}✗ Remote mount point does not exist: $REMOTE_MOUNT${NC}"
    echo -e "${YELLOW}Please mount the remote filesystem first:${NC}"
    echo -e "  sshfs ${REMOTE_USER}@${REMOTE_HOST}:/ ${REMOTE_MOUNT}"
    exit 1
fi

# Check if mount point is actually mounted
if ! mountpoint -q "$REMOTE_MOUNT" 2>/dev/null && [ -z "$(ls -A "$REMOTE_MOUNT" 2>/dev/null)" ]; then
    echo -e "${RED}✗ Remote mount point is not mounted or empty: $REMOTE_MOUNT${NC}"
    echo -e "${YELLOW}Please mount the remote filesystem first:${NC}"
    echo -e "  sshfs ${REMOTE_USER}@${REMOTE_HOST}:/ ${REMOTE_MOUNT}"
    exit 1
fi

echo -e "${GREEN}✓ Remote mount point accessible: $REMOTE_MOUNT${NC}"
echo ""

# Step 1: Create local backup
echo -e "${GREEN}Step 1: Creating local database backup...${NC}"
pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" -F c -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "  Size: ${BACKUP_SIZE}"
else
    echo -e "${RED}✗ Failed to create backup${NC}"
    exit 1
fi

echo ""

# Step 2: Copy backup to remote via mounted filesystem
echo -e "${GREEN}Step 2: Copying backup to remote host via SSH tunnel...${NC}"

# Ensure remote tmp directory exists
mkdir -p "${REMOTE_MOUNT}/tmp" 2>/dev/null || true

cp "$BACKUP_FILE" "$REMOTE_BACKUP_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup copied to: $REMOTE_BACKUP_PATH${NC}"
else
    echo -e "${RED}✗ Failed to copy backup to remote mount${NC}"
    exit 1
fi

echo ""

# Step 3: Deploy on remote host via SSH
echo -e "${GREEN}Step 3: Deploying database on remote host...${NC}"
echo -e "${YELLOW}This will drop and recreate the remote database!${NC}"

ssh "${REMOTE_USER}@${REMOTE_HOST}" << EOF
    set -e
    
    echo "Dropping existing database (if exists)..."
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${REMOTE_DB};"
    
    echo "Creating new database..."
    sudo -u postgres psql -c "CREATE DATABASE ${REMOTE_DB};"
    
    echo "Enabling PostGIS extension..."
    sudo -u postgres psql -d ${REMOTE_DB} -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    
    echo "Restoring database from backup..."
    sudo -u postgres pg_restore -d ${REMOTE_DB} /tmp/gis_deploy_${TIMESTAMP}.dump
    
    echo "Cleaning up temporary backup..."
    rm /tmp/gis_deploy_${TIMESTAMP}.dump
    
    echo "Database deployment completed!"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database deployed successfully!${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Local backup: ${BACKUP_FILE}"
echo -e "Remote mount: ${REMOTE_MOUNT}"
echo -e "Remote host: ${REMOTE_HOST}"
echo -e "Remote database: ${REMOTE_DB}"
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Note: Local backup is kept at ${BACKUP_FILE}${NC}"
