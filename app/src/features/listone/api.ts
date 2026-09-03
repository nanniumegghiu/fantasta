import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { RigaListone, RigaStatistiche, Ruolo } from '@/domain/listone'
import { stagioneCorrente } from '@/domain/stagione'

export type CalciatoreInListone = {
  id: number
  season: string
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
/**
 * Sceglie di quale stagione è il listone.
 *
 * PERCHE' SERVE
 * Nel database possono convivere più stagioni: quella vera, quella dell'anno
 * scorso, e — mentre si lavora — quelle finte delle prove automatiche. Senza
 * questa scelta finivano tutte nella stessa tabella, e chi apriva il listone
 * vedeva «P1 Prova» in mezzo ai calciatori veri. È successo davvero.
 *
 * La regola: si prende la stagione corrente se c'è, altrimenti **quella con
 * più calciatori**. Il secondo caso copre chi ha caricato un listone di
 * un'altra annata: meglio mostrargli il suo listone che una pagina vuota, e
 * la schermata dice comunque quale stagione sta guardando.
 */
export function stagioneDelListone(righe: CalciatoreInListone[]): string | null {
  if (righe.length === 0) return null
  const conta = new Map<string, number>()
  for (const r of righe) conta.set(r.season, (conta.get(r.season) ?? 0) + 1)

  const corrente = stagioneCorrente()
  if (conta.has(corrente)) return corrente

  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * Il listone di **una stagione sola**.
 *
 * Scarica tutto e sceglie qui, invece di filtrare nella richiesta: le righe
 * sono poche decine di kilobyte, e così la scelta della stagione sta in un
 * posto solo per tutte le schermate che usano questo aggancio, compreso il
 * selettore dei calciatori della lista obiettivi.
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

      const stagione = stagioneDelListone(tutti)
      return stagione ? tutti.filter((r) => r.season === stagione) : tutti
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
