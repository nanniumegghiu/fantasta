import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { Ruolo } from '@/domain/listone'

export type StatoAsta = 'draft' | 'open' | 'paused' | 'closed'

export type Asta = {
  id: string
  league_id: string
  status: StatoAsta
  method: 'chiamata' | 'alfabetico' | 'random'
  variant: 'totale' | 'per_ruolo' | 'ibrida'
  conduction: 'app' | 'live'
  bid_type: 'libera' | 'con_passo'
  inactivity_seconds: number
  countdown_seconds: number
  nomination_order: string[]
  current_turn_index: number
  current_role_phase: 'P' | 'D' | 'C' | 'A' | null
  random_pool_filter: { quotazione_minima?: number }
}

export type CalciatoreInAsta = {
  id: number
  name: string
  role: Ruolo
  serie_a_team: string
  quotation: number
  photo_path: string | null
}

export type StatistichePubbliche = {
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

export type Lotto = {
  id: string
  auction_id: string
  player_id: number
  status: 'open' | 'awarded' | 'passed' | 'cancelled'
  nominated_by_team_id: string | null
  current_bid: number
  current_bidder_team_id: string | null
  last_bid_at: string
  players: CalciatoreInAsta & { player_stats: StatistichePubbliche | null }
}

export type BudgetSquadra = {
  team_id: string
  league_id: string
  user_id: string
  name: string
  credits_remaining: number
  presi_p: number
  presi_d: number
  presi_c: number
  presi_a: number
  presi_totali: number
  slot_rimanenti: number
  massimo_offribile: number
}

export type AcquistoInRosa = {
  id: string
  team_id: string
  player_id: number
  price: number
  players: CalciatoreInAsta
}

// ─── L'asta e il lotto in corso ─────────────────────────────────────────────

export function useAsta(idLega: string | undefined) {
  return useQuery({
    queryKey: ['asta', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<Asta | null> => {
      const { data, error } = await richiediSupabase()
        .from('auctions')
        .select('*')
        .eq('league_id', idLega!)
        .maybeSingle()
      if (error) throw new Error(messaggioErrore(error))
      return (data as Asta) ?? null
    },
  })
}

export function useLottoCorrente(idAsta: string | undefined) {
  return useQuery({
    queryKey: ['lotto', idAsta],
    enabled: Boolean(idAsta),
    queryFn: async (): Promise<Lotto | null> => {
      const { data, error } = await richiediSupabase()
        .from('auction_lots')
        .select(
          '*, players(id,name,role,serie_a_team,quotation,photo_path,player_stats(matchday,games_played,minutes,avg_vote,fanta_avg,goals,assists,yellow_cards,red_cards))',
        )
        .eq('auction_id', idAsta!)
        .eq('status', 'open')
        .maybeSingle()
      if (error) throw new Error(messaggioErrore(error))
      return (data as unknown as Lotto) ?? null
    },
  })
}

export function useBudgetSquadre(idLega: string | undefined) {
  return useQuery({
    queryKey: ['budget', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<BudgetSquadra[]> => {
      const { data, error } = await richiediSupabase()
        .from('team_budget')
        .select('*')
        .eq('league_id', idLega!)
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []) as BudgetSquadra[]
    },
  })
}

export function useRose(idLega: string | undefined) {
  return useQuery({
    queryKey: ['rose', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<AcquistoInRosa[]> => {
      const { data, error } = await richiediSupabase()
        .from('roster_players')
        .select('id,team_id,player_id,price,players(id,name,role,serie_a_team,quotation,photo_path)')
        .eq('league_id', idLega!)
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []) as unknown as AcquistoInRosa[]
    },
  })
}

/** Gli identificativi dei calciatori già comprati: servono a togliere righe dal listone. */
export function useAcquistati(idLega: string | undefined) {
  const { data } = useRose(idLega)
  return new Set((data ?? []).map((r) => r.player_id))
}

// ─── Aggiornamenti in tempo reale ───────────────────────────────────────────

/**
 * Tiene allineate tutte le superfici della stessa lega.
 *
 * Alla notifica non si prova a indovinare cosa è cambiato: si ricarica il
 * pezzo interessato. Con dieci persone e pochi eventi al minuto è il modo più
 * semplice per non avere mai due schermi che raccontano cose diverse.
 */
export function useCanaleAsta(idLega: string | undefined) {
  const qc = useQueryClient()
  const [connesso, setConnesso] = useState(false)

  useEffect(() => {
    if (!idLega) return
    const sb = richiediSupabase()
    const canale = sb.channel(`asta-${idLega}`)

    const ricarica = () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lotto'] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
      qc.invalidateQueries({ queryKey: ['rose', idLega] })
    }

    for (const tabella of ['auctions', 'auction_lots', 'bids', 'roster_players', 'teams']) {
      canale.on('postgres_changes', { event: '*', schema: 'public', table: tabella }, ricarica)
    }

    canale.subscribe((stato) => setConnesso(stato === 'SUBSCRIBED'))
    return () => {
      void sb.removeChannel(canale)
    }
  }, [idLega, qc])

  return { connesso }
}

// ─── Lo scarto fra l'orologio del dispositivo e quello del server ───────────

/**
 * Se l'orologio di un telefono è indietro di cinque secondi, quel telefono
 * vedrebbe cinque secondi in più di countdown. Si misura lo scarto una volta e
 * lo si applica a ogni calcolo: due righe che evitano la domanda «ma perché
 * sul mio ne segna ancora tre?».
 */
export function useScartoOrologio(): number {
  const [scarto, setScarto] = useState(0)
  const misurato = useRef(false)

  useEffect(() => {
    if (misurato.current) return
    misurato.current = true
    const url = import.meta.env.VITE_SUPABASE_URL
    if (!url) return
    const prima = Date.now()
    fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '' },
    })
      .then((r) => {
        const intestazione = r.headers.get('date')
        if (!intestazione) return
        const dopo = Date.now()
        const oraServer = new Date(intestazione).getTime()
        // Si toglie metà del viaggio di andata e ritorno.
        setScarto(oraServer - (prima + (dopo - prima) / 2))
      })
      .catch(() => {
        // Senza misura si usa l'orologio locale: meglio di niente.
      })
  }, [])

  return scarto
}

