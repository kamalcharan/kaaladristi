/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTGREST_URL: string;
  readonly VITE_ANON_KEY: string;
  readonly VITE_JWT_SECRET?: string;
  readonly VITE_PIPELINE_API_URL?: string;
  readonly VITE_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
