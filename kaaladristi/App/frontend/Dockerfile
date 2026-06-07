# ── Stage 1: Build React/Vite app ────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build-time env vars — baked into the JS bundle by Vite.
# Defaults use the nginx reverse-proxy paths so the container works without
# explicit build args on the VPS (vikuna-nginx proxies /db/ → postgrest).
ARG VITE_POSTGREST_URL=/db
ARG VITE_ANON_KEY=
ARG VITE_PIPELINE_API_URL=
ARG GEMINI_API_KEY=

ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_ANON_KEY=$VITE_ANON_KEY
ENV VITE_PIPELINE_API_URL=$VITE_PIPELINE_API_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing + API proxy to kd-backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
