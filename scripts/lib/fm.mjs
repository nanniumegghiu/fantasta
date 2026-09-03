// ═══════════════════════════════════════════════════════════════════════════
// Il ponte con Football Manager, in un posto solo.
//
// Lo usano `volti.mjs` per le facce dei calciatori e `loghi.mjs` per gli
// stemmi delle squadre. Il pezzo che davvero non puo' stare in due copie e'
// `chiaveSquadra`: se i due script riducessero «F.C. Internazionale Milano»
// in modi diversi, un giorno le facce sarebbero dell'Inter e i loghi di
// nessuno, e capire perche' costerebbe piu' del lavoro di scriverlo bene.
//
// I vincoli di ADR-0011 valgono per chiunque importi da qui:
//   · Si scarica in blocco, mai un elemento alla volta.
//   · Mai durante l'asta: la corrispondenza vive nel nostro database.
//   · L'indirizzo non e' documentato e puo' cambiare: si fallisce dicendolo.
// ═══════════════════════════════════════════════════════════════════════════

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const radice = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ─── Ambiente ───────────────────────────────────────────────────────────────

export function leggiEnv(percorso) {
  const v = {}
  for (const riga of readFileSync(percorso, 'utf8').split(/\r?\n/)) {
    const t = riga.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) v[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return v
}

export const envApp = leggiEnv(join(radice, 'app', '.env.local'))
export const envRad = leggiEnv(join(radice, '.env.local'))
export const URL_BASE = envApp.VITE_SUPABASE_URL
export const CHIAVE = envApp.VITE_SUPABASE_ANON_KEY
export const ref = URL_BASE.replace('https://', '').split('.')[0]

export async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${envRad.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(t)
  return JSON.parse(t)
}

export function argomento(nome, ripiego) {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : ripiego
}

// ─── Dove sta la grafica ────────────────────────────────────────────────────

export const GRAFICA =
  process.env.FANTASTA_FACEPACK ??
  'C:/Users/Giovanni/Documents/Sports Interactive/Football Manager 26/graphics'

export const VOLTI = join(GRAFICA, 'faces')
export const LOGHI = join(GRAFICA, 'logos', 'clubs', 'normal')

export const CACHE = join(radice, '.cache')
export const ELENCO_FM = join(CACHE, 'serie-a-fm.json')

// ─── Il servizio di ricerca ─────────────────────────────────────────────────
// Parametri estratti dal codice del sito, come racconta ADR-0011.

export const RICERCA = {
  host: 'https://1r3p0ghdzwktqxu9p-1.a1.typesense.net',
  chiave: 'ItfYDIz1mGDuZVXzvkYj0jYJ4avarL02',
  raccolta: 'detailed_game_items',
  // 278 e' l'identificativo della Serie A dentro quell'archivio.
  serieA: 278,
}

// ─── Normalizzazione dei nomi ───────────────────────────────────────────────

/**
 * Le lettere che la decomposizione degli accenti non scompone.
 *
 * «Guðmundsson» e «Gudmundsson» sono la stessa persona, ma la ð non è una d
 * con un segno sopra: è una lettera a sé, e `normalize('NFD')` non la tocca.
 * Trovate guardando i candidati che `--proponi` metteva al primo posto: il
 * nome giusto c'era, e l'abbinamento non ci arrivava per una lettera.
 */
const LETTERE_INTERE = {
  'ð': 'd', 'þ': 'th', 'ø': 'o', 'œ': 'oe', 'æ': 'ae',
  'ł': 'l', 'đ': 'd', 'ħ': 'h', 'ı': 'i', 'ß': 'ss',
}

export function normalizza(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[\u00f0\u00fe\u00f8\u0153\u00e6\u0142\u0111\u0127\u0131\u00df]/g,
      (c) => LETTERE_INTERE[c] ?? c)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Riduce il nome di una squadra a una chiave, uguale da tutte e due le parti.
 *
 * I due elenchi non chiamano le squadre allo stesso modo: il listone dice
 * «Inter» e «Atalanta», Football Manager «F.C. Internazionale Milano» e
 * «Atalanta Bergamasca Calcio».
 *
 * PERCHE' LA PRIMA VERSIONE SBAGLIAVA
 *
 * Prima c'era una tabella di eccezioni applicata al nome intero, più un
 * ripiego che prendeva la parola più lunga. Il risultato **non era simmetrico**:
 * «Atalanta» finiva nell'eccezione e diventava «atalanta bergamasca», mentre
 * «Atalanta Bergamasca Calcio» non ci finiva e diventava «bergamasca», che è
 * la parola più lunga. Due chiavi diverse per la stessa squadra, e l'Atalanta
 * restava senza stemma e senza mezze facce.
 *
 * Adesso il criterio è uno solo e vale per entrambe le parti: **fra le parole
 * significative si cerca un nome di squadra conosciuto**, e quello è la
 * chiave. Se non ce n'è nessuno si torna alla parola più lunga, che è un
 * ripiego onesto per le squadre che non sono in elenco.
 */

// Le sigle societarie e le date di fondazione non identificano niente.
const RUMORE = new Set([
  'fc', 'f', 'c', 'ac', 'a', 'as', 'ss', 'ssc', 'us', 'usc', 'acf', 'cfc',
  'calcio', 'football', 'club', 'spa', 'de', 'bergamasca', 'avellaneda',
  '1909', '1913', '1907', '1919', '1926', '1913',
])

/**
 * I nomi con cui si riconosce una squadra, comunque sia scritta la ragione
 * sociale. Ci sono anche quelle appena retrocesse: un listone dell'anno prima
 * le contiene ancora, e riconoscerle serve a dire «questa squadra in Football
 * Manager non è in Serie A» invece di «non ho capito il nome».
 */
const NOMI_SQUADRA = new Map([
  ['atalanta', 'atalanta'],
  ['internazionale', 'inter'],
  ['inter', 'inter'],
  ['milan', 'milan'],
  ['juventus', 'juventus'],
  ['napoli', 'napoli'],
  ['roma', 'roma'],
  ['lazio', 'lazio'],
  ['fiorentina', 'fiorentina'],
  ['torino', 'torino'],
  ['bologna', 'bologna'],
  ['genoa', 'genoa'],
  ['udinese', 'udinese'],
  ['cagliari', 'cagliari'],
  ['lecce', 'lecce'],
  ['parma', 'parma'],
  ['como', 'como'],
  ['sassuolo', 'sassuolo'],
  ['cremonese', 'cremonese'],
  ['pisa', 'pisa'],
  ['verona', 'verona'],
  ['hellas', 'verona'],
  ['venezia', 'venezia'],
  ['monza', 'monza'],
  ['frosinone', 'frosinone'],
  ['empoli', 'empoli'],
  ['salernitana', 'salernitana'],
  ['spezia', 'spezia'],
  ['sampdoria', 'sampdoria'],
  ['palermo', 'palermo'],
  ['bari', 'bari'],
  ['catanzaro', 'catanzaro'],
])

export function chiaveSquadra(nome) {
  const parole = normalizza(nome)
    .split(' ')
    .filter((p) => p && !RUMORE.has(p))

  for (const p of parole) {
    const conosciuta = NOMI_SQUADRA.get(p)
    if (conosciuta) return conosciuta
  }

  // Ripiego: la parola più lunga. Vale per le squadre che non sono in elenco,
  // ed è simmetrico anche lì perché non dipende da nessuna eccezione.
  return parole.sort((a, b) => b.length - a.length)[0] ?? normalizza(nome)
}

// ─── Lo scaricamento in blocco ──────────────────────────────────────────────

/**
 * L'elenco dei calciatori di Serie A, con la squadra e il suo identificativo.
 *
 * L'identificativo del club arriva **gratis** insieme ai calciatori: ogni
 * documento porta la sua squadra. Scaricare a parte le venti squadre sarebbe
 * stato venti richieste in più per un dato che era già lì.
 */
export async function scaricaSerieA() {
  const tutti = []
  let pagine = 0

  for (let pagina = 1; pagina <= 10; pagina++) {
    const indirizzo =
      `${RICERCA.host}/collections/${RICERCA.raccolta}/documents/search?` +
      new URLSearchParams({
        q: '*',
        query_by: 'name',
        filter_by: `classification_id:=player && division.id:=${RICERCA.serieA}`,
        sort_by: 'reputation:desc',
        per_page: '250',
        page: String(pagina),
      })

    let r
    try {
      r = await fetch(indirizzo, { headers: { 'X-TYPESENSE-API-KEY': RICERCA.chiave } })
    } catch (e) {
      throw new Error(
        `Il servizio di ricerca non risponde (${e.message}).\n` +
          "ADR-0011 lo prevede: l'abbinamento manuale resta disponibile.",
      )
    }
    if (!r.ok) {
      throw new Error(
        `Il servizio di ricerca ha risposto ${r.status}.\n` +
          `${(await r.text()).slice(0, 200)}\n` +
          "ADR-0011 lo prevede: l'indirizzo non è documentato e può cambiare.",
      )
    }

    const j = await r.json()
    pagine++
    for (const h of j.hits ?? []) {
      const d = h.document
      if (!d.fm_id) continue
      tutti.push({
        fm_id: Number(d.fm_id),
        nome: d.name,
        squadra: d.team?.name ?? '',
        squadra_fm_id: d.team?.fm_id ?? null,
        reputazione: d.reputation ?? 0,
        alternative: d.search_terms ?? [],
      })
    }
    if (pagina * 250 >= (j.found ?? 0)) break
  }

  mkdirSync(CACHE, { recursive: true })
  writeFileSync(ELENCO_FM, JSON.stringify(tutti, null, 1))
  return { calciatori: tutti, richieste: pagine }
}

// ─── L'accesso con cui si carica nell'archivio ──────────────────────────────

/**
 * PERCHE' UN ACCOUNT DI SERVIZIO E NON LA PASSWORD DEL PROPRIETARIO
 *
 * Caricare nell'archivio richiede un utente che amministri l'applicazione.
 * Chiedere la password personale per farla scrivere in un file sarebbe la
 * strada corta e la peggiore: quella password apre l'account, non solo questo
 * archivio.
 *
 * Lo script si crea un account suo, gli dà i permessi con la chiave di
 * gestione che già usa per le migrazioni, e **lo toglie appena finito**.
 */
export async function accessoDiServizio(nome = 'caricatore') {
  const email = `${nome}@fantasta.servizio`
  const password = `serv-${Math.random().toString(36).slice(2)}-${Date.now()}`

  await sql(`delete from auth.users where email = '${email}';`)

  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { display_name: 'Servizio' } }),
  })
  const j = await r.json()
  if (!j.access_token) {
    throw new Error(`Non riesco a creare l'accesso di servizio: ${JSON.stringify(j)}`)
  }

  await sql(`insert into public.app_admins (user_id) values ('${j.user.id}')
             on conflict do nothing;`)

  return { token: j.access_token, email }
}

export async function chiudiAccessoDiServizio(email) {
  await sql(`delete from auth.users where email = '${email}';`)
}
