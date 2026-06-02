# ── Stage 1: Build React/Vite app ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Install deps
COPY App/frontend/package*.json ./
RUN npm ci

# Copy source
COPY App/frontend/ .

# Build-time env vars — baked into JS bundle by Vite
ARG VITE_POSTGREST_URL
ARG VITE_PIPELINE_API_URL
ARG VITE_ANON_KEY
ARG GEMINI_API_KEY
ARG VITE_RAZORPAY_KEY_ID

ENV VITE_POSTGREST_URL=$VITE_POSTGREST_URL
ENV VITE_PIPELINE_API_URL=$VITE_PIPELINE_API_URL
ENV VITE_ANON_KEY=$VITE_ANON_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID

RUN npm run build

# ── Stage 2: Nginx — serves static files + proxies API ───────────────────────
FROM nginx:1.27-alpine

# Static frontend files
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Reverse proxy config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.dpkg-old 2>/dev/null; exit 0

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
