// ═══════════════════════════════════════════════════════════════════════════
// Verifica dei volti: chi li puo' mettere, e cosa non si deve poter perdere.
//
// LA PROVA CHE CONTA PIU' DI TUTTE
//
// Una corrispondenza **confermata a mano** non deve essere sovrascritta da un
// giro automatico. Chi rivede sistema i casi difficili — omonimi, nomi scritti
// strani — e sono esattamente quelli che l'algoritmo continuera' a sbagliare
// allo stesso modo la stagione prossima. Se il giro automatico li
// ricalpestasse, quel lavoro andrebbe rifatto ogni anno e nessuno lo farebbe
// piu' di una volta.
//
// L'altra meta' sono i permessi: le immagini le gestisce chi amministra
// l'applicazione, e la prova va fatta provando a violarla.
//
// Uso:  node scripts/verifica-volti.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
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
const CHIAVE = envApp.VITE_SUPABASE_ANON_KEY
const ref = URL_BASE.replace('https://', '').split('.')[0]

// Una stagione tutta sua: `importa_listone` ritira i calciatori della stagione
// che carica, e due suite che la condividono si spengono il listone a vicenda.
const STAGIONE_DI_PROVA = 'PROVA-VOLTI'

async function sql(query) {
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

async function pulisci() {
  // Prima le leghe: un calciatore in una rosa non si cancella.
  await sql(`delete from public.leagues
    where admin_user_id in (select id from auth.users where email like '%@fantasta.test');`)
  await sql('delete from public.player_stats where player_id >= 900000;')
  await sql('delete from public.players where id >= 900000;')
  await sql("delete from auth.users where email like '%@fantasta.test';")
  // Le immagini no: l'archivio si difende dalle cancellazioni fatte in SQL,
  // e ha ragione — una riga tolta a mano lascerebbe il file orfano. Si tolgono
  // in fondo alla prova, dove c'è un accesso da amministratore per farlo come
  // si deve.
}

/** Toglie le immagini di prova passando dall'archivio, non dal database. */
async function pulisciImmagini(u) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/volti`, {
    method: 'DELETE',
    headers: testa(u),
    body: JSON.stringify({
      prefixes: [
        `${STAGIONE_DI_PROVA}/906401.png`,
        `${STAGIONE_DI_PROVA}/906402.png`,
        `${STAGIONE_DI_PROVA}/906402b.png`,
        `${STAGIONE_DI_PROVA}/906403.png`,
        `${STAGIONE_DI_PROVA}/906404.png`,
      ],
    }),
  })
  return r.status
}

if (process.argv.includes('--pulisci')) {
  await pulisci()
  console.log('Dati di prova rimossi.')
  process.exit(0)
}

const esiti = []
function esito(nome, ok, dettaglio) {
  esiti.push({ nome, ok })
  console.log(`${ok ? '  OK  ' : ' FALLITA '} ${nome}`)
  console.log(`         ${dettaglio}`)
}

async function registra(nome) {
  const email = `prova.${nome}.${Date.now()}${Math.floor(Math.random() * 1000)}@fantasta.test`
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password-di-prova', data: { display_name: nome } }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`registrazione fallita: ${JSON.stringify(j)}`)
  return { email, token: j.access_token, id: j.user.id }
}

const testa = (u) => ({
  apikey: CHIAVE,
  ...(u ? { Authorization: `Bearer ${u.token}` } : {}),
  'Content-Type': 'application/json',
})

async function rpc(u, funzione, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: testa(u),
    body: JSON.stringify(corpo ?? {}),
  })
  const c = await r.json().catch(() => null)
  return { stato: r.status, riga: Array.isArray(c) ? c[0] : c, corpo: c }
}

async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, { headers: testa(u) })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

/** Un PNG minimo e valido, per provare l'archivio senza dipendere dal facepack. */
const PNG_MINIMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function caricaImmagine(u, percorso) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/volti/${percorso}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: PNG_MINIMO,
  })
  return { stato: r.status, corpo: await r.text() }
}

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Preparo un listone di prova e due persone.\n')
await pulisci()

const capo = await registra('capo')
const chiunque = await registra('chiunque')
await sql(`insert into public.app_admins (user_id) values ('${capo.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 906401, nome: 'Volto Uno', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 906402, nome: 'Volto Due', ruolo: 'D', squadra: 'Prova FC', quotazione: 20 },
  { id: 906403, nome: 'Volto Tre', ruolo: 'C', squadra: 'Prova FC', quotazione: 30 },
  { id: 906404, nome: 'Volto Quattro', ruolo: 'A', squadra: 'Prova FC', quotazione: 40 },
]
await rpc(capo, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

// ─── 1. I permessi ──────────────────────────────────────────────────────────

const daChiunque = await rpc(chiunque, 'imposta_volto', {
  p_player_id: 906401,
  p_fm_id: 1,
  p_percorso: `${STAGIONE_DI_PROVA}/906401.png`,
  p_origine: 'scaricata',
})
esito(
  'I volti li mette solo chi amministra l applicazione',
  daChiunque.stato >= 400,
  `HTTP ${daChiunque.stato}: ${String(daChiunque.corpo?.message ?? '').slice(0, 70)}`,
)

const caricaDaChiunque = await caricaImmagine(chiunque, `${STAGIONE_DI_PROVA}/906401.png`)
const caricaDaCapo = await caricaImmagine(capo, `${STAGIONE_DI_PROVA}/906401.png`)
esito(
  'Nell archivio delle immagini carica solo chi amministra',
  caricaDaChiunque.stato >= 400 && caricaDaCapo.stato < 300,
  `chiunque: HTTP ${caricaDaChiunque.stato} · amministratore: HTTP ${caricaDaCapo.stato}`,
)

const elenco = await fetch(`${URL_BASE}/storage/v1/object/list/volti`, {
  method: 'POST',
  headers: testa(chiunque),
  body: JSON.stringify({ prefix: STAGIONE_DI_PROVA, limit: 10 }),
})
const visti = await elenco.json().catch(() => null)
esito(
  'Le immagini le vede chiunque abbia fatto l accesso',
  elenco.status === 200 && Array.isArray(visti) && visti.length >= 1,
  `HTTP ${elenco.status}, immagini viste: ${Array.isArray(visti) ? visti.length : '—'}`,
)

// ─── 2. La regola che vale piu' di tutte ────────────────────────────────────

await rpc(capo, 'imposta_volto', {
  p_player_id: 906402,
  p_fm_id: 111,
  p_percorso: `${STAGIONE_DI_PROVA}/906402.png`,
  p_origine: 'confermata',
})

const sovrascrittura = await rpc(capo, 'imposta_volto', {
  p_player_id: 906402,
  p_fm_id: 999,
  p_percorso: `${STAGIONE_DI_PROVA}/sbagliata.png`,
  p_origine: 'dedotta',
})
const dopo = (await sql(`select fm_id, photo_path, fm_origine from public.players
  where id = 906402;`))[0]
esito(
  'Un volto confermato a mano non lo sovrascrive nessun giro automatico',
  sovrascrittura.corpo === 0 && Number(dopo.fm_id) === 111 && dopo.fm_origine === 'confermata',
  `righe toccate: ${sovrascrittura.corpo}; resta fm ${dopo.fm_id}, origine ${dopo.fm_origine}`,
)

const secondaConferma = await rpc(capo, 'imposta_volto', {
  p_player_id: 906402,
  p_fm_id: 222,
  p_percorso: `${STAGIONE_DI_PROVA}/906402b.png`,
  p_origine: 'confermata',
})
const dopoSeconda = (await sql('select fm_id from public.players where id = 906402;'))[0]
esito(
  'Ma una persona puo cambiare idea: una conferma sostituisce una conferma',
  secondaConferma.corpo === 1 && Number(dopoSeconda.fm_id) === 222,
  `fm ora ${dopoSeconda.fm_id}`,
)

// ─── 3. Il caricamento in blocco ────────────────────────────────────────────

const inBlocco = await rpc(capo, 'imposta_volti', {
  p_righe: [
    { calciatore: 906401, fm_id: 11, percorso: `${STAGIONE_DI_PROVA}/906401.png`, origine: 'scaricata' },
    { calciatore: 906402, fm_id: 22, percorso: `${STAGIONE_DI_PROVA}/x.png`, origine: 'scaricata' },
    { calciatore: 906403, fm_id: 33, percorso: `${STAGIONE_DI_PROVA}/906403.png`, origine: 'dedotta' },
  ],
})
esito(
  'Il caricamento in blocco dice quanti ne ha scritti e quanti ne ha saltati',
  inBlocco.riga?.aggiornati === 2 && inBlocco.riga?.saltati === 1,
  `aggiornati ${inBlocco.riga?.aggiornati}, saltati ${inBlocco.riga?.saltati} (il confermato a mano)`,
)

// ─── 4. Togliere e confermare ───────────────────────────────────────────────

const togliDaChiunque = await rpc(chiunque, 'togli_volto', { p_player_id: 906401 })
esito(
  'Un volto non lo toglie chi capita',
  togliDaChiunque.stato >= 400,
  `HTTP ${togliDaChiunque.stato}`,
)

await rpc(capo, 'togli_volto', { p_player_id: 906401 })
const tolto = (await sql(`select photo_path, fm_id, fm_origine from public.players
  where id = 906401;`))[0]
esito(
  'Togliere un volto porta via anche l identificativo, non solo l immagine',
  tolto.photo_path === null && tolto.fm_id === null && tolto.fm_origine === null,
  `percorso ${tolto.photo_path}, fm ${tolto.fm_id}, origine ${tolto.fm_origine}`,
)

const confermaSenzaFoto = await rpc(capo, 'conferma_volto', { p_player_id: 906401 })
esito(
  'Non si conferma una faccia che non c e',
  confermaSenzaFoto.corpo === false,
  `risposta: ${JSON.stringify(confermaSenzaFoto.corpo)}`,
)

await rpc(capo, 'conferma_volto', { p_player_id: 906403 })
const confermato = (await sql('select fm_origine from public.players where id = 906403;'))[0]
esito(
  'Confermare cambia l origine e basta: la faccia resta quella',
  confermato.fm_origine === 'confermata',
  `origine ora ${confermato.fm_origine}`,
)

// ─── 5. A chi guardare ──────────────────────────────────────────────────────

const daRivedere = await leggi(
  capo,
  `volti_da_rivedere?select=id,name,motivo&season=eq.${STAGIONE_DI_PROVA}&order=id`,
)
const ids = (daRivedere.corpo ?? []).map((r) => r.id)
esito(
  'Da rivedere ci sono i mancanti e i dedotti, non gli abbinamenti affidabili',
  ids.includes(906401) && ids.includes(906404) && !ids.includes(906402) && !ids.includes(906403),
  `da rivedere: ${(daRivedere.corpo ?? []).map((r) => `${r.name} (${r.motivo})`).join(', ')}`,
)

const motivi = Object.fromEntries((daRivedere.corpo ?? []).map((r) => [r.id, r.motivo]))
esito(
  'Il motivo distingue chi va caricato da chi va guardato',
  motivi[906401] === 'manca' && motivi[906404] === 'manca',
  `906401: ${motivi[906401]} · 906404: ${motivi[906404]}`,
)

// Si aggiunge un dedotto e deve ricomparire con l'altro motivo.
await rpc(capo, 'imposta_volti', {
  p_righe: [
    { calciatore: 906404, fm_id: 44, percorso: `${STAGIONE_DI_PROVA}/906404.png`, origine: 'dedotta' },
  ],
})
const conDedotto = await leggi(
  capo,
  `volti_da_rivedere?select=id,motivo&season=eq.${STAGIONE_DI_PROVA}&id=eq.906404`,
)
esito(
  'Un volto dedotto dal solo cognome finisce fra quelli da controllare',
  conDedotto.corpo?.[0]?.motivo === 'da_controllare',
  `motivo: ${conDedotto.corpo?.[0]?.motivo}`,
)

// ─── 6. Il listone vero non si tocca ────────────────────────────────────────
//
// Le prove scrivono nell'archivio e nella tabella dei calciatori: la stessa
// sentinella di verifica-listone, per la stessa ragione. E' gia' successo di
// cancellare il listone vero.

const veriConVolto = (await sql(`select count(*)::int n from public.players
  where id < 900000 and photo_path is not null;`))[0].n
esito(
  'I volti del listone vero non sono stati toccati',
  veriConVolto > 0,
  `calciatori veri con la foto: ${veriConVolto}`,
)

// ─── Si sparecchia ──────────────────────────────────────────────────────────

const statoPulizia = await pulisciImmagini(capo)
const rimaste = await fetch(`${URL_BASE}/storage/v1/object/list/volti`, {
  method: 'POST',
  headers: testa(capo),
  body: JSON.stringify({ prefix: STAGIONE_DI_PROVA, limit: 10 }),
})
const quanteRimaste = (await rimaste.json().catch(() => []))?.length ?? 0
esito(
  'Le immagini di prova si tolgono dall archivio, e non restano orfane',
  statoPulizia < 300 && quanteRimaste === 0,
  `HTTP ${statoPulizia}, immagini rimaste sotto ${STAGIONE_DI_PROVA}: ${quanteRimaste}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-volti.mjs --pulisci')
