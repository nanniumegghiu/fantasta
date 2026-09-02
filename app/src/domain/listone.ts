/**
 * Interpretazione del listone e delle statistiche.
 *
 * Il principio, da ADR-0003: l'importatore riconosce le colonne **per
 * contenuto e non solo per intestazione**, perche' i nomi delle colonne
 * cambiano di stagione in stagione. E prima di scrivere mostra sempre cosa ha
 * capito e cosa non ha capito: mai un'importazione silenziosa.
 *
 * Nessun riferimento al DOM: gira identico nel browser e in Node.
 */

import type { Tabella } from './fogli'

export type Ruolo = 'P' | 'D' | 'C' | 'A'

export type RigaListone = {
  id: number
  nome: string
  ruolo: Ruolo
  squadra: string
  quotazione: number
}

export type RigaStatistiche = {
  id: number
  partite: number | null
  minuti: number | null
  media: number | null
  fantamedia: number | null
  gol: number | null
  assist: number | null
  ammonizioni: number | null
  espulsioni: number | null
}

export type Scarto = { riga: number; motivo: string; contenuto: string }

export type Interpretazione<T> = {
  righe: T[]
  /** Quale riga del file conteneva le intestazioni, contando da 1. */
  rigaIntestazione: number
  /** Che colonna abbiamo usato per ogni campo: si mostra all'utente. */
  colonne: Record<string, string>
  /** Campi previsti che nel file non ci sono. */
  mancanti: string[]
  scartate: Scarto[]
}

// ─── Utilità ────────────────────────────────────────────────────────────────

