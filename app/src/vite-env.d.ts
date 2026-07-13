/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_LOREBOUND_AUTH_ENDPOINT?: string;
  readonly VITE_LOREBOUND_DATABASE_ENDPOINT?: string;
  readonly VITE_LOREBOUND_STORAGE_ENDPOINT?: string;
  readonly VITE_LOREBOUND_DEPLOYMENT_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
