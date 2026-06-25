import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve(__dirname, '..'), '');

    const postgrestTarget = env.VITE_POSTGREST_URL?.trim() || 'http://localhost:3000';
    const pipelineTarget  = env.VITE_PIPELINE_API_URL?.trim() || 'http://localhost:8101';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // PostgREST — /db/km_equity_eod → <postgrestTarget>/km_equity_eod
          '/db': {
            target: postgrestTarget,
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/db/, ''),
          },
          // Pipeline FastAPI — /pipeline-api/api/scan/... → <pipelineTarget>/api/scan/...
          '/pipeline-api': {
            target: pipelineTarget,
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/pipeline-api/, ''),
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // In dev, override API URL env vars to use the Vite proxy paths.
        // This fixes CORS — the browser only ever talks to localhost.
        // All 30+ call sites pick this up automatically with no per-file changes.
        'import.meta.env.VITE_PIPELINE_API_URL': JSON.stringify(
          mode === 'development' ? '/pipeline-api' : (env.VITE_PIPELINE_API_URL || '')
        ),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
