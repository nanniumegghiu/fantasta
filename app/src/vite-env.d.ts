/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Categoria: PUBBLICA. Progettata per stare nel browser. */
  readonly VITE_SUPABASE_URL?: string
  /** Categoria: PUBBLICA. La protezione vera sono le policy, non la segretezza. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "true" solo se il provider Google e' davvero attivo sul backend. */
  readonly VITE_GOOGLE_ABILITATO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
