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
echo "[docker] Building..."
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
if curl -sf http://localhost:8101/api/pipeline2/ping > /dev/null 2>&1; then
    echo "[check] kd-pipeline-api2 OK"
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
