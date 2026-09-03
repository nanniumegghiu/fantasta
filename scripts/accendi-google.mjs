// ═══════════════════════════════════════════════════════════════════════════
// Accende l'accesso con Google.
//
// COSA FA E COSA NON PUO' FARE
//
// Configura il provider su Supabase, riaccende il pulsante nell'app e fa
// ripartire la pubblicazione. Non puo' pero' **creare** le credenziali su
// Google Cloud: quella parte richiede un browser e un account Google, e va
// fatta a mano una volta sola. Le istruzioni le stampa questo script stesso,
// con gia' dentro l'indirizzo di ritorno da incollare.
//
// LE CREDENZIALI NON SI INCOLLANO IN CHAT
// Vanno in `.env.local`, che non e' versionato. E' la regola del progetto e
// vale anche qui: un identificativo e un segreto OAuth in una conversazione
// restano in una conversazione.
//
// Uso:
//   node scripts/accendi-google.mjs --istruzioni   cosa fare su Google Cloud
//   node scripts/accendi-google.mjs                accende, quando le chiavi ci sono
//   node scripts/accendi-google.mjs --spegni       torna indietro
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')

function leggiEnv(p) {
  const v = {}
  for (const riga of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = riga.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) v[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return v
}

const envApp = leggiEnv(join(radice, 'app', '.env.local'))
const envRad = leggiEnv(join(radice, '.env.local'))
const URL_BASE = envApp.VITE_SUPABASE_URL
const ref = URL_BASE.replace('https://', '').split('.')[0]

// L'indirizzo a cui Google rimanda dopo l'accesso. Lo decide Supabase, non
// noi: e' sempre <progetto>.supabase.co/auth/v1/callback.
const RITORNO = `${URL_BASE}/auth/v1/callback`
const SITO = 'https://nanniumegghiu.github.io/fantasta'

async function configurazione(metodo, corpo) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${envRad.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 300)}`)
  return JSON.parse(t)
}

// ─── Le istruzioni ──────────────────────────────────────────────────────────

function istruzioni() {
  console.log(`
Per accendere l'accesso con Google servono due valori che solo tu puoi
creare, perché richiedono il tuo account Google. Sono cinque minuti.

  1. Vai su  https://console.cloud.google.com/apis/credentials

  2. Se non hai un progetto, creane uno. Il nome non conta: "Fantasta" va bene.

  3. La prima volta chiede di configurare la schermata di consenso:
       · Tipo utente: Esterno
       · Nome applicazione: Fantasta
       · Email di assistenza e di contatto: la tua
       · Non serve aggiungere ambiti né utenti di prova
     Lasciala in stato di test: bastano cento accessi, e voi siete otto.

  4. "Crea credenziali" → "ID client OAuth"
       · Tipo di applicazione: Applicazione web
       · Nome: Fantasta

  5. In "URI di reindirizzamento autorizzati" incolla ESATTAMENTE questo,
     una riga sola:

       ${RITORNO}

     È l'indirizzo di Supabase, non quello dell'app: Google parla con
     Supabase, e Supabase poi rimanda dentro Fantasta. Se qui metti
     l'indirizzo del sito, l'accesso fallisce con "redirect_uri_mismatch".

  6. Premi Crea. Ti mostra un identificativo e un segreto.

  7. Aprili in  ${join(radice, '.env.local')}
     e incollali su queste due righe, senza virgolette:

       GOOGLE_OAUTH_CLIENT_ID=...
       GOOGLE_OAUTH_CLIENT_SECRET=...

     Quel file non finisce su GitHub. Non incollarli in chat.

  8. Torna qui e lancia:  node scripts/accendi-google.mjs

Per la cronaca, l'app sta su  ${SITO}
e nessuno la usa per accedere a Google: quel passaggio lo fa Supabase.
`)
}

if (process.argv.includes('--istruzioni')) {
  istruzioni()
  process.exit(0)
}

// ─── Spegnere ───────────────────────────────────────────────────────────────

if (process.argv.includes('--spegni')) {
  await configurazione('PATCH', { external_google_enabled: false })
  const f = join(radice, 'app', '.env.local')
  writeFileSync(
    f,
    readFileSync(f, 'utf8').replace(/VITE_GOOGLE_ABILITATO=.*/, 'VITE_GOOGLE_ABILITATO=false'),
  )
  console.log('Accesso con Google spento. Il pulsante sparisce alla prossima pubblicazione.')
  process.exit(0)
}

// ─── Accendere ──────────────────────────────────────────────────────────────

const idCliente = envRad.GOOGLE_OAUTH_CLIENT_ID
const segreto = envRad.GOOGLE_OAUTH_CLIENT_SECRET

if (!idCliente || !segreto) {
  console.log('Le due chiavi di Google non ci sono ancora in .env.local.\n')
  istruzioni()
  process.exit(1)
}

// Un errore di copia si vede subito, e vale la pena dirlo prima di provare.
if (!idCliente.endsWith('.apps.googleusercontent.com')) {
  console.error(
    `GOOGLE_OAUTH_CLIENT_ID non sembra un identificativo di Google:\n` +
      `  «${idCliente.slice(0, 30)}…»\n` +
      `Dovrebbe finire con .apps.googleusercontent.com`,
  )
  process.exit(1)
}

console.log('Accendo il provider su Supabase…')
const dopo = await configurazione('PATCH', {
  external_google_enabled: true,
  external_google_client_id: idCliente,
  external_google_secret: segreto,
  // Il ritorno passa da Supabase e poi torna nell'app: gli indirizzi
  // consentiti devono comprendere il sito pubblicato e quelli locali.
  site_url: SITO,
  uri_allow_list: [`${SITO}/**`, 'http://localhost:5173/**', 'http://localhost:4173/**'].join(','),
})

console.log(`  provider attivo: ${dopo.external_google_enabled}`)
console.log(`  indirizzi consentiti: ${dopo.uri_allow_list}`)

// L'app deve saperlo, altrimenti il pulsante resta nascosto: e' la regola
// «niente bugie all'interfaccia», che vale anche al contrario.
const f = join(radice, 'app', '.env.local')
writeFileSync(
  f,
  readFileSync(f, 'utf8').replace(/VITE_GOOGLE_ABILITATO=.*/, 'VITE_GOOGLE_ABILITATO=true'),
)
console.log('  pulsante acceso in locale (app/.env.local)')

// E online: la compilazione remota legge una variabile del repository.
try {
  execFileSync('gh', ['variable', 'set', 'VITE_GOOGLE_ABILITATO', '--body', 'true',
    '--repo', 'nanniumegghiu/fantasta'], { stdio: 'pipe' })
  console.log('  pulsante acceso online (variabile del repository)')
  execFileSync('gh', ['workflow', 'run', 'pubblica.yml', '--repo', 'nanniumegghiu/fantasta'],
    { stdio: 'pipe' })
  console.log('  pubblicazione ripartita')
} catch (e) {
  console.log(`  online non sono riuscito: ${String(e.message).slice(0, 120)}`)
  console.log('  fallo a mano: gh variable set VITE_GOOGLE_ABILITATO --body true')
}

console.log(`\nFatto. Provalo su ${SITO}`)
console.log('Se Google dice "redirect_uri_mismatch", il passo 5 delle istruzioni non combacia:')
console.log(`  deve essere esattamente  ${RITORNO}`)
