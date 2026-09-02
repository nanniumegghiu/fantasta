import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client del backend.
 *
 * Se le variabili d'ambiente mancano, il client NON viene creato e l'app lo
 * dice apertamente invece di fallire con errori incomprensibili a ogni schermata.
 * Vedi la regola "niente bugie all'utente" in CLAUDE.md.
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const chiaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const backendConfigurato = Boolean(url && chiaveAnonima)

export const supabase: SupabaseClient | null = backendConfigurato
  ? createClient(url as string, chiaveAnonima as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Da usare dove il client e' indispensabile: fallisce forte invece che in silenzio. */
export function richiediSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Backend non configurato: mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY in app/.env.local',
    )
  }
  return supabase
}
