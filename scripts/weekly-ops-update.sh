#!/usr/bin/env bash
# =============================================================================
# weekly-ops-update.sh  —  runs on Acheron at /opt/backup_op/
#
# 1. Regenerates OPERATIONS.md and pushes to private ops repo
#    https://github.com/petergwilson/permomap-ops
#
# 2. Dumps the live database schema (no data) and pushes to public repo
#    https://github.com/petergwilson/permomap  (sql/schema_dump.sql)
#
# Cron: see /etc/cron.d/permomap-backup  (runs every Sunday at 03:00)
#
# First-time setup: run  /opt/backup_op/install.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="/opt/backup_op"
LOG="$SCRIPT_DIR/logs/weekly-ops.log"
CAPTURE_SCRIPT="$SCRIPT_DIR/capture-server-state.sh"
OPS_REPO="$SCRIPT_DIR/permomap-ops"
PUBLIC_REPO="/home/acheronuser/permomap"

# Rotate log: keep last 500 lines
mkdir -p "$SCRIPT_DIR/logs"
[ -f "$LOG" ] && tail -500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

exec >> "$LOG" 2>&1
echo ""
echo "========================================================"
echo " weekly-ops-update  —  $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "========================================================"

# ---------------------------------------------------------------------------
# Load secrets (GITHUB_TOKEN, DB_URL override if needed)
# ---------------------------------------------------------------------------
SECRETS="$SCRIPT_DIR/.env"
if [ ! -f "$SECRETS" ]; then
    echo "ERROR: $SECRETS not found. Run install.sh first and set GITHUB_TOKEN."
    exit 1
fi
# shellcheck source=/dev/null
set -a; . "$SECRETS"; set +a

if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "ERROR: GITHUB_TOKEN is not set in $SECRETS"
    exit 1
fi

# ---------------------------------------------------------------------------
# Resolve database connection string
# Priority: DB_URL in .env > DATABASE_URL in permomap .env.production
# ---------------------------------------------------------------------------
if [ -z "${DB_URL:-}" ]; then
    ENV_PROD="$PUBLIC_REPO/.env.production"
    if [ -f "$ENV_PROD" ]; then
        DB_URL=$(grep -E '^DATABASE_URL=' "$ENV_PROD" | cut -d= -f2- | tr -d '"'"'" | head -1)
    fi
fi
if [ -z "${DB_URL:-}" ]; then
    echo "ERROR: Could not determine database URL. Set DB_URL in $SECRETS."
    exit 1
fi

# ---------------------------------------------------------------------------
# Helper: git push via HTTPS token
# ---------------------------------------------------------------------------
git_push() {
    local repo_dir="$1"
    local remote_url="$2"
    local branch="${3:-main}"
    local commit_msg="$4"

    cd "$repo_dir"
    git config user.email "ops-bot@permomap" 2>/dev/null || true
    git config user.name  "Permomap Ops Bot"  2>/dev/null || true

    # Inject token into remote URL without storing it in .git/config permanently
    local auth_url
    auth_url=$(echo "$remote_url" | sed "s|https://|https://oauth2:${GITHUB_TOKEN}@|")
    git remote set-url origin "$auth_url"

    git pull --rebase --autostash origin "$branch" 2>&1 || true

    if git diff --quiet && git diff --cached --quiet; then
        echo "  [no changes to commit in $repo_dir]"
    else
        git add -A
        git commit -m "$commit_msg"
        git push origin "$branch"
        echo "  [pushed to $remote_url]"
    fi

    # Remove token from remote to avoid accidental exposure in logs
    git remote set-url origin "$remote_url"
}

# ===========================================================================
# STEP 1 — Regenerate OPERATIONS.md in the private ops repo
# ===========================================================================
echo ""
echo "--- Step 1: regenerate server state ---"

if [ ! -d "$OPS_REPO/.git" ]; then
    echo "ERROR: ops repo not cloned at $OPS_REPO. Run install.sh."
    exit 1
fi

# Run the capture script as root (we're already root via cron/sudo)
echo "  Running capture-server-state.sh ..."
bash "$CAPTURE_SCRIPT" 2>/dev/null > /tmp/acheron-state-$$.md

# Splice into OPERATIONS.md
python3 - << PYEOF
import sys

with open('$OPS_REPO/OPERATIONS.md') as f:
    ops = f.read()
with open('/tmp/acheron-state-$$.md') as f:
    state = f.read()

marker = '## Current Server State'
idx = ops.find(marker)
if idx == -1:
    # Append if marker not found
    new_ops = ops + '\n' + marker + '\n\n' + state + '\n'
else:
    new_ops = ops[:idx] + marker + '\n\n' + state + '\n'

with open('$OPS_REPO/OPERATIONS.md', 'w') as f:
    f.write(new_ops)
print('  OPERATIONS.md updated ({} lines)'.format(new_ops.count('\n')))
PYEOF

rm -f /tmp/acheron-state-$$.md

git_push \
    "$OPS_REPO" \
    "https://github.com/petergwilson/permomap-ops" \
    "main" \
    "ops: server state snapshot $(date -u '+%Y-%m-%d')"

# ===========================================================================
# STEP 2 — Dump database schema to the public permomap repo
# ===========================================================================
echo ""
echo "--- Step 2: dump database schema ---"

SCHEMA_FILE="$PUBLIC_REPO/sql/schema_dump.sql"

echo "  Running pg_dump --schema-only ..."
PGPASSWORD="" pg_dump \
    --schema-only \
    --no-owner \
    --no-acl \
    --no-password \
    --dbname="$DB_URL" \
    --file="$SCHEMA_FILE.tmp" 2>&1

# Prepend a timestamp header so the file is self-describing
{
    echo "-- ============================================================"
    echo "-- Permomap database schema dump"
    echo "-- Generated: $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo "-- Source: $(hostname -f)"
    echo "-- pg_dump --schema-only --no-owner --no-acl"
    echo "-- ============================================================"
    echo ""
    cat "$SCHEMA_FILE.tmp"
} > "$SCHEMA_FILE"
rm -f "$SCHEMA_FILE.tmp"

echo "  Schema dump written to $SCHEMA_FILE ($(wc -l < "$SCHEMA_FILE") lines)"

git_push \
    "$PUBLIC_REPO" \
    "https://github.com/petergwilson/permomap" \
    "main" \
    "sql: schema dump $(date -u '+%Y-%m-%d')"

# ===========================================================================
echo ""
echo "Done — $(date -u '+%Y-%m-%d %H:%M UTC')"
