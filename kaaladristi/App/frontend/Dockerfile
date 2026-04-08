# ── Stage 1: Build React/Vite app ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (cached layer)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build-time env vars — baked into the JS bundle by Vite
# Passed via docker-compose build args
ARG VITE_POSTGREST_URL
ARG VITE_ANON_KEY
ARG VITE_PIPELINE_API_URL
ARG GEMINI_API_KEY

ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_ANON_KEY=$VITE_ANON_KEY
ENV VITE_PIPELINE_API_URL=$VITE_PIPELINE_API_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# ── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config comes from the compose-level nginx service — not needed here
# (this image only serves static files; reverse proxy is a separate nginx container)

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
