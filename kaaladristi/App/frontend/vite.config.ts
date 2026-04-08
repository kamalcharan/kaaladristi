import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env from App/frontend/ (where .env lives alongside .env.example)
    const env = loadEnv(mode, __dirname, '');

    // PostgREST target for the dev proxy.
    // In production nginx handles /db/ → postgrest:3000.
    // In local dev Vite proxies /db/ → this URL.
    const postgrestTarget = (
      env.POSTGREST_URL ||
      env.VITE_POSTGREST_URL ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');

    // Strip any path suffix (e.g. "/db") so the target is just the origin
    const postgrestOrigin = postgrestTarget.replace(/\/db\/?$/, '');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Mirror nginx:  /db/* → postgrest/*
          '/db': {
            target: postgrestOrigin,
            rewrite: (p) => p.replace(/^\/db/, ''),
            changeOrigin: true,
          },
          // Also proxy /api/* → pipeline-api for local dev
          '/api': {
            target: env.VITE_PIPELINE_API_URL || 'http://localhost:8100',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
