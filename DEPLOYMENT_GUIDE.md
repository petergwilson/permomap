# Database Deployment Guide

⚠️ **COMMITTER USE ONLY** ⚠️

This guide is for repository committers with production deployment access. Regular contributors do not need to deploy the database.

## Overview

This system uses a **local connection architecture with SSH tunnel** where:
- Development server connects to `localhost:5432` on your local machine
- Production server connects to `localhost:5432` on the production host
- Database is deployed by copying data through an SSHFS mount point
- The remote filesystem is mounted locally via SSH tunnel

## Architecture

```
┌──────────────────────────┐
│    Local Machine         │
│                          │
│  ┌────────────────────┐  │
│  │  PostgreSQL (gis)  │  │
│  └────────────────────┘  │
│           │              │
│           ↓ pg_dump      │
│  ┌────────────────────┐  │
│  │  backups/          │  │
│  └────────────────────┘  │
│           │              │
│           ↓ cp           │
│  ┌────────────────────┐  │         ┌──────────────────────┐
│  │  /mnt/remote/      │◄─┼─ SSHFS ─┤  Remote Host         │
│  │  (SSH tunnel)      │  │         │                      │
│  └────────────────────┘  │         │  /tmp/backup.dump    │
│                          │         │         │            │
│                          │   SSH   │         ↓            │
│                          ├────────►│  pg_restore          │
│                          │         │         │            │
│                          │         │  ┌──────▼─────────┐  │
│                          │         │  │ PostgreSQL(gis)│  │
│                          │         │  └────────────────┘  │
└──────────────────────────┘         └──────────────────────┘
```

## Prerequisites

### 1. SSHFS Setup

Install SSHFS:
```bash
# Ubuntu/Debian
sudo apt install sshfs

# Arch
sudo pacman -S sshfs
```

Create mount point:
```bash
sudo mkdir -p /mnt/remote
sudo chown $USER:$USER /mnt/remote
```

Mount the remote filesystem:
```bash
sshfs peter@accesscheck.kiwi:/ /mnt/remote
```

Make it persistent (optional):
```bash
# Add to /etc/fstab
echo "peter@accesscheck.kiwi:/ /mnt/remote fuse.sshfs defaults,_netdev,user,idmap=user,allow_other 0 0" | sudo tee -a /etc/fstab
```

Check mount:
```bash
mountpoint /mnt/remote
# Should output: /mnt/remote is a mountpoint

ls /mnt/remote
# Should show remote filesystem contents
```

## Deployment Scripts

### 1. Quick Backup (Local)
```bash
npm run db:backup
```
Creates a timestamped backup in `backups/` directory.

### 2. Deploy Database to Production
```bash
# Ensure SSHFS mount is active first
REMOTE_MOUNT=/mnt/remote REMOTE_HOST=accesscheck.kiwi REMOTE_USER=peter npm run db:deploy
```

This will:
1. ✓ Verify SSHFS mount is accessible
2. ✓ Create local backup (`backups/gis_deploy_YYYYMMDD_HHMMSS.dump`)
3. ✓ Copy backup to `/mnt/remote/tmp/` (remote filesystem via SSH tunnel)
4. ✓ SSH into remote host
5. ✓ Drop existing database
6. ✓ Create new database with PostGIS
7. ✓ Restore from backup at `/tmp/backup.dump`
8. ✓ Clean up temporary files

### 3. Full Deployment (Build + Database)
```bash
REMOTE_MOUNT=/mnt/remote REMOTE_HOST=accesscheck.kiwi REMOTE_USER=peter npm run deploy:full
```
Builds frontend assets and deploys database in one command.

## Quick Setup Guide

### Step 1: Mount Remote Filesystem
```bash
# Use your existing SSHFS mount setup
# Ensure remote filesystem is mounted at /mnt/remote (or your preferred location)
```

### Step 2: Deploy Database
```bash
# Set environment variables
export REMOTE_MOUNT=/mnt/remote
export REMOTE_HOST=accesscheck.kiwi
export REMOTE_USER=peter

# Deploy
npm run db:deploy
```

## Configuration

### Option 1: Environment Variables
```bash
export REMOTE_HOST=accesscheck.kiwi
export REMOTE_USER=peter
npm run db:deploy
```

### Option 2: Create .env.deploy
```bash
cp .env.deploy.example .env.deploy
```

Edit `.env.deploy`:
```bash
REMOTE_HOST=accesscheck.kiwi
REMOTE_USER=peter
REMOTE_MOUNT=/mnt/remote
REMOTE_DB=gis
REMOTE_PG_USER=postgres
```

Then source it before running:
```bash
source .env.deploy
npm run db:deploy
```

## Prerequisites

### 1. SSHFS Mount

Ensure your SSHFS mount is configured and active. The deployment script expects the remote filesystem to be accessible at a local mount point (default: `/mnt/remote`).

### 2. SSH Access
You need passwordless SSH access to the remote host:
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519

# Copy to remote host
ssh-copy-id peter@accesscheck.kiwi

# Test connection
ssh peter@accesscheck.kiwi
```

### 2. SSH Access
You need passwordless SSH access to the remote host:
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519

# Copy to remote host
ssh-copy-id peter@accesscheck.kiwi

# Test connection
ssh peter@accesscheck.kiwi
```

