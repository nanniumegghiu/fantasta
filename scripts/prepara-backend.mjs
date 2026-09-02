// ═══════════════════════════════════════════════════════════════════════════
// Prepara il backend di Fantasta senza passaggi manuali nel pannello.
//
// Cosa fa, in ordine:
//   1. legge le credenziali da .env.local (mai da questa chat)
//   2. trova o crea il progetto Supabase
//   3. aspetta che sia pronto
//   4. legge le chiavi pubbliche e scrive app/.env.local
//   5. applica le migrazioni non ancora applicate, in ordine
//
// E' ripetibile: rilanciarlo non crea doppioni e non riapplica le migrazioni.
//
// Uso:  node scripts/prepara-backend.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.supabase.com/v1'

const NOME_PROGETTO = 'fantasta'
const REGIONE = 'eu-central-1' // Francoforte: la piu' vicina all'Italia

// ─── Lettura di .env.local, senza librerie ──────────────────────────────────

function leggiEnvLocale(percorso) {
  if (!existsSync(percorso)) return {}
  const valori = {}
  for (const riga of readFileSync(percorso, 'utf8').split(/\r?\n/)) {
    const pulita = riga.trim()
    if (!pulita || pulita.startsWith('#')) continue
    const i = pulita.indexOf('=')
    if (i === -1) continue
    valori[pulita.slice(0, i).trim()] = pulita.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return valori
}

const env = leggiEnvLocale(join(radice, '.env.local'))
const token = env.SUPABASE_ACCESS_TOKEN
const passwordDb = env.SUPABASE_DB_PASSWORD

if (!token || !passwordDb) {
  console.error(`
Mancano le credenziali.

  1. Copia .env.example in .env.local  (stessa cartella)
  2. Riempi SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD
  3. Rilancia questo comando

Il file .env.local e' escluso dal versionamento: non finira' mai su GitHub.
Le istruzioni su dove trovare il token sono dentro .env.example.
`)
  process.exit(1)
}

// ─── Chiamate all'API di gestione ───────────────────────────────────────────

async function api(percorso, opzioni = {}) {
  const risposta = await fetch(`${API}${percorso}`, {
    ...opzioni,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opzioni.headers ?? {}),
    },
  })
  const testo = await risposta.text()
  if (!risposta.ok) {
    throw new Error(`${opzioni.method ?? 'GET'} ${percorso} → ${risposta.status}\n${testo}`)
  }
  return testo ? JSON.parse(testo) : null
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── 1. Progetto ────────────────────────────────────────────────────────────

async function trovaOCreaProgetto() {
  const progetti = await api('/projects')
  const esistente = progetti.find((p) => p.name === NOME_PROGETTO)
  if (esistente) {
    console.log(`Progetto gia' esistente: ${esistente.name} (${esistente.id})`)
    return esistente
  }

  const organizzazioni = await api('/organizations')
  if (organizzazioni.length === 0) {
    throw new Error('Nessuna organizzazione sul tuo account Supabase.')
  }
  const org = organizzazioni[0]
  console.log(`Creo il progetto "${NOME_PROGETTO}" nell'organizzazione "${org.name}"...`)

  return api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: NOME_PROGETTO,
      organization_id: org.id,
      region: REGIONE,
      db_pass: passwordDb,
      plan: 'free',
    }),
  })
}

async function attendiAttivo(ref) {
  for (let tentativo = 0; tentativo < 60; tentativo++) {
    const progetto = await api(`/projects/${ref}`)
    if (progetto.status === 'ACTIVE_HEALTHY') return progetto
    process.stdout.write(`  stato: ${progetto.status}\r`)
    await attendi(5000)
  }
  throw new Error('Il progetto non e\' diventato attivo entro cinque minuti.')
}

// ─── 2. Chiavi pubbliche ────────────────────────────────────────────────────

async function leggiChiaveAnonima(ref) {
  let chiavi
  try {
    chiavi = await api(`/projects/${ref}/api-keys?reveal=true`)
  } catch {
    chiavi = await api(`/projects/${ref}/api-keys`)
  }
  const anonima = chiavi.find((k) => k.name === 'anon' || k.type === 'publishable')
  if (!anonima?.api_key) throw new Error('Chiave anonima non trovata nella risposta dell\'API.')
  return anonima.api_key
}

// ─── 3. Migrazioni ──────────────────────────────────────────────────────────

async function eseguiSql(ref, query) {
  return api(`/projects/${ref}/database/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

async function applicaMigrazioni(ref) {
  // Registro delle migrazioni applicate. E' una tabella di servizio: nessun
  // utente vi accede, quindi resta senza policy e con RLS attiva, che significa
  // "nessuno la legge dal client".
  await eseguiSql(
    ref,
    `create table if not exists public.migrazioni_applicate (
       nome text primary key,
       applicata_il timestamptz not null default now()
     );
     alter table public.migrazioni_applicate enable row level security;`,
  )

  const cartella = join(radice, 'app', 'supabase', 'migrations')
  const file = readdirSync(cartella).filter((f) => f.endsWith('.sql')).sort()

  const giaApplicate = new Set(
    (await eseguiSql(ref, 'select nome from public.migrazioni_applicate;')).map((r) => r.nome),
  )

  let nuove = 0
  for (const nome of file) {
    if (giaApplicate.has(nome)) {
      console.log(`  = ${nome} (gia' applicata)`)
      continue
    }
    const sql = readFileSync(join(cartella, nome), 'utf8')
    console.log(`  + ${nome} ...`)
    await eseguiSql(ref, sql)
    await eseguiSql(
      ref,
      `insert into public.migrazioni_applicate (nome) values ('${nome.replace(/'/g, "''")}');`,
    )
    nuove++
  }
  return { totali: file.length, nuove }
}

// ─── Esecuzione ─────────────────────────────────────────────────────────────

const progetto = await trovaOCreaProgetto()
const ref = progetto.id

console.log('Aspetto che il progetto sia pronto...')
await attendiAttivo(ref)
console.log('Progetto attivo.                    ')

const url = `https://${ref}.supabase.co`
const chiaveAnonima = await leggiChiaveAnonima(ref)

const percorsoEnvApp = join(radice, 'app', '.env.local')
writeFileSync(
  percorsoEnvApp,
  `# Generato da scripts/prepara-backend.mjs. Categoria: PUBBLICA.\n` +
    `VITE_SUPABASE_URL=${url}\n` +
    `VITE_SUPABASE_ANON_KEY=${chiaveAnonima}\n`,
)
console.log(`Scritto app/.env.local con URL e chiave anonima.`)

console.log('Applico le migrazioni:')
const esito = await applicaMigrazioni(ref)

console.log(`
Fatto.
  Progetto:   ${NOME_PROGETTO} (${ref})
  Indirizzo:  ${url}
  Migrazioni: ${esito.nuove} nuove su ${esito.totali} totali

Prossimo passo: cd app && npm run dev
`)
