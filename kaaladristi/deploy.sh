#!/bin/bash
# DristiQ — VPS deployment script
# Run from: /opt/vikuna/apps/kaaladristi/kaaladristi/
set -e

APP_DIR="/opt/vikuna/apps/kaaladristi/kaaladristi"
VIKUNA_DIR="/opt/vikuna/docker/docker"
NGINX_CONF_SRC="$APP_DIR/nginx/dristiq-vps.conf"
NGINX_CONF_DEST="$VIKUNA_DIR/config/nginx/conf.d/dristiq.conf"
ENV_FILE="$APP_DIR/.env"

echo "=== DristiQ Deploy ==="
cd "$APP_DIR"

# 1. Git pull
echo "[git] Pulling latest..."
git pull origin main

# 2. Check .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "[env] ERROR: $ENV_FILE not found. Create it from .env.example first."
    exit 1
fi

# 3. Copy nginx config (only on first deploy)
if [ ! -f "$NGINX_CONF_DEST" ]; then
    cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
    echo "[nginx] Copied dristiq.conf to conf.d/"
fi

# 4. Build containers
# Stamp the bundle with the commit being deployed (sidebar footer + console).
export VITE_BUILD_SHA="$(git rev-parse --short HEAD)"
echo "[docker] Building $VITE_BUILD_SHA..."
docker compose --env-file "$ENV_FILE" build pipeline-api2 kd-frontend

# 5. Start containers
echo "[docker] Starting..."
docker compose --env-file "$ENV_FILE" up -d pipeline-api2 kd-frontend

# 6. Reload vikuna-nginx
echo "[nginx] Reloading..."
docker exec vikuna-nginx nginx -s reload

# 7. Health check
echo "[check] Waiting 8s for backend..."
sleep 8
# /internal/health is the ops probe (no nginx location — in-network only);
# /api/pipeline2/ping now requires a user token (Phase 1a). Port 8101 is NOT
# published to the host, so the probe runs INSIDE the container. The image is
# python:3.11-slim — no curl, no wget — so it is a stdlib urllib one-liner.
HEALTH_JSON="$(docker exec kd-pipeline-api2 python -c 'import json,sys,urllib.request as u
r=u.urlopen("http://127.0.0.1:8101/internal/health",timeout=5); b=r.read().decode(); print(b)
sys.exit(0 if r.status==200 and json.loads(b).get("ok") is True else 1)' 2>/dev/null)"
if [ $? -eq 0 ]; then
    echo "[check] kd-pipeline-api2 OK: $HEALTH_JSON"
else
    echo "[check] WARNING: health check failed — check logs:"
    echo "  docker compose logs kd-pipeline-api2 --tail 30"
fi

echo ""
echo "=== Deploy complete ==="
echo "  Site:    http://dristiq.com"
echo "  API:     http://dristiq.com/api/pipeline2/health"
echo "  VaNi:    curl -X POST http://dristiq.com/api/vani/daily -H 'Content-Type: application/json' -d '{\"date\":\"$(date +%Y-%m-%d)\"}'"
echo ""
echo "=== SSL — run once after HTTP confirmed working ==="
echo "  certbot --nginx -d dristiq.com (inside vikuna-nginx container)"
