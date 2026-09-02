/**
 * Forma dei dati delle leghe, concordata col backend.
 *
 * I nomi dei campi sono quelli delle colonne, in inglese, come prescrive
 * docs/00-glossario.md. Restano in inglese solo questi: sono il contratto col
 * database, e tradurli qui creerebbe due vocabolari da tenere allineati.
 */

export type StatoLega = 'setup' | 'auction' | 'done'
export type RuoloPartecipante = 'admin' | 'member'

export type Lega = {
  id: string
  name: string
  season: string
  admin_user_id: string
  invite_code: string
  invite_active: boolean
  rules_pdf_path: string | null
  credits_initial: number
  slots_p: number
  slots_d: number
  slots_c: number
  slots_a: number
  min_bid: number
  trades_enabled: boolean
  trades_with_credits_enabled: boolean
  max_members: number
  status: StatoLega
  created_at: string
}

export type Squadra = {
  id: string
  league_id: string
  user_id: string
  name: string
  credits_remaining: number
}

export type Partecipante = {
  league_id: string
  user_id: string
  role: RuoloPartecipante
  joined_at: string
}

/** Una lega con dentro squadre e partecipanti, come arriva dalla query unica. */
export type LegaCompleta = Lega & {
  teams: Squadra[]
  league_members: Partecipante[]
}

export type Profilo = {
  id: string
  display_name: string
  avatar_url: string | null
}

/** Le regole modificabili alla creazione di una lega. */
export type RegoleLega = {
  crediti: number
  slotP: number
  slotD: number
  slotC: number
  slotA: number
  offertaMinima: number
  scambi: boolean
  scambiConCrediti: boolean
  maxPartecipanti: number
}

export const REGOLE_PREDEFINITE: RegoleLega = {
  crediti: 500,
  slotP: 3,
  slotD: 8,
  slotC: 8,
  slotA: 6,
  offertaMinima: 1,
  scambi: false,
  scambiConCrediti: false,
  maxPartecipanti: 10,
}

/** Gli esiti possibili dell'ingresso in lega, definiti dal database. */
export type EsitoIngresso =
  | 'ok'
  | 'gia_dentro'
  | 'non_autenticato'
  | 'codice_non_valido'
  | 'asta_iniziata'
  | 'lega_piena'
  | 'nome_occupato'
  | 'troppi_tentativi'

export type RisultatoIngresso = {
  esito: EsitoIngresso
  messaggio: string
  lega: string | null
}

export type AnteprimaInvito = {
  nome: string
  stagione: string
  partecipanti: number
  massimo: number
  aperta: boolean
}

export const NOMI_RUOLO = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' }

/** Quanti calciatori compone una rosa, secondo le regole della lega. */
export function totaleSlot(l: Pick<Lega, 'slots_p' | 'slots_d' | 'slots_c' | 'slots_a'>): number {
  return l.slots_p + l.slots_d + l.slots_c + l.slots_a
}