// ─── Azioni ─────────────────────────────────────────────────────────────────

type EsitoSemplice = { esito: string; messaggio: string }

async function chiamaFunzione<T>(nome: string, argomenti: Record<string, unknown>): Promise<T> {
  const { data, error } = await richiediSupabase().rpc(nome, argomenti)
  if (error) throw new Error(messaggioErrore(error))
  const righe = (data ?? []) as T[]
  const prima = Array.isArray(righe) ? righe[0] : (righe as T)
  if (!prima) throw new Error('Il server non ha risposto come previsto.')
  return prima
}

export type ImpostazioniAsta = {
  metodo: 'chiamata' | 'alfabetico' | 'random'
  variante: 'totale' | 'per_ruolo' | 'ibrida'
  conduzione: 'app' | 'live'
  tipoChiamata: 'libera' | 'con_passo'
  secondiInattivita: number
  secondiCountdown: number
  quotazioneMinima: number | null
}

export function useConfiguraAsta(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: ImpostazioniAsta): Promise<EsitoSemplice> =>
      chiamaFunzione('configura_asta', {
        p_lega: idLega,
        p_metodo: v.metodo,
        p_variante: v.variante,
        p_conduzione: v.conduzione,
        p_tipo_chiamata: v.tipoChiamata,
        p_secondi_inattivita: v.secondiInattivita,
        p_secondi_countdown: v.secondiCountdown,
        p_filtro_random:
          v.metodo === 'random' && v.quotazioneMinima
            ? { quotazione_minima: v.quotazioneMinima }
            : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asta', idLega] }),
  })
}

