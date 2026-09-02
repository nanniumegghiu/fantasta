// ═══════════════════════════════════════════════════════════════════════════
// Prova a violare le regole di accesso, e mostra l'esito.
//
// Segue .claude/skills/verifica-sicurezza/SKILL.md: "Ho scritto la policy" non
// e' una verifica. La verifica e' provare a leggere il dato di un altro e
// ottenere zero righe.
//
// Crea due utenti di prova, poi tenta le violazioni. Gli utenti restano nel
// progetto: si cancellano con --pulisci.
//
// Uso:  node scripts/verifica-sicurezza.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')

function leggiEnv(percorso) {
  const v = {}
  for (const riga of readFileSync(percorso, 'utf8').split(/\r?\n/)) {
    const t = riga.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    v[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return v
}

const envApp = leggiEnv(join(radice, 'app', '.env.local'))
const envRadice = leggiEnv(join(radice, '.env.local'))
const URL_BASE = envApp.VITE_SUPABASE_URL
const CHIAVE = envApp.VITE_SUPABASE_ANON_KEY
const ref = URL_BASE.replace('https://', '').split('.')[0]

const esiti = []
function esito(nome, superata, dettaglio) {
  esiti.push({ nome, superata, dettaglio })
  console.log(`${superata ? '  OK  ' : ' FALLITA '} ${nome}\n         ${dettaglio}`)
}

async function auth(percorso, corpo) {
  const r = await fetch(`${URL_BASE}/auth/v1${percorso}`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const t = await r.json()
  if (!r.ok) throw new Error(`${percorso}: ${JSON.stringify(t)}`)
  return t
}

async function leggiProfili(token, filtro = '') {
  const r = await fetch(`${URL_BASE}/rest/v1/profiles?select=id,display_name${filtro}`, {
    headers: {
      apikey: CHIAVE,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  return { stato: r.status, corpo: await r.json() }
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${envRadice.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(t)
  return JSON.parse(t)
}

// ─── Pulizia ────────────────────────────────────────────────────────────────

if (process.argv.includes('--pulisci')) {
  const via = await sql(
    "delete from auth.users where email like 'prova.%@fantasta.test' returning email;",
  )
  console.log(`Utenti di prova rimossi: ${via.length}`)
  process.exit(0)
}

// ─── Preparazione: due utenti veri ──────────────────────────────────────────

const marchio = Date.now()
const A = { email: `prova.a.${marchio}@fantasta.test`, password: 'prova-lunga-1', nome: 'Utente A' }
const B = { email: `prova.b.${marchio}@fantasta.test`, password: 'prova-lunga-2', nome: 'Utente B' }

console.log('Creo due utenti di prova...\n')

const regA = await auth('/signup', {
  email: A.email,
  password: A.password,
  data: { display_name: A.nome },
})
const regB = await auth('/signup', {
  email: B.email,
  password: B.password,
  data: { display_name: B.nome },
})

const tokenA = regA.access_token
const tokenB = regB.access_token
const idA = regA.user?.id
const idB = regB.user?.id

if (!tokenA || !tokenB) {
  console.error('La registrazione non restituisce una sessione. Conferma email ancora attiva?')
  process.exit(1)
}

// ─── Prova 1: il trigger crea il profilo ────────────────────────────────────

const profili = await sql(
  `select id, display_name from public.profiles where id in ('${idA}','${idB}') order by display_name;`,
)
esito(
  'Il profilo nasce insieme all utente',
  profili.length === 2 && profili[0].display_name === 'Utente A',
  `righe trovate: ${profili.length}, nomi: ${profili.map((p) => p.display_name).join(', ')}`,
)

// ─── Prova 2: lettura legittima ─────────────────────────────────────────────

const suo = await leggiProfili(tokenA)
esito(
  'A legge il proprio profilo',
  Array.isArray(suo.corpo) && suo.corpo.length === 1 && suo.corpo[0].id === idA,
  `HTTP ${suo.stato}, righe: ${Array.isArray(suo.corpo) ? suo.corpo.length : '?'}`,
)

// ─── Prova 3: la violazione che conta ───────────────────────────────────────

const altrui = await leggiProfili(tokenA, `&id=eq.${idB}`)
esito(
  'A NON legge il profilo di B',
  Array.isArray(altrui.corpo) && altrui.corpo.length === 0,
  `HTTP ${altrui.stato}, righe: ${JSON.stringify(altrui.corpo)}`,
)

// ─── Prova 4: chi non ha fatto accesso non vede niente ──────────────────────

const anonimo = await leggiProfili(null)
esito(
  'Senza accesso non si legge nessun profilo',
  Array.isArray(anonimo.corpo) && anonimo.corpo.length === 0,
  `HTTP ${anonimo.stato}, righe: ${JSON.stringify(anonimo.corpo)}`,
)

// ─── Prova 5: A non puo' modificare il profilo di B ─────────────────────────

const modifica = await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${idB}`, {
  method: 'PATCH',
  headers: {
    apikey: CHIAVE,
    Authorization: `Bearer ${tokenA}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ display_name: 'RUBATO' }),
})
const corpoModifica = await modifica.json()
const nomeBDopo = (
  await sql(`select display_name from public.profiles where id = '${idB}';`)
)[0]?.display_name
esito(
  'A NON puo modificare il profilo di B',
  nomeBDopo === 'Utente B',
  `HTTP ${modifica.status}, righe toccate: ${JSON.stringify(corpoModifica)}, nome di B ora: ${nomeBDopo}`,
)

// ─── Prova 6: nessuno puo' inserirsi un profilo a mano ──────────────────────

const inserimento = await fetch(`${URL_BASE}/rest/v1/profiles`, {
  method: 'POST',
  headers: { apikey: CHIAVE, Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: crypto.randomUUID(), display_name: 'Fantasma' }),
})
esito(
  'Nessuno crea profili a mano',
  inserimento.status >= 400,
  `HTTP ${inserimento.status} (atteso 4xx): ${(await inserimento.text()).slice(0, 120)}`,
)

// ─── Prova 7: la tabella di servizio non e' leggibile dal client ────────────

const servizio = await fetch(`${URL_BASE}/rest/v1/migrazioni_applicate?select=nome`, {
  headers: { apikey: CHIAVE, Authorization: `Bearer ${tokenA}` },
})
const corpoServizio = await servizio.json()
esito(
  'Il registro delle migrazioni non si legge dal client',
  !Array.isArray(corpoServizio) || corpoServizio.length === 0,
  `HTTP ${servizio.status}, righe: ${JSON.stringify(corpoServizio).slice(0, 120)}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.superata)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length > 0) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Nessuna violazione riuscita.')
console.log('Per rimuovere gli utenti di prova: node scripts/verifica-sicurezza.mjs --pulisci')
