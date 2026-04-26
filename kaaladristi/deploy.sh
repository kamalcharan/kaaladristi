#!/bin/bash
# DristiQ — VPS deployment script
# Run on the VPS as root after git pull
set -e

COMPOSE_DIR="/opt/vikuna/docker/docker"
APP_DIR="/opt/vikuna/apps/kaaladristi"
ENV_FILE="$COMPOSE_DIR/.env"

echo "=== DristiQ Deploy ==="

# 1. Ensure KD_APP_PASSWORD is in .env
if ! grep -q "KD_APP_PASSWORD" "$ENV_FILE"; then
    echo "KD_APP_PASSWORD=KdApp2026Secure" >> "$ENV_FILE"
    echo "[env] Added KD_APP_PASSWORD to $ENV_FILE"
fi

# 2. Copy VPS nginx config if not already present
NGINX_CONF_SRC="$APP_DIR/nginx/dristiq-vps.conf"
NGINX_CONF_DEST="$COMPOSE_DIR/config/nginx/conf.d/dristiq.conf"
if [ -f "$NGINX_CONF_SRC" ] && [ ! -f "$NGINX_CONF_DEST" ]; then
    cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
    echo "[nginx] Copied dristiq-vps.conf to conf.d/"
fi

# 3. Build new containers
cd "$COMPOSE_DIR"
echo "[docker] Building kd-backend and kd-frontend..."
docker compose build kd-backend kd-frontend

# 4. Start new containers
echo "[docker] Starting containers..."
docker compose up -d kd-backend kd-frontend

# 5. Reload nginx to pick up dristiq.conf
echo "[nginx] Reloading vikuna-nginx..."
docker exec vikuna-nginx nginx -s reload

# 6. Health check
echo "[check] Waiting 5s for backend to start..."
sleep 5
if curl -sf http://localhost:8101/api/pipeline2/ping > /dev/null; then
    echo "[check] kd-backend OK"
else
    echo "[check] WARNING: kd-backend health check failed — check logs:"
    echo "  docker compose logs -f kd-backend --tail 30"
fi

echo ""
echo "=== Deployment complete ==="
echo "  Frontend: http://dristiq.com"
echo "  Backend:  http://dristiq.com/api/pipeline2/health"
echo "  VaNi:     curl -X POST http://dristiq.com/api/vani/daily -H 'Content-Type: application/json' -d '{\"date\":\"$(date +%Y-%m-%d)\"}'"
echo ""
echo "=== SSL (run once after HTTP confirmed working) ==="
echo "  docker exec vikuna-nginx sh -c \\"
echo "    'apk add --no-cache certbot certbot-nginx && \\"
echo "     certbot --nginx -d dristiq.com \\"
echo "     --non-interactive --agree-tos -m admin@vikuna.io'"
