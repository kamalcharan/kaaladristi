/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTGREST_URL: string;
  readonly VITE_ANON_KEY: string;
  readonly VITE_JWT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
