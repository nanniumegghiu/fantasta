/**
 * Lettura di fogli di calcolo, senza dipendenze.
 *
 * PERCHE' SCRITTO A MANO
 * ADR-0006 tiene un elenco chiuso di dipendenze. Le librerie diffuse per
 * leggere gli Excel o portano vulnerabilita' note o pesano centinaia di
 * kilobyte per un compito che qui e' minuscolo: leggere una tabella di
 * seicento righe da un file prodotto da un foglio di calcolo.
 *
 * Il formato .xlsx e' un archivio ZIP di file XML. Sia il browser sia Node 22
 * sanno gia' decomprimere con `DecompressionStream`, quindi non serve altro.
 *
 * QUESTO MODULO NON TOCCA IL DOM: gira identico nel browser e in Node, ed e'
 * per questo che si puo' verificare con uno script senza aprire una pagina.
 */

export type Tabella = string[][]

// ─── CSV, con il separatore indovinato ──────────────────────────────────────

/**
 * I file italiani usano quasi sempre il punto e virgola, perche' la virgola
 * e' gia' impegnata come separatore decimale. Ma non sempre: si conta quale
 * separatore compare piu' spesso nelle prime righe e si usa quello.
 */
export function separatoreProbabile(testo: string): string {
  const campione = testo.split(/\r?\n/).slice(0, 5).join('\n')
  const candidati = [';', '\t', ',']
  let migliore = ';'
  let massimo = -1
  for (const c of candidati) {
    const quanti = campione.split(c).length - 1
    if (quanti > massimo) {
      massimo = quanti
      migliore = c
    }
  }
  return migliore
}

