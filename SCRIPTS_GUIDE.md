# Server & Database Scripts Guide

## Available npm Scripts

### 1. Local Development (with pg_featureserv)
```bash
npm run dev:all
```
This command:
- Starts the Express server on port 3000
- Connects to local `gis` database
- Starts pg_featureserv instance
- Runs both processes concurrently with colored output

**Prerequisites:**
- PostgreSQL running locally with `gis` database
- pg_featureserv installed and available in PATH

### 2. Server Only (Local Database)
```bash
npm run server:dev
```
Starts just the Express server connected to local `gis` database.

### 3. Database Backup
```bash
npm run db:backup
```
Creates a timestamped backup of your local `gis` database in the `backups/` directory.
- Automatically keeps only the last 10 backups
- Backup format: `gis_backup_YYYYMMDD_HHMMSS.dump`

### 4. Deploy Database to Remote Host ⚠️ **COMMITTER ONLY**
```bash
npm run db:deploy
```
**Note:** This command is for repository committers with deployment access only. Regular contributors do not need this functionality.

Deploys your local database to the remote production host by:
1. Creating a local backup
2. Copying it to the remote host via SSHFS mount (SSH tunnel)
3. Dropping and recreating the remote database
4. Restoring the backup on the remote host

**Prerequisites:**
- SSHFS mount configured at `/mnt/remote` (or custom location)
- SSH access to remote host configured
- Set environment variables: `REMOTE_MOUNT`, `REMOTE_HOST`, `REMOTE_USER`

Example:
```bash
# Make sure SSHFS is mounted first
./scripts/sshfs-helper.sh mount

# Deploy
REMOTE_MOUNT=/mnt/remote REMOTE_HOST=accesscheck.kiwi REMOTE_USER=peter npm run db:deploy
```

### 5. Full Deployment (Build + Database)
```bash
npm run deploy:full
```
Runs the complete deployment:
1. Builds the frontend (`npm run build`)
2. Deploys the database to remote host

### 6. pg_featureserv Only
```bash
npm run pg_featureserv
```
Starts only the pg_featureserv instance using the config in `pg_featurserv_config/pg_featureserv.toml`

## Configuration Files

### `.env.development` (Local)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gis
NODE_ENV=development
```

### `.env.production` (Production Host)
Used when running the server on the production host itself:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gis
NODE_ENV=production
SESSION_SECRET=your-secure-secret-here
```

### `.env.deploy.example` (Deployment Config)
Copy to `.env.deploy` and configure for database deployment:
```env
REMOTE_HOST=your-remote-host.com
REMOTE_USER=peter
REMOTE_DB=gis
```

## Quick Start

### Local Development Setup
```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Make sure PostgreSQL is running
sudo systemctl status postgresql

# 3. Start everything (server + pg_featureserv)
npm run dev:all
```

### Deploying to Production Host
```bash
# 1. Ensure your SSHFS mount is active
# (Use your existing mount setup)

# 2. Deploy database
REMOTE_MOUNT=/mnt/remote REMOTE_HOST=accesscheck.kiwi REMOTE_USER=peter npm run db:deploy
```

### Quick Database Backup
```bash
npm run db:backup
# Creates: backups/gis_backup_YYYYMMDD_HHMMSS.dump
```

## Stopping Processes

For `npm run dev:all` (running concurrently):
- Press `Ctrl+C` once to stop both processes

For individual background processes:
- Use `Ctrl+C` to stop
- Or find and kill: `ps aux | grep node` then `kill <PID>`

## Database Connections

The server always connects locally:

**Development:** `postgresql://postgres:postgres@localhost:5432/gis`
**Production:** `postgresql://postgres:postgres@localhost:5432/gis` (runs on production host)

### Database Deployment Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│  Local Machine  │                    │  Production Host │
│                 │                    │                  │
│  PostgreSQL     │  SSH + pg_dump    │  PostgreSQL      │
│  (gis db)       │ ─────────────────> │  (gis db)       │
│                 │  pg_restore        │                  │
└─────────────────┘                    └──────────────────┘
```

Database is deployed by:
1. Creating a dump of local database
2. Copying dump to remote host via SSH
3. Restoring dump into remote PostgreSQL instance

Both servers run locally on their respective hosts.

## Troubleshooting

### pg_featureserv not found
Install pg_featureserv:
```bash
# Check if installed
which pg_featureserv

# If not, install from https://github.com/CrunchyData/pg_featureserv
```

### Port already in use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill <PID>
```

### Database connection errors
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection manually
psql -U postgres -d gis
```
