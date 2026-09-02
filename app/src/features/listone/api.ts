import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { RigaListone, RigaStatistiche, Ruolo } from '@/domain/listone'

export type CalciatoreInListone = {
  id: number
  name: string
  role: Ruolo
  serie_a_team: string
  quotation: number
  photo_path: string | null
  active: boolean
  matchday: number | null
  games_played: number | null
  minutes: number | null
  avg_vote: number | null
  fanta_avg: number | null
  goals: number | null
  assists: number | null
  yellow_cards: number | null
  red_cards: number | null
}

/**
 * Scarica il listone intero una volta sola.
 *
 * Seicento righe con le statistiche già unite pesano poche decine di kilobyte:
 * conviene averle tutte in memoria e filtrare sul dispositivo, invece di
 * interrogare il server a ogni cambio di filtro. Durante l'asta la reattività
 * conta più del traffico risparmiato.
 */
export function useListone() {
  return useQuery({
    queryKey: ['listone'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CalciatoreInListone[]> => {
      const sb = richiediSupabase()
      const tutti: CalciatoreInListone[] = []
      const passo = 1000
      for (let da = 0; ; da += passo) {
        const { data, error } = await sb
          .from('listone')
          .select('*')
          .eq('active', true)
          .order('quotation', { ascending: false })
          .range(da, da + passo - 1)
        if (error) throw new Error(messaggioErrore(error))
        const righe = (data ?? []) as CalciatoreInListone[]
        tutti.push(...righe)
        if (righe.length < passo) break
      }
      return tutti
    },
  })
}

/** La giornata a cui sono aggiornate le statistiche, o null se non ce ne sono. */
export function giornataAggiornamento(righe: CalciatoreInListone[]): number | null {
  for (const r of righe) if (r.matchday != null) return r.matchday
  return null
}

export function useSonoAmministratoreApp() {
  return useQuery({
    queryKey: ['sono-admin-app'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await richiediSupabase().rpc('e_admin_app')
      if (error) throw new Error(messaggioErrore(error))
      return data === true
    },
  })
}

export type EsitoImportazioneListone = {
  esito: 'ok' | 'non_autorizzato' | 'file_vuoto'
  messaggio: string
  inseriti: number
  aggiornati: number
  ritirati: number
}

export function useImportaListone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      stagione: string
      righe: RigaListone[]
    }): Promise<EsitoImportazioneListone> => {
      const { data, error } = await richiediSupabase().rpc('importa_listone', {
        p_stagione: v.stagione,
        p_righe: v.righe,
      })
      if (error) throw new Error(messaggioErrore(error))
      const righe = (data ?? []) as EsitoImportazioneListone[]
      if (!righe[0]) throw new Error('Il server non ha risposto come previsto.')
      return righe[0]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listone'] }),
  })
}

export type EsitoImportazioneStatistiche = {
  esito: 'ok' | 'non_autorizzato' | 'file_vuoto'
  messaggio: string
  aggiornati: number
  ignorati: number
}

export function useImportaStatistiche() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      stagione: string
      giornata: number
      righe: RigaStatistiche[]
    }): Promise<EsitoImportazioneStatistiche> => {
      const { data, error } = await richiediSupabase().rpc('importa_statistiche', {
        p_stagione: v.stagione,
        p_giornata: v.giornata,
        p_righe: v.righe,
      })
      if (error) throw new Error(messaggioErrore(error))
      const righe = (data ?? []) as EsitoImportazioneStatistiche[]
      if (!righe[0]) throw new Error('Il server non ha risposto come previsto.')
      return righe[0]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listone'] }),
  })
}
