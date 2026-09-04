#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# LMS — one-shot deployment script for a plain VPS (no Docker)
#
#   Ubuntu 22.04 / 24.04 recommended. Run as root:
#       sudo bash deploy/setup.sh
#
# What it does:
#   1. Installs Node.js 20 (nodesource), nginx, git, rsync
#   2. Copies this repo to /opt/lms (skips node_modules / .git / dummy data)
#   3. Prepares backend/.env (keeps an existing one, fills FRONTEND_URL)
#   4. Installs backend deps, builds the frontend, runs DB migrations
#   5. Installs the systemd service + nginx site and starts everything
#
# Idempotent: safe to re-run after a `git pull` to redeploy.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/lms"
SERVICE_NAME="lms-backend"

log()  { echo -e "\n\033[1;36m==> $*\033[0m"; }
warn() { echo -e "\n\033[1;33m!! $*\033[0m"; }
die()  { echo -e "\n\033[1;31m✗ $*\033[0m" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run as root: sudo bash $0"

SERVER_IP="$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$SERVER_IP" ] || SERVER_IP="127.0.0.1"
log "Server IP detected: $SERVER_IP"

# ── 1. System packages ───────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
    log "Installing Node.js 20 LTS (nodesource)"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Installing nginx, git, rsync"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx git rsync

# ── 2. Copy the app into place ───────────────────────────────────────────────
log "Copying repo to $APP_DIR"
mkdir -p "$APP_DIR"
rsync -a --delete \
      --exclude node_modules --exclude .git --exclude dist --exclude dummy \
      --exclude '*.env' --exclude .env --exclude .env.* \
      "$REPO_SRC/" "$APP_DIR/"

# ── 3. Backend environment ───────────────────────────────────────────────────
BACKEND_ENV="$APP_DIR/backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
    log "Creating backend/.env from template — you MUST fill in the values next."
    cp "$APP_DIR/backend/.env.example" "$BACKEND_ENV"
    sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$BACKEND_ENV"
    warn "Open $BACKEND_ENV and set at least:"
    warn "  DATABASE_URL (Neon Postgres connection string)"
    warn "  JWT_SECRET      (node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\")"
    warn "  SUPER_ADMIN_PASSWORD  (migrations refuse to run without it in production)"
    warn "  RESEND_API_KEY / CLOUDINARY_* (optional: email OTP, file uploads)"
    die "Edit $BACKEND_ENV, then re-run: sudo bash $REPO_SRC/deploy/setup.sh"
else
    log "Keeping existing backend/.env"
fi

# FRONTEND_URL — must point at the public origin, never localhost
if grep -qE '^FRONTEND_URL=http://localhost' "$BACKEND_ENV" || ! grep -q '^FRONTEND_URL=' "$BACKEND_ENV"; then
    log "Setting FRONTEND_URL=http://$SERVER_IP"
    sed -i '/^FRONTEND_URL=/d' "$BACKEND_ENV"
    echo "FRONTEND_URL=http://$SERVER_IP" >> "$BACKEND_ENV"
fi

# ── 4. Install deps + build frontend ─────────────────────────────────────────
log "Installing backend dependencies"
cd "$APP_DIR/backend"
npm ci --omit=dev 2>/dev/null || npm ci

log "Installing frontend dependencies and building"
cd "$APP_DIR/frontend"
npm ci
npm run build

# ── 5. Run database migrations ───────────────────────────────────────────────
log "Running database migrations"
cd "$APP_DIR/backend"
if npm run migrate; then
    log "Migrations OK"
else
    warn "Migrations failed — fix backend/.env and re-run: cd /opt/lms/backend && npm run migrate"
fi

# ── 6. systemd service ───────────────────────────────────────────────────────
log "Installing systemd service"
sed "s|/opt/lms|$APP_DIR|g" "$REPO_SRC/deploy/lms-backend.service" > /etc/systemd/system/$SERVICE_NAME.service
systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME

# ── 7. nginx site ────────────────────────────────────────────────────────────
log "Installing nginx site"
sed "s|/opt/lms|$APP_DIR|g" "$REPO_SRC/deploy/nginx-lms.conf" > /etc/nginx/sites-available/lms
ln -sf /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/lms
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# ── 8. Done ──────────────────────────────────────────────────────────────────
sleep 2
log "Deployment complete 🎉"
echo "  ┌──────────────────────────────────────────────────────────┐"
echo "  │  Open:  http://$SERVER_IP                                  │"
echo "  │  Health: curl http://$SERVER_IP/api/health                │"
echo "  └──────────────────────────────────────────────────────────┘"
systemctl --no-pager status $SERVICE_NAME | head -8 || true