import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env — check App/frontend/ first, then App/ (one level up) as fallback.
    // Both locations are valid: .env.example lives in App/frontend/,
    // but older setups may have placed .env in App/.
    const envFrontend = loadEnv(mode, __dirname, '');
    const envParent   = loadEnv(mode, path.resolve(__dirname, '..'), '');
    const env         = { ...envParent, ...envFrontend }; // frontend takes priority

    // Dev proxy — mirrors nginx routing in production.
    //
    // POSTGREST_URL  = direct PostgREST origin (e.g. http://localhost:3000)
    //                  → used by the proxy; /db prefix is stripped before forwarding
    // VITE_POSTGREST_URL = full public URL including path (e.g. http://VPS_IP/db)
    //                  → when set, postgrest.ts uses it as an absolute BASE_URL
    //                    and the proxy is bypassed entirely
    const postgrestProxy = (env.POSTGREST_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const pipelineProxy  = (env.VITE_PIPELINE_API_URL || 'http://localhost:8100').replace(/\/+$/, '');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // /db/* → PostgREST (strip /db prefix, PostgREST is at its root)
          '/db': {
            target: postgrestProxy,
            rewrite: (p) => p.replace(/^\/db/, ''),
            changeOrigin: true,
          },
          // /api/* → pipeline FastAPI
          '/api': {
            target: pipelineProxy,
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
