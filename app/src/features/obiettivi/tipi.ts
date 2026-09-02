import type { Ruolo } from '@/domain/listone'

export type ColoreFascia = 'oro' | 'arancio' | 'verde' | 'azzurro' | 'rosso' | 'fumo'

/** I colori delle fasce vengono dal design system, mai scritti a mano. */
export const COLORI_FASCIA: Record<ColoreFascia, { punto: string; bordo: string; testo: string; nome: string }> = {
  oro: { punto: 'bg-oro', bordo: 'border-oro/50', testo: 'text-oro', nome: 'Oro' },
  arancio: { punto: 'bg-arancio', bordo: 'border-arancio/50', testo: 'text-arancio', nome: 'Arancio' },
  verde: { punto: 'bg-verde-acceso', bordo: 'border-verde-acceso/50', testo: 'text-verde-acceso', nome: 'Verde' },
  azzurro: { punto: 'bg-informativo', bordo: 'border-informativo/50', testo: 'text-informativo', nome: 'Azzurro' },
  rosso: { punto: 'bg-errore', bordo: 'border-errore/50', testo: 'text-errore', nome: 'Rosso' },
  fumo: { punto: 'bg-fumo', bordo: 'border-fumo/50', testo: 'text-fumo', nome: 'Grigio' },
}

export type Fascia = {
  id: string
  list_id: string
  /** Una fascia appartiene a un reparto: durante l'asta si guarda solo quello. */
  role: Ruolo
  name: string
  color: ColoreFascia
  position: number
}

export type CalciatoreDelObiettivo = {
  id: number
  name: string
  role: Ruolo
  serie_a_team: string
  quotation: number
  photo_path: string | null
}

export type Obiettivo = {
  id: string
  list_id: string
  player_id: number
  tier_id: string | null
  max_price: number | null
  priority: number
  note: string | null
  status: 'open' | 'taken' | 'won' | 'dropped'
  players: CalciatoreDelObiettivo
}

export type Candidato = { slot_id: string; target_id: string; position: number }

export type SlotRosa = {
  id: string
  list_id: string
  role: Ruolo
  label: string
  position: number
  slot_candidates: Candidato[]
}

export type MembroIncrocio = { pairing_id: string; target_id: string; position: number }

export type Incrocio = {
  id: string
  list_id: string
  name: string
  note: string | null
  position: number
  pairing_members: MembroIncrocio[]
}

/**
 * Il metodo di preparazione. Se ne sceglie **uno**: fasce e slot rispondono
 * alla stessa domanda in due modi diversi, e tenerli accesi insieme non aiuta
 * a decidere, raddoppia il lavoro.
 */
export type MetodoLista = 'fasce' | 'slot'

export type ListaObiettivi = {
  id: string
  league_id: string
  user_id: string
  metodo: MetodoLista
  /** Finché è falso, la schermata apre sulla scelta del metodo. */
  metodo_confermato: boolean
  /** Aggiunta accendibile in tutti e due i metodi. */
  usa_tetti: boolean
  /** Indipendente dal metodo: si affianca a entrambi. */
  usa_incroci: boolean
  tiers: Fascia[]
  targets: Obiettivo[]
  roster_slots: SlotRosa[]
  goalkeeper_pairings: Incrocio[]
}

export const ORDINE_RUOLI: Ruolo[] = ['P', 'D', 'C', 'A']

export const NOME_RUOLO: Record<Ruolo, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

export const CLASSE_RUOLO: Record<Ruolo, string> = {
  P: 'bg-oro/20 text-oro',
  D: 'bg-verde-acceso/25 text-verde-acceso',
  C: 'bg-informativo/20 text-informativo',
  A: 'bg-arancio/20 text-arancio',
}

/** Quanto spenderei al massimo se prendessi tutti gli obiettivi al loro tetto. */
export function spesaMassima(obiettivi: Obiettivo[]): number {
  return obiettivi.reduce((s, o) => s + (o.max_price ?? 0), 0)
}

export function contaPerRuolo(obiettivi: Obiettivo[]): Record<Ruolo, number> {
  const c: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 }
  for (const o of obiettivi) c[o.players.role]++
  return c
}
