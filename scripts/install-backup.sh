#!/usr/bin/env bash
# =============================================================================
# install-backup.sh  —  run once on Acheron to set up /opt/backup_op/
#
# Usage (from your laptop):
#   scp -i ~/.ssh/acheron_key_2.pem scripts/install-backup.sh \
#       acheronuser@100.123.18.16:/tmp/install-backup.sh
#   ssh -i ~/.ssh/acheron_key_2.pem acheronuser@100.123.18.16 \
#       "sudo bash /tmp/install-backup.sh"
#
# You will be prompted for your GitHub personal access token.
# The token needs:  repo (read+write) on permomap-ops and permomap
# =============================================================================

set -euo pipefail

BACKUP_DIR="/opt/backup_op"
OPS_REPO_URL="https://github.com/petergwilson/permomap-ops"
PUBLIC_REPO_DIR="/home/acheronuser/permomap"
SCRIPT_SRC="$PUBLIC_REPO_DIR/scripts"
RUN_AS="acheronuser"

echo "=== Permomap backup setup ==="

# ---------------------------------------------------------------------------
# 1. Create directory structure
# ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR/logs"
chown -R "$RUN_AS:$RUN_AS" "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"
echo "[1/6] Created $BACKUP_DIR"

# ---------------------------------------------------------------------------
# 2. Copy scripts from the permomap repo
# ---------------------------------------------------------------------------
cp "$SCRIPT_SRC/capture-server-state.sh" "$BACKUP_DIR/capture-server-state.sh"
cp "$SCRIPT_SRC/weekly-ops-update.sh"    "$BACKUP_DIR/weekly-ops-update.sh"
chmod +x "$BACKUP_DIR/capture-server-state.sh" "$BACKUP_DIR/weekly-ops-update.sh"
echo "[2/6] Scripts copied to $BACKUP_DIR"

# ---------------------------------------------------------------------------
# 3. Create .env with GitHub token
# ---------------------------------------------------------------------------
SECRETS="$BACKUP_DIR/.env"
if [ -f "$SECRETS" ]; then
    echo "[3/6] $SECRETS already exists — skipping (delete and re-run to reset)"
else
    echo ""
    echo "Enter your GitHub Personal Access Token."
    echo "Needs 'Contents: Read and write' on both repos."
    echo "Create one at: https://github.com/settings/tokens?type=beta"
    echo ""
    read -rsp "GitHub PAT: " GH_TOKEN
    echo ""
    cat > "$SECRETS" << EOF
# Permomap ops backup secrets — keep this file private (chmod 600)
GITHUB_TOKEN=${GH_TOKEN}

# Optional: override the database connection string
# Default is read from /home/acheronuser/permomap/.env.production
# DB_URL=postgresql://user:pass@localhost:7432/dbname
EOF
    chmod 600 "$SECRETS"
    chown "$RUN_AS:$RUN_AS" "$SECRETS"
    echo "[3/6] $SECRETS created (chmod 600)"
fi

# ---------------------------------------------------------------------------
# 4. Clone the private ops repo
# ---------------------------------------------------------------------------
OPS_REPO_DIR="$BACKUP_DIR/permomap-ops"
if [ -d "$OPS_REPO_DIR/.git" ]; then
    echo "[4/6] $OPS_REPO_DIR already cloned — skipping"
else
    # Load the token to clone
    # shellcheck source=/dev/null
    set -a; . "$SECRETS"; set +a
    AUTH_URL=$(echo "$OPS_REPO_URL" | sed "s|https://|https://oauth2:${GITHUB_TOKEN}@|")
    sudo -u "$RUN_AS" git clone "$AUTH_URL" "$OPS_REPO_DIR"
    # Remove token from remote immediately
    cd "$OPS_REPO_DIR"
    git remote set-url origin "$OPS_REPO_URL"
    chown -R "$RUN_AS:$RUN_AS" "$OPS_REPO_DIR"
    echo "[4/6] Cloned $OPS_REPO_URL to $OPS_REPO_DIR"
fi

# ---------------------------------------------------------------------------
# 5. Ensure the public permomap repo is a proper git repo
# ---------------------------------------------------------------------------
if [ ! -d "$PUBLIC_REPO_DIR/.git" ]; then
    echo "[5/6] WARNING: $PUBLIC_REPO_DIR is not a git repo — schema push will fail"
    echo "      Run: git clone https://github.com/petergwilson/permomap $PUBLIC_REPO_DIR"
else
    echo "[5/6] Public repo at $PUBLIC_REPO_DIR OK"
fi

# ---------------------------------------------------------------------------
# 6. Install cron job
# ---------------------------------------------------------------------------
CRON_FILE="/etc/cron.d/permomap-backup"
cat > "$CRON_FILE" << 'CRONEOF'
# Permomap weekly ops snapshot and schema dump
# Runs every Sunday at 03:15 server time (UTC)
# Logs: /opt/backup_op/logs/weekly-ops.log
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

15 3 * * 0  root  bash /opt/backup_op/weekly-ops-update.sh
CRONEOF
chmod 644 "$CRON_FILE"
echo "[6/6] Cron job installed at $CRON_FILE (Sundays 03:15 UTC)"

# ---------------------------------------------------------------------------
echo ""
echo "=== Setup complete ==="
echo ""
echo "Test with:  sudo bash /opt/backup_op/weekly-ops-update.sh"
echo "Logs at:    /opt/backup_op/logs/weekly-ops.log"
echo ""
echo "To update scripts after a git pull:"
echo "  cp /home/acheronuser/permomap/scripts/capture-server-state.sh /opt/backup_op/"
echo "  cp /home/acheronuser/permomap/scripts/weekly-ops-update.sh    /opt/backup_op/"