export function useApriAsta(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sorteggia: boolean): Promise<EsitoSemplice> =>
      chiamaFunzione('apri_asta', { p_lega: idLega, p_sorteggia: sorteggia }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lega', idLega] })
    },
  })
}

export function usePausaAsta(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inPausa: boolean): Promise<EsitoSemplice> =>
      chiamaFunzione('pausa_asta', { p_lega: idLega, p_in_pausa: inPausa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asta', idLega] }),
  })
}

export function useChiamaCalciatore(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { idCalciatore: number; importo: number }) =>
      chiamaFunzione<{ esito: string; messaggio: string; lotto: string | null }>(
        'chiama_calciatore',
        { p_lega: idLega, p_player_id: v.idCalciatore, p_importo: v.importo },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lotto'] })
    },
  })
}

export function useRilancia(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { idLotto: string; importo: number }) =>
      chiamaFunzione<{ esito: string; messaggio: string; offerta: number }>('rilancia', {
        p_lotto: v.idLotto,
        p_importo: v.importo,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotto'] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
    },
  })
}

export function useChiudiLottoScaduto(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idLotto: string) =>
      chiamaFunzione<{ esito: string; messaggio: string; squadra: string | null; prezzo: number }>(
        'chiudi_lotto_se_scaduto',
        { p_lotto: idLotto },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lotto'] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
      qc.invalidateQueries({ queryKey: ['rose', idLega] })
    },
  })
}

// ─── Metodi automatici ──────────────────────────────────────────────────────

export function useApriProssimoLotto(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      chiamaFunzione<{ esito: string; messaggio: string; lotto: string | null }>(
        'apri_prossimo_lotto',
        { p_lega: idLega },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lotto'] })
    },
  })
}

// ─── Chiamata con passo ─────────────────────────────────────────────────────

export function usePassa(idLega: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idLotto: string) =>
      chiamaFunzione<{ esito: string; messaggio: string; chiuso: boolean }>('passa', {
        p_lotto: idLotto,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotto'] })
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['rose', idLega] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
    },
  })
}

/** Chi ha già passato su questo lotto: serve a spegnere il pulsante. */
export function usePassiDelLotto(idLotto: string | undefined) {
  return useQuery({
    queryKey: ['passi', idLotto],
    enabled: Boolean(idLotto),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await richiediSupabase()
        .from('lot_passes')
        .select('team_id')
        .eq('lot_id', idLotto!)
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []).map((r) => (r as { team_id: string }).team_id)
    },
  })
}

// ─── Poteri dell'amministratore ─────────────────────────────────────────────

function useAzioneAdmin<T>(idLega: string | undefined, nome: string, argomenti: (v: T) => Record<string, unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: T) => chiamaFunzione<EsitoSemplice>(nome, argomenti(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asta', idLega] })
      qc.invalidateQueries({ queryKey: ['lotto'] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
      qc.invalidateQueries({ queryKey: ['rose', idLega] })
      qc.invalidateQueries({ queryKey: ['lega', idLega] })
    },
  })
}

export function useAggiudicaOra(idLega: string | undefined) {
  return useAzioneAdmin<string>(idLega, 'aggiudica_ora', (idLotto) => ({ p_lotto: idLotto }))
}

export function usePassaLotto(idLega: string | undefined) {
  return useAzioneAdmin<string>(idLega, 'passa_lotto', (idLotto) => ({ p_lotto: idLotto }))
}

export function useAssegnaRapido(idLega: string | undefined) {
  return useAzioneAdmin<{ idCalciatore: number; idSquadra: string; prezzo: number }>(
    idLega,
    'assegna_rapido',
    (v) => ({
      p_lega: idLega,
      p_player_id: v.idCalciatore,
      p_squadra: v.idSquadra,
      p_prezzo: v.prezzo,
    }),
  )
}

export function useAnnullaUltima(idLega: string | undefined) {
  return useAzioneAdmin<void>(idLega, 'annulla_ultima_aggiudicazione', () => ({ p_lega: idLega }))
}