/** Legge un CSV rispettando le virgolette e i ritorni a capo dentro i campi. */
export function leggiCsv(testo: string, separatore?: string): Tabella {
  const sep = separatore ?? separatoreProbabile(testo)
  // Toglie il segno d'ordine dei byte che Excel mette in testa ai file.
  const pulito = testo.replace(/^﻿/, '')

  const tabella: Tabella = []
  let riga: string[] = []
  let campo = ''
  let traVirgolette = false

  for (let i = 0; i < pulito.length; i++) {
    const c = pulito[i]

    if (traVirgolette) {
      if (c === '"') {
        if (pulito[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          traVirgolette = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') {
      traVirgolette = true
    } else if (c === sep) {
      riga.push(campo)
      campo = ''
    } else if (c === '\n') {
      riga.push(campo)
      tabella.push(riga)
      riga = []
      campo = ''
    } else if (c === '\r') {
      // Ignorato: il ritorno a capo vero è \n.
    } else {
      campo += c
    }
  }

  if (campo !== '' || riga.length > 0) {
    riga.push(campo)
    tabella.push(riga)
  }

  return tabella
}

// ─── XLSX ───────────────────────────────────────────────────────────────────

type VoceZip = { nome: string; metodo: number; offset: number; dimensione: number }

function leggiUInt16(b: Uint8Array, p: number) {
  return b[p] | (b[p + 1] << 8)
}
function leggiUInt32(b: Uint8Array, p: number) {
  return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0
}

/** Elenca i file dentro un archivio ZIP leggendone l'indice finale. */
function indiceZip(byte: Uint8Array): VoceZip[] {
  // La fine dell'indice sta negli ultimi 22 byte, salvo commento finale.
  let fine = -1
  for (let p = byte.length - 22; p >= 0 && p > byte.length - 65558; p--) {
    if (leggiUInt32(byte, p) === 0x06054b50) {
      fine = p
      break
    }
  }
  if (fine < 0) throw new Error("Non sembra un file .xlsx: manca l'indice dell'archivio.")

  const quanti = leggiUInt16(byte, fine + 10)
  let p = leggiUInt32(byte, fine + 16)
  const voci: VoceZip[] = []

  for (let i = 0; i < quanti; i++) {
    if (leggiUInt32(byte, p) !== 0x02014b50) break
    const metodo = leggiUInt16(byte, p + 10)
    const dimensione = leggiUInt32(byte, p + 20)
    const lunghezzaNome = leggiUInt16(byte, p + 28)
    const lunghezzaExtra = leggiUInt16(byte, p + 30)
    const lunghezzaCommento = leggiUInt16(byte, p + 32)
    const offset = leggiUInt32(byte, p + 42)
    const nome = new TextDecoder().decode(byte.subarray(p + 46, p + 46 + lunghezzaNome))
    voci.push({ nome, metodo, offset, dimensione })
    p += 46 + lunghezzaNome + lunghezzaExtra + lunghezzaCommento
  }
  return voci
}

async function estrai(byte: Uint8Array, voce: VoceZip): Promise<string> {
  let p = voce.offset
  if (leggiUInt32(byte, p) !== 0x04034b50) throw new Error(`Voce danneggiata: ${voce.nome}`)
  const lunghezzaNome = leggiUInt16(byte, p + 26)
  const lunghezzaExtra = leggiUInt16(byte, p + 28)
  p += 30 + lunghezzaNome + lunghezzaExtra

  const compressi = byte.subarray(p, p + voce.dimensione)
  if (voce.metodo === 0) return new TextDecoder().decode(compressi)
  if (voce.metodo !== 8) throw new Error(`Compressione non gestita nel file: ${voce.metodo}`)

  const flusso = new Blob([compressi as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(flusso).text()
}

function decodificaEntita(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** Da "BC" a 54: la lettera di colonna diventa un indice da zero. */
function indiceColonna(riferimento: string): number {
  const lettere = riferimento.replace(/\d+/g, '')
  let n = 0
  for (const c of lettere) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Legge il primo foglio di un .xlsx e restituisce una tabella di stringhe.
 *
 * Gestisce le due forme in cui i fogli di calcolo salvano il testo: il
 * magazzino condiviso delle stringhe e il testo scritto dentro la cella.
 */
export async function leggiXlsx(byte: Uint8Array): Promise<Tabella> {
  const voci = indiceZip(byte)

  const fogli = voci
    .filter((v) => /^xl\/worksheets\/sheet\d+\.xml$/.test(v.nome))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'en', { numeric: true }))
  if (fogli.length === 0) throw new Error('Il file non contiene nessun foglio di calcolo.')

  const vociStringhe = voci.find((v) => v.nome === 'xl/sharedStrings.xml')
  let condivise: string[] = []
  if (vociStringhe) {
    const xml = await estrai(byte, vociStringhe)
    condivise = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => {
      const pezzi = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1])
      return decodificaEntita(pezzi.join(''))
    })
  }

  const xmlFoglio = await estrai(byte, fogli[0])
  const tabella: Tabella = []

  for (const riga of xmlFoglio.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const celle: string[] = []
    for (const cella of riga[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributi = cella[1]
      const contenuto = cella[2]
      const rif = /r="([A-Z]+\d+)"/.exec(attributi)?.[1]
      const tipo = /t="([^"]+)"/.exec(attributi)?.[1]

      let valore = ''
      if (tipo === 's') {
        const indice = Number(/<v>([\s\S]*?)<\/v>/.exec(contenuto)?.[1] ?? '-1')
        valore = condivise[indice] ?? ''
      } else if (tipo === 'inlineStr') {
        const pezzi = [...contenuto.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1])
        valore = decodificaEntita(pezzi.join(''))
      } else {
        valore = decodificaEntita(/<v>([\s\S]*?)<\/v>/.exec(contenuto)?.[1] ?? '')
      }

      const colonna = rif ? indiceColonna(rif) : celle.length
      while (celle.length < colonna) celle.push('')
      celle[colonna] = valore
    }
    // Le celle vuote in coda non arrivano nell'XML: si riempiono da sole
    // quando si legge per indice, quindi qui non serve fare altro.
    tabella.push(celle)
  }

  return tabella
}

/** Sceglie il lettore giusto guardando l'estensione, non fidandosi del tipo MIME. */
export async function leggiFoglio(nomeFile: string, byte: Uint8Array): Promise<Tabella> {
  if (/\.xlsx$/i.test(nomeFile)) return leggiXlsx(byte)
  if (/\.(csv|txt|tsv)$/i.test(nomeFile)) return leggiCsv(new TextDecoder().decode(byte))
  if (/\.xls$/i.test(nomeFile)) {
    throw new Error(
      'Il formato .xls vecchio non è gestito. Apri il file e salvalo come .xlsx oppure come CSV.',
    )
  }
  throw new Error('Formato non riconosciuto. Servono un file .xlsx o un .csv.')
}