### 3. Remote PostgreSQL Setup
PostgreSQL must be installed and running on the remote host:
```bash
# On remote host
sudo apt install postgresql postgresql-contrib postgis
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. Sudo Access for PostgreSQL
Your remote user needs sudo access to run PostgreSQL commands:
```bash
# On remote host, edit sudoers
sudo visudo

# Add line:
peter ALL=(postgres) NOPASSWD: /usr/bin/psql, /usr/bin/pg_restore, /usr/bin/pg_dump
```

Or ensure your script uses `sudo -u postgres` correctly.

## Manual Deployment Steps

If you prefer to deploy manually:

### 1. Create Local Backup
```bash
pg_dump -U postgres -d gis -F c -f /tmp/gis_backup.dump
```

### 2. Copy to Remote
```bash
scp /tmp/gis_backup.dump peter@accesscheck.kiwi:/tmp/
```

### 3. SSH to Remote and Restore
```bash
ssh peter@accesscheck.kiwi

# Drop existing database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS gis;"

# Create new database
sudo -u postgres psql -c "CREATE DATABASE gis;"

# Enable PostGIS
sudo -u postgres psql -d gis -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Restore backup
sudo -u postgres pg_restore -d gis /tmp/gis_backup.dump

# Clean up
rm /tmp/gis_backup.dump
```

## Backup Management

Backups are stored in `backups/` directory:
- Local backups are automatically kept (last 10 when using `backup-database.sh`)
- Deployment backups are named: `gis_deploy_YYYYMMDD_HHMMSS.dump`
- Regular backups are named: `gis_backup_YYYYMMDD_HHMMSS.dump`

To restore from a backup locally:
```bash
# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS gis;"
sudo -u postgres psql -c "CREATE DATABASE gis;"
sudo -u postgres psql -d gis -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Restore
sudo -u postgres pg_restore -d gis backups/gis_backup_20251230_143000.dump
```

## Troubleshooting

### SSHFS Mount Issues
```bash
# Check if mounted
mountpoint /mnt/remote

# Unmount if stuck
fusermount -u /mnt/remote

# Remount with debug
sshfs peter@accesscheck.kiwi:/ /mnt/remote -o debug

# Check FUSE permissions
ls -la /dev/fuse
# Should be accessible to your user

# Add user to fuse group if needed
sudo usermod -a -G fuse $USER
```

### Mount Point Not Accessible
```bash
# Script will check and show error if mount not ready
# Ensure mount exists and is accessible:
ls -la /mnt/remote

# If directory doesn't exist:
sudo mkdir -p /mnt/remote
sudo chown $USER:$USER /mnt/remote
```

### SSH Connection Failed
```bash
# Check SSH connection
ssh peter@accesscheck.kiwi

# Ensure SSH key is added
ssh-add ~/.ssh/id_ed25519
```

### Permission Denied on Remote PostgreSQL
```bash
# On remote host, check PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL user permissions
sudo -u postgres psql -c "\du"
```

### Backup/Restore Errors
```bash
# Check PostgreSQL version compatibility
pg_dump --version  # on local
ssh peter@accesscheck.kiwi "pg_restore --version"  # on remote

# Versions should be compatible (remote >= local)
```

### Copy Failed to Remote Mount
```bash
# Check if mount is writable
touch /mnt/remote/tmp/test.txt
rm /mnt/remote/tmp/test.txt

# Check mount status
mount | grep /mnt/remote

# Remount with proper permissions
fusermount -u /mnt/remote
sshfs peter@accesscheck.kiwi:/ /mnt/remote -o allow_other
```

### Database Already Exists Error
The script automatically drops the database. If it fails:
```bash
# Manually drop on remote
ssh peter@accesscheck.kiwi "sudo -u postgres psql -c 'DROP DATABASE gis;'"
```

## Best Practices

1. **Keep SSHFS mounted during development**
   ```bash
   # Mount once at the start of your session
   sshfs peter@accesscheck.kiwi:/ /mnt/remote
   
   # Work normally
   npm run db:deploy
   
   # Unmount when done for the day
   fusermount -u /mnt/remote
   ```

2. **Always backup before deploying**
   ```bash
   npm run db:backup  # Creates local backup first
   ```

3. **Verify mount before deployment**
   ```bash
   # Quick check
   ls /mnt/remote/tmp
   
   # Or let script check automatically (it will error if not mounted)
   ```

4. **Test deployment script first**
   - Ensure SSHFS is properly mounted
   - Try on a test remote server first
   - Verify SSH access works
   - Check remote PostgreSQL permissions

5. **Monitor deployment progress**
   - Script shows colored output for each step
   - Watch for errors in SSH output

6. **Keep recent backups**
   - Don't delete deployment backups immediately
   - Keep at least 3-5 recent backups

7. **Version control**
   - Add `backups/` to `.gitignore`
   - Database dumps can be large

## Security Notes

- Never commit `.env.deploy` with production credentials
- Use SSH keys, not passwords
- Limit PostgreSQL remote access (localhost only recommended)
- Keep backups secure (they contain all your data)
- Consider encrypting backup files for storage

## Add to .gitignore

```gitignore
# Database backups
backups/
*.dump

# Deployment config
.env.deploy
```