/** «Qt.A M» diventa «qtam»: si confrontano forme ridotte, non stringhe esatte. */
export function normalizza(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** I numeri italiani usano la virgola: «6,25» vale 6.25. */
export function numero(s: string | undefined): number | null {
  if (s == null) return null
  const pulito = s.replace(/\s/g, '').replace(',', '.')
  if (pulito === '' || pulito === '-') return null
  const n = Number(pulito)
  return Number.isFinite(n) ? n : null
}

function intero(s: string | undefined): number | null {
  const n = numero(s)
  return n == null ? null : Math.round(n)
}

const RUOLI_VALIDI: Record<string, Ruolo> = {
  p: 'P',
  por: 'P',
  portiere: 'P',
  d: 'D',
  dif: 'D',
  difensore: 'D',
  c: 'C',
  cen: 'C',
  centrocampista: 'C',
  a: 'A',
  att: 'A',
  attaccante: 'A',
}

export function ruoloDaTesto(s: string | undefined): Ruolo | null {
  if (!s) return null
  const n = normalizza(s)
  if (RUOLI_VALIDI[n]) return RUOLI_VALIDI[n]
  // Nei file Mantra la colonna contiene più ruoli separati: si prende il primo.
  const primo = n.charAt(0)
  return RUOLI_VALIDI[primo] ?? null
}

/**
 * Cerca una colonna provando i nomi in ordine di preferenza.
 * L'ordine conta: «qta» è la quotazione del Classic, «qtam» quella del Mantra.
 */
function trovaColonna(intestazioni: string[], candidati: string[]): number {
  const normalizzate = intestazioni.map(normalizza)
  for (const c of candidati) {
    const i = normalizzate.indexOf(c)
    if (i >= 0) return i
  }
  return -1
}

// ─── Listone ────────────────────────────────────────────────────────────────

const COLONNE_LISTONE = {
  id: ['id', 'idcalciatore', 'codice'],
  nome: ['nome', 'calciatore', 'giocatore', 'cognome'],
  ruolo: ['r', 'ruolo', 'ruoloclassic'],
  squadra: ['squadra', 'team', 'club'],
  quotazione: ['qta', 'qtainiziale', 'qti', 'quotazione', 'quota', 'qt'],
}

/**
 * Trova la riga delle intestazioni.
 *
 * I file ufficiali hanno spesso una riga di titolo sopra la tabella vera, del
 * tipo «Quotazioni Fantacalcio Stagione 2026/27». Cercarla a occhio e' esattamente
 * il genere di passaggio manuale che va evitato: si scorrono le prime righe
 * finche' una contiene abbastanza intestazioni riconoscibili.
 */
function cercaIntestazione(
  tabella: Tabella,
  obbligatorie: string[][],
  massimoRighe = 15,
): number {
  for (let i = 0; i < Math.min(tabella.length, massimoRighe); i++) {
    const riga = tabella[i]
    if (!riga || riga.length < 2) continue
    const trovate = obbligatorie.filter((c) => trovaColonna(riga, c) >= 0).length
    if (trovate === obbligatorie.length) return i
  }
  return -1
}

export function interpretaListone(tabella: Tabella): Interpretazione<RigaListone> {
  const indice = cercaIntestazione(tabella, [
    COLONNE_LISTONE.nome,
    COLONNE_LISTONE.ruolo,
    COLONNE_LISTONE.squadra,
  ])

  if (indice < 0) {
    throw new Error(
      'Non trovo le intestazioni: servono almeno le colonne Nome, R (ruolo) e Squadra.',
    )
  }

  const intestazioni = tabella[indice]
  const col = {
    id: trovaColonna(intestazioni, COLONNE_LISTONE.id),
    nome: trovaColonna(intestazioni, COLONNE_LISTONE.nome),
    ruolo: trovaColonna(intestazioni, COLONNE_LISTONE.ruolo),
    squadra: trovaColonna(intestazioni, COLONNE_LISTONE.squadra),
    quotazione: trovaColonna(intestazioni, COLONNE_LISTONE.quotazione),
  }

  const mancanti: string[] = []
  if (col.id < 0) mancanti.push('Id')
  if (col.quotazione < 0) mancanti.push('Quotazione')

  const righe: RigaListone[] = []
  const scartate: Scarto[] = []
  const visti = new Set<number>()

  for (let i = indice + 1; i < tabella.length; i++) {
    const r = tabella[i]
    const numeroRiga = i + 1
    const contenuto = (r ?? []).join(' | ').slice(0, 80)

    if (!r || r.every((c) => (c ?? '').trim() === '')) continue

    const nome = (r[col.nome] ?? '').trim()
    const ruolo = ruoloDaTesto(r[col.ruolo])
    const squadra = (r[col.squadra] ?? '').trim()
    const id = col.id >= 0 ? intero(r[col.id]) : null

    if (!nome) {
      scartate.push({ riga: numeroRiga, motivo: 'nome mancante', contenuto })
      continue
    }
    if (!ruolo) {
      scartate.push({ riga: numeroRiga, motivo: 'ruolo non riconosciuto', contenuto })
      continue
    }
    if (!squadra) {
      scartate.push({ riga: numeroRiga, motivo: 'squadra mancante', contenuto })
      continue
    }
    if (id == null) {
      // Senza identificativo non si può fare l'esportazione finale in sicurezza
      // (ADR-0008): è l'unica difesa contro le omonimie. Meglio fermarsi.
      scartate.push({ riga: numeroRiga, motivo: 'identificativo mancante', contenuto })
      continue
    }
    if (visti.has(id)) {
      scartate.push({ riga: numeroRiga, motivo: 'identificativo ripetuto', contenuto })
      continue
    }

    visti.add(id)
    righe.push({
      id,
      nome,
      ruolo,
      squadra,
      quotazione: col.quotazione >= 0 ? (intero(r[col.quotazione]) ?? 1) : 1,
    })
  }

  return {
    righe,
    rigaIntestazione: indice + 1,
    colonne: nomiColonne(intestazioni, col),
    mancanti,
    scartate,
  }
}

// ─── Statistiche ────────────────────────────────────────────────────────────

const COLONNE_STATISTICHE = {
  id: ['id', 'idcalciatore', 'codice'],
  nome: ['nome', 'calciatore', 'giocatore'],
  partite: ['pv', 'pg', 'partite', 'partitegiocate', 'partiteavoto'],
  minuti: ['min', 'minuti', 'mg', 'minutigiocati'],
  media: ['mv', 'media', 'mediavoto'],
  fantamedia: ['fm', 'fantamedia', 'mf'],
  gol: ['gf', 'gol', 'goal', 'golfatti', 'reti'],
  assist: ['ass', 'assist', 'asssist'],
  ammonizioni: ['amm', 'ammonizioni', 'gialli'],
  espulsioni: ['esp', 'espulsioni', 'rossi'],
}

export function interpretaStatistiche(tabella: Tabella): Interpretazione<RigaStatistiche> {
  const indice = cercaIntestazione(tabella, [
    COLONNE_STATISTICHE.id,
    COLONNE_STATISTICHE.media,
  ])

  if (indice < 0) {
    throw new Error(
      'Non trovo le intestazioni: servono almeno le colonne Id e Mv (media voto).',
    )
  }

  const intestazioni = tabella[indice]
  const col = Object.fromEntries(
    Object.entries(COLONNE_STATISTICHE).map(([k, v]) => [k, trovaColonna(intestazioni, v)]),
  ) as Record<keyof typeof COLONNE_STATISTICHE, number>

  const mancanti = Object.entries(col)
    .filter(([k, v]) => v < 0 && k !== 'nome')
    .map(([k]) => k)

  const righe: RigaStatistiche[] = []
  const scartate: Scarto[] = []

  for (let i = indice + 1; i < tabella.length; i++) {
    const r = tabella[i]
    const numeroRiga = i + 1
    if (!r || r.every((c) => (c ?? '').trim() === '')) continue

    const id = intero(r[col.id])
    if (id == null) {
      scartate.push({
        riga: numeroRiga,
        motivo: 'identificativo mancante',
        contenuto: r.join(' | ').slice(0, 80),
      })
      continue
    }

    const prendi = (c: number) => (c >= 0 ? intero(r[c]) : null)
    const prendiDecimale = (c: number) => (c >= 0 ? numero(r[c]) : null)

    righe.push({
      id,
      partite: prendi(col.partite),
      minuti: prendi(col.minuti),
      media: prendiDecimale(col.media),
      fantamedia: prendiDecimale(col.fantamedia),
      gol: prendi(col.gol),
      assist: prendi(col.assist),
      ammonizioni: prendi(col.ammonizioni),
      espulsioni: prendi(col.espulsioni),
    })
  }

  return {
    righe,
    rigaIntestazione: indice + 1,
    colonne: nomiColonne(intestazioni, col),
    mancanti,
    scartate,
  }
}

function nomiColonne(intestazioni: string[], col: Record<string, number>): Record<string, string> {
  const fuori: Record<string, string> = {}
  for (const [campo, i] of Object.entries(col)) {
    fuori[campo] = i >= 0 ? (intestazioni[i] || `colonna ${i + 1}`) : '— non trovata'
  }
  return fuori
}
