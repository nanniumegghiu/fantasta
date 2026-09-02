/**
 * I suoni dello schermo condiviso, sintetizzati sul momento.
 *
 * PERCHE' SENZA FILE AUDIO
 * ADR-0006 tiene un elenco chiuso di dipendenze, e il documento di design
 * segnalava come aperto il reperimento di file audio con licenza libera.
 * Il browser sa già generare suoni: sei toni brevi non hanno bisogno di
 * nessun file da scaricare, da versionare o da licenziare. Pesano zero e
 * partono all'istante, che durante un'asta conta.
 *
 * IL VINCOLO DA RICORDARE
 * Nessun browser fa partire un suono prima che l'utente abbia toccato la
 * pagina. Per questo lo schermo condiviso si apre su una schermata di
 * attivazione: un tocco all'inizio della serata e per il resto funziona.
 * Senza quella schermata i suoni non partirebbero e sembrerebbe un difetto.
 */

let contesto: AudioContext | null = null
let volume = 0.6
let acceso = true

export function audioAttivo(): boolean {
  return contesto !== null && contesto.state === 'running'
}

/** Da chiamare dentro il gestore di un tocco vero, mai altrove. */
export async function attivaAudio(): Promise<boolean> {
  try {
    if (!contesto) {
      const Costruttore =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Costruttore) return false
      contesto = new Costruttore()
    }
    await contesto.resume()
    // Un impulso muto: alcuni browser considerano "sbloccato" solo un
    // contesto che ha davvero prodotto qualcosa.
    const g = contesto.createGain()
    g.gain.value = 0
    g.connect(contesto.destination)
    const o = contesto.createOscillator()
    o.connect(g)
    o.start()
    o.stop(contesto.currentTime + 0.01)
    return contesto.state === 'running'
  } catch {
    return false
  }
}

export function impostaVolume(v: number) {
  volume = Math.min(1, Math.max(0, v))
}

export function impostaSuoniAccesi(v: boolean) {
  acceso = v
}

export function suoniAccesi(): boolean {
  return acceso
}

type Forma = 'sine' | 'square' | 'triangle' | 'sawtooth'

function tono(
  frequenza: number,
  durata: number,
  ritardo = 0,
  forma: Forma = 'sine',
  intensita = 1,
) {
  if (!contesto || !acceso) return
  const inizio = contesto.currentTime + ritardo
  const osc = contesto.createOscillator()
  const guadagno = contesto.createGain()
  osc.type = forma
  osc.frequency.setValueAtTime(frequenza, inizio)
  // Attacco rapido e coda breve: un tono che parte e finisce di netto è
  // più leggibile in una stanza rumorosa di uno che sfuma.
  guadagno.gain.setValueAtTime(0, inizio)
  guadagno.gain.linearRampToValueAtTime(volume * intensita, inizio + 0.012)
  guadagno.gain.exponentialRampToValueAtTime(0.0001, inizio + durata)
  osc.connect(guadagno)
  guadagno.connect(contesto.destination)
  osc.start(inizio)
  osc.stop(inizio + durata + 0.02)
}

function scivolata(da: number, a: number, durata: number, forma: Forma = 'sawtooth') {
  if (!contesto || !acceso) return
  const inizio = contesto.currentTime
  const osc = contesto.createOscillator()
  const guadagno = contesto.createGain()
  osc.type = forma
  osc.frequency.setValueAtTime(da, inizio)
  osc.frequency.exponentialRampToValueAtTime(a, inizio + durata)
  guadagno.gain.setValueAtTime(0, inizio)
  guadagno.gain.linearRampToValueAtTime(volume * 0.8, inizio + 0.02)
  guadagno.gain.exponentialRampToValueAtTime(0.0001, inizio + durata)
  osc.connect(guadagno)
  guadagno.connect(contesto.destination)
  osc.start(inizio)
  osc.stop(inizio + durata + 0.02)
}

function rumore(durata: number, intensita = 0.5) {
  if (!contesto || !acceso) return
  const campioni = Math.floor(contesto.sampleRate * durata)
  const buffer = contesto.createBuffer(1, campioni, contesto.sampleRate)
  const dati = buffer.getChannelData(0)
  for (let i = 0; i < campioni; i++) {
    dati[i] = (Math.random() * 2 - 1) * (1 - i / campioni)
  }
  const sorgente = contesto.createBufferSource()
  sorgente.buffer = buffer
  const guadagno = contesto.createGain()
  guadagno.gain.value = volume * intensita
  sorgente.connect(guadagno)
  guadagno.connect(contesto.destination)
  sorgente.start()
}

/** Fischietto corto: fa alzare la testa a tutti. */
export function suonoChiamata() {
  scivolata(900, 1500, 0.16, 'square')
  tono(1500, 0.12, 0.16, 'square', 0.7)
}

/** Tocco secco che sale con l'importo: si sente che il prezzo cresce. */
export function suonoRilancio(importo: number, massimo: number) {
  const quota = massimo > 0 ? Math.min(1, importo / massimo) : 0
  tono(440 + quota * 500, 0.1, 0, 'triangle', 0.9)
}

/** Tre note discendenti: si sta chiudendo. */
export function suonoPartenzaCountdown() {
  tono(880, 0.14, 0, 'sine', 0.9)
  tono(660, 0.14, 0.16, 'sine', 0.9)
  tono(440, 0.2, 0.32, 'sine', 0.9)
}

/** Un battito al secondo negli ultimi istanti. */
export function suonoTic(ultimo = false) {
  tono(ultimo ? 1200 : 800, 0.07, 0, 'square', ultimo ? 1 : 0.7)
}

/** Martelletto e accordo breve: il momento si chiude. */
export function suonoAggiudicazione() {
  rumore(0.12, 0.6)
  tono(523.25, 0.5, 0.06, 'triangle', 0.8)
  tono(659.25, 0.5, 0.08, 'triangle', 0.7)
  tono(783.99, 0.6, 0.1, 'triangle', 0.6)
}

/** Campanella: un reparto è finito. */
export function suonoCampanella() {
  tono(1318.5, 0.5, 0, 'sine', 0.8)
  tono(1760, 0.6, 0.1, 'sine', 0.5)
}
