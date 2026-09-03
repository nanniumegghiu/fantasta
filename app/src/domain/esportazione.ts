/**
 * Il file delle rose da caricare nell'app Fantacalcio.
 *
 * Il formato è quello delle istruzioni ufficiali, fissato in ADR-0008:
 * quattro colonne, `Id`, `Calciatore`, `Fantasquadra`, `Prezzo`.
 *
 * L'identificativo è dichiarato facoltativo e noi lo mettiamo sempre: è
 * l'unica difesa contro le omonimie, e in Serie A ce ne sono sempre.
 * Esportare senza vuol dire scoprire a caricamento fatto che il portiere è
 * finito nella rosa sbagliata.
 *
 * Il nome del calciatore è quello del listone importato, non uno normalizzato
 * da noi: l'app di destinazione confronta con lo stesso listone, quindi
 * qualsiasi nostra rielaborazione può solo peggiorare la corrispondenza.
 */

export type RigaEsportazione = {
  id: number
  calciatore: string
  fantasquadra: string
  prezzo: number
}

export const INTESTAZIONI = ['Id', 'Calciatore', 'Fantasquadra', 'Prezzo'] as const

/**
 * Il separatore.
 *
 * PERCHE' SI PUO' SCEGLIERE
 * Le istruzioni ufficiali dicono quali colonne servono, non con che carattere
 * separarle. In Italia Excel apre i CSV col punto e virgola, e aprirli è la
 * prima cosa che si fa per controllare che sia tutto giusto; altri lettori
 * vogliono la virgola. Indovinare per l'utente e sbagliare significa un file
 * che non si carica la sera dell'asta, quando non c'è tempo di capire perché.
 *
 * Il valore predefinito è il punto e virgola perché l'app di destinazione è
 * italiana; l'altro è a un tocco, e la schermata lo dice.
 */
export type Separatore = ';' | ','

/**
 * Mette fra virgolette solo quando serve, e raddoppia le virgolette interne.
 *
 * E' la regola dei CSV (RFC 4180): un campo va protetto se contiene il
 * separatore, una virgoletta o un ritorno a capo. I nomi delle fantasquadre li
 * scrivono delle persone, e prima o poi qualcuno chiamerà la sua «Bomber; il
 * ritorno» o «I "Cannonieri"». Senza questa funzione quel file si rompe in
 * silenzio e sposta tutte le colonne di uno.
 */
export function proteggi(valore: string, separatore: Separatore): string {
  const testo = valore ?? ''
  if (testo.includes(separatore) || testo.includes('"') || /[\r\n]/.test(testo)) {
    return `"${testo.replace(/"/g, '""')}"`
  }
  return testo
}

/**
 * Costruisce il contenuto del file.
 *
 * I ritorni a capo sono `\r\n` perché è quello che vuole RFC 4180 ed è quello
 * che Excel su Windows si aspetta.
 */
export function componiCsv(righe: RigaEsportazione[], separatore: Separatore = ';'): string {
  const linee = [INTESTAZIONI.join(separatore)]
  for (const r of righe) {
    linee.push(
      [
        String(r.id),
        proteggi(r.calciatore, separatore),
        proteggi(r.fantasquadra, separatore),
        String(r.prezzo),
      ].join(separatore),
    )
  }
  // Il file finisce con un ritorno a capo: alcuni lettori perdono l'ultima
  // riga se non c'è.
  return linee.join('\r\n') + '\r\n'
}

/**
 * Il nome del file.
 *
 * Contiene lega, stagione e data perché a fine serata se ne scaricano tre o
 * quattro versioni, e «rose.csv (3)» nella cartella dei download non dice a
 * nessuno quale sia quello buono.
 */
export function nomeFile(lega: string, stagione: string, soloMia: boolean): string {
  const pulito = (s: string) =>
    (s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'lega'

  const oggi = new Date().toISOString().slice(0, 10)
  return `${pulito(lega)}-${pulito(stagione)}-${soloMia ? 'mia-rosa' : 'tutte-le-rose'}-${oggi}.csv`
}

/**
 * Ordina le righe come le si vuole rileggere: per squadra, poi per reparto,
 * poi dal più caro al più economico.
 *
 * All'app di destinazione l'ordine non interessa. Interessa a chi apre il file
 * per controllarlo prima di caricarlo, che è il momento in cui gli errori si
 * trovano ancora in tempo.
 */
export const ORDINE_REPARTI = ['P', 'D', 'C', 'A']

export function ordina<T extends { fantasquadra: string; ruolo: string; prezzo: number; calciatore: string }>(
  righe: T[],
): T[] {
  return [...righe].sort(
    (a, b) =>
      a.fantasquadra.localeCompare(b.fantasquadra, 'it') ||
      ORDINE_REPARTI.indexOf(a.ruolo) - ORDINE_REPARTI.indexOf(b.ruolo) ||
      b.prezzo - a.prezzo ||
      a.calciatore.localeCompare(b.calciatore, 'it'),
  )
}

/**
 * Quello che non va: i controlli da fare **prima** di scaricare.
 *
 * Non sono errori che impediscono l'esportazione — il file si scarica lo
 * stesso — sono le cose che fanno fallire il caricamento dall'altra parte, e
 * che a quel punto costa molto più fatica capire.
 */
export type Avvertimento = { grave: boolean; testo: string }

export function controlla(
  righe: RigaEsportazione[],
  squadre: Array<{ nome: string; slotMancanti: number }>,
): Avvertimento[] {
  const avvisi: Avvertimento[] = []

  if (righe.length === 0) {
    avvisi.push({ grave: true, testo: 'Non è stato comprato ancora nessuno: il file sarebbe vuoto.' })
    return avvisi
  }

  const incomplete = squadre.filter((s) => s.slotMancanti > 0)
  if (incomplete.length) {
    avvisi.push({
      grave: false,
      testo:
        `${incomplete.length === 1 ? 'Una squadra ha' : `${incomplete.length} squadre hanno`} ancora ` +
        `slot vuoti: ${incomplete.map((s) => `${s.nome} (${s.slotMancanti})`).join(', ')}.`,
    })
  }

  // Il nome della fantasquadra deve corrispondere **esattamente** a quello
  // configurato nell'app di destinazione: è l'errore più probabile, e ADR-0008
  // dice di segnalarlo qui.
  const nomiStrani = [...new Set(righe.map((r) => r.fantasquadra))].filter(
    (n) => n !== n.trim() || /[;,"]/.test(n),
  )
  if (nomiStrani.length) {
    avvisi.push({
      grave: false,
      testo:
        'Alcuni nomi di squadra hanno spazi ai bordi o caratteri che nei fogli danno noia: ' +
        `${nomiStrani.map((n) => `«${n}»`).join(', ')}. Nel file sono protetti, ma controlla che ` +
        "corrispondano a quelli configurati nell'app Fantacalcio.",
    })
  }

  const senzaId = righe.filter((r) => !Number.isInteger(r.id) || r.id <= 0)
  if (senzaId.length) {
    avvisi.push({
      grave: true,
      testo: `${senzaId.length} righe senza identificativo valido: le omonimie andrebbero a caso.`,
    })
  }

  return avvisi
}
