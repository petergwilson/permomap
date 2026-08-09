#!/usr/bin/env bash
# =============================================================================
# capture-server-state.sh
# Dumps a markdown snapshot of the Acheron VPS configuration for OPERATIONS.md.
# Read-only — makes no changes to the system.
#
# Usage (run as root or a user with sudo):
#   sudo bash scripts/capture-server-state.sh > /tmp/server-state.md
#   # Review, then paste the output into the "Current Server State" section
#   # of OPERATIONS.md and commit.
#
# Alternatively, let it append directly:
#   sudo bash scripts/capture-server-state.sh >> OPERATIONS.md
# =============================================================================

set -euo pipefail

hr() { printf '\n---\n\n'; }
h2() { printf '\n## %s\n\n' "$*"; }
h3() { printf '\n### %s\n\n' "$*"; }
code() { printf '```\n'; "$@" 2>&1 || true; printf '```\n'; }
codefile() { printf '```\n'; cat "$1" 2>/dev/null || echo "(not found: $1)"; printf '```\n'; }

printf '# Server State Snapshot\n'
printf '_Generated: %s_\n' "$(date -u '+%Y-%m-%d %H:%M UTC')"
printf '_Host: %s_\n' "$(hostname -f 2>/dev/null || hostname)"

# =============================================================================
h2 "Operating System"
code lsb_release -a
printf '\n**Kernel:** '
uname -r

# =============================================================================
h2 "Hardware / Resources"
h3 "CPU"
code nproc --all
code lscpu | grep -E "^(Model name|Socket|Core|Thread|CPU\(s\))"

h3 "Memory"
code free -h

h3 "Disk"
code df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs

# =============================================================================
h2 "Installed Packages (key)"
code dpkg-query -W -f='${Package}\t${Version}\n' \
    apache2 \
    docker.io docker-ce docker-ce-cli containerd.io \
    certbot python3-certbot-apache \
    postgresql-client \
    ufw \
    git curl wget \
    2>/dev/null | column -t

# =============================================================================
h2 "PostgreSQL"
h3 "Version and clusters"
code pg_lsclusters 2>/dev/null || pg_ctlcluster --version 2>/dev/null || echo "(pg_lsclusters not available)"
h3 "Listening port"
code ss -tlnp | grep postgres || echo "(no postgres listener found)"
h3 "pg_hba.conf"
HBA=$(sudo find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
[ -n "$HBA" ] && codefile "$HBA" || echo "(pg_hba.conf not found)"

# =============================================================================
h2 "Systemd services — unit files"
for svc in permomap-server postgrest pg_featureserv pg_tileserv nzhgpa-api; do
    if systemctl list-unit-files "${svc}.service" --no-legend 2>/dev/null | grep -q "$svc"; then
        printf '\n### %s\n\n' "$svc"
        code systemctl cat "${svc}.service"
    fi
done

# =============================================================================
h2 "PostgREST"
h3 "Config"
PGREST_CONF=""
for candidate in /opt/postgrest/postgrest.conf /etc/postgrest/postgrest.conf /etc/postgrest.conf; do
    [ -f "$candidate" ] && PGREST_CONF="$candidate" && break
done
if [ -n "$PGREST_CONF" ]; then
    printf '```\n'
    # Mask password in db-uri (e.g. db-uri = "postgresql://user:PASS@host/db")
    sudo grep -v '^\s*#' "$PGREST_CONF" | \
        sed 's|\(://[^:]*:\)[^@]*@|\1****@|g' || true
    printf '```\n'
else
    echo "(postgrest.conf not found in common locations)"
fi

# =============================================================================
h2 "Apache2"
h3 "Version"
code apache2 -v

h3 "Loaded modules"
code apache2ctl -M 2>/dev/null | sort

h3 "Enabled sites"
code ls -1 /etc/apache2/sites-enabled/

h3 "Virtual host configs"
for f in /etc/apache2/sites-enabled/*.conf; do
    printf '\n#### %s\n\n' "$(basename "$f")"
    codefile "$f"
done

# =============================================================================
h2 "SSL / Let's Encrypt"
code certbot certificates 2>/dev/null || echo "(certbot not available or no certs)"

h3 "Certbot systemd timer"
code systemctl status certbot.timer 2>/dev/null || echo "(no certbot timer)"

# =============================================================================
h2 "Firewall (ufw)"
code ufw status verbose 2>/dev/null || echo "(ufw not active or not installed)"

# =============================================================================
h2 "Systemd — enabled services"
code systemctl list-unit-files --type=service --state=enabled \
    --no-legend --no-pager 2>/dev/null | sort

h3 "Failed units"
code systemctl --failed --no-legend --no-pager 2>/dev/null || true

# =============================================================================
h2 "Cron jobs"
h3 "/etc/crontab"
codefile /etc/crontab

h3 "/etc/cron.d/"
for f in /etc/cron.d/*; do
    [ -f "$f" ] || continue
    printf '\n#### %s\n\n' "$(basename "$f")"
    codefile "$f"
done

h3 "Root crontab"
code crontab -l 2>/dev/null || echo "(no root crontab)"

# =============================================================================
h2 "Key File Paths"
cat <<'EOF'
| Path | Purpose |
|------|---------|
| `/var/www/permomap/` | Static web root (built Vite client) |
| `/etc/apache2/sites-enabled/permomap.wilsonenv.nz.conf` | Apache virtual host |
| `/etc/letsencrypt/live/permomap.wilsonenv.nz/` | TLS certificate |
| `/etc/letsencrypt/live/geoserver.wilsonenv.nz/` | TLS certificate for pg_featureserv |
| `~/permomap/` | Application repository / Docker Compose project root |
| `/var/log/apache2/permomap_error.log` | Apache error log |
| `/var/log/apache2/permomap_access.log` | Apache access log |
EOF

# =============================================================================
h2 "Network"
h3 "Listening ports"
code ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null || echo "(ss/netstat not available)"

h3 "DNS resolution check"
code host permomap.wilsonenv.nz 2>/dev/null || true

# =============================================================================
h2 "Environment files (keys only — values redacted)"
for envfile in \
    /home/acheronuser/permomap/.env.production \
    /home/acheronuser/permomap/.env \
    /opt/postgrest/postgrest.conf \
    /var/www/html/api/.env; do
    [ -f "$envfile" ] || continue
    printf '\n### %s\n\n```\n' "$envfile"
    sudo grep -v '^\s*#' "$envfile" 2>/dev/null \
        | grep -v '^\s*$' \
        | sed 's/\(=\|="\).*/= (redacted)/'
    printf '```\n'
done

hr
printf '_End of snapshot — %s_\n' "$(date -u '+%Y-%m-%d %H:%M UTC')"
