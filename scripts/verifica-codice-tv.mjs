// ═══════════════════════════════════════════════════════════════════════════
// Verifica del codice per la TV.
//
// LA PROVA CHE CONTA PIU' DI TUTTE
//
// Questo e' l'unico punto dell'applicazione dove si vedono dati di una lega
// **senza farne parte**. Il confine non e' l'interfaccia: e' quello che la
// funzione `schermo_tv` restituisce, e quello che non restituisce.
//
// Quindi meta' di queste prove non controlla che qualcosa funzioni: controlla
// che qualcosa **non ci sia**. Nessuna lista obiettivi, nessun tetto di spesa,
// nessuna nota personale, nessun indirizzo email. Se un giorno qualcuno
// aggiungesse un campo di troppo a quella funzione, e' qui che si deve
// fermare.
//
// Uso:  node scripts/verifica-codice-tv.mjs [--pulisci]
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

const STAGIONE_DI_PROVA = 'PROVA-TV'

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

if (process.argv.includes('--pulisci')) {
  await sql(`delete from public.leagues
    where admin_user_id in (select id from auth.users where email like '%@fantasta.test');`)
  await sql('delete from public.player_stats where player_id >= 900000;')
  await sql('delete from public.players where id >= 900000;')
  await sql("delete from auth.users where email like '%@fantasta.test';")
  // Gli utenti anonimi creati dalle prove: non hanno email, si riconoscono cosi'.
  await sql("delete from auth.users where is_anonymous = true;")
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

/** Il visitatore del televisore: entra senza dire chi è. */
async function accessoAnonimo() {
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`accesso anonimo fallito: ${JSON.stringify(j)}`)
  return { token: j.access_token, id: j.user.id }
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

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Preparo una lega con un asta viva.\n')

const capo = await registra('capo')
const amico = await registra('amico')
await sql(`insert into public.app_admins (user_id) values ('${capo.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 904801, nome: 'Tivu Portiere', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 904802, nome: 'Tivu Difensore', ruolo: 'D', squadra: 'Prova FC', quotazione: 12 },
  { id: 904803, nome: 'Tivu Centrocampo', ruolo: 'C', squadra: 'Prova FC', quotazione: 14 },
  { id: 904804, nome: 'Tivu Attaccante', ruolo: 'A', squadra: 'Prova FC', quotazione: 30 },
]
await rpc(capo, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (await rpc(capo, 'crea_lega', {
  p_nome: 'Lega TV',
  p_stagione: STAGIONE_DI_PROVA,
  p_nome_squadra: 'Squadra Capo',
  p_crediti: 100,
  p_slot_p: 1, p_slot_d: 1, p_slot_c: 1, p_slot_a: 1,
  p_max_partecipanti: 4,
})).riga
const codiceInvito = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
await rpc(amico, 'entra_in_lega', { p_codice: codiceInvito, p_nome_squadra: 'Squadra Amico' })

// Una lista obiettivi con nota e tetto: è la cosa che non deve trapelare.
const lista = (await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })).corpo
const fascia = (await sql(`select id from public.tiers
  where list_id = '${lista}' and role = 'A' limit 1;`))[0].id
await rpc(amico, 'aggiungi_a_fascia', { p_fascia: fascia, p_calciatori: [904804] })
await sql(`update public.targets set note = 'SEGRETO: lo voglio a tutti i costi', max_price = 77
  where list_id = '${lista}' and player_id = 904804;`)

await rpc(capo, 'configura_asta', {
  p_lega: lega, p_metodo: 'chiamata', p_variante: 'totale', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 120, p_secondi_countdown: 60,
})
await rpc(capo, 'apri_asta', { p_lega: lega, p_sorteggia: false })
await rpc(capo, 'chiama_calciatore', { p_lega: lega, p_player_id: 904804, p_importo: 9 })

// ─── 1. Chi genera il codice ────────────────────────────────────────────────

const daPartecipante = await rpc(amico, 'crea_codice_tv', { p_lega: lega, p_ore: 12 })
esito(
  'Il codice per la TV lo genera solo l amministratore',
  daPartecipante.riga?.esito === 'non_autorizzato',
  `${daPartecipante.riga?.messaggio}`,
)

const generato = await rpc(capo, 'crea_codice_tv', { p_lega: lega, p_ore: 12 })
const codice = generato.riga?.codice
esito(
  'Il codice e di sei caratteri, senza O 0 I 1',
  generato.riga?.esito === 'ok' && /^[A-HJ-NP-Z2-9]{6}$/.test(codice ?? ''),
  `codice: ${codice}`,
)

const secondo = await rpc(capo, 'crea_codice_tv', { p_lega: lega, p_ore: 12 })
const quanti = (await sql(`select count(*)::int n from public.tv_codes
  where league_id = '${lega}';`))[0].n
esito(
  'Rigenerarlo spegne il precedente: ne vive uno solo',
  quanti === 1 && secondo.riga?.codice !== codice,
  `codici vivi per questa lega: ${quanti}`,
)

const buono = secondo.riga.codice

// ─── 2. Il televisore vede quello che deve ──────────────────────────────────

const tv = await accessoAnonimo()
const schermo = await rpc(tv, 'schermo_tv', { p_codice: buono })
const d = schermo.riga

esito(
  'Con il codice, chi non e nella lega vede lo schermo',
  d?.valido === true && d?.lega?.nome === 'Lega TV',
  `lega: ${d?.lega?.nome}, squadre: ${d?.squadre?.length}`,
)

esito(
  'Vede il calciatore in asta con l offerta e le statistiche',
  d?.lotto?.players?.name === 'Tivu Attaccante' && d?.lotto?.current_bid === 9,
  `${d?.lotto?.players?.name} a ${d?.lotto?.current_bid}`,
)

esito(
  'Vede i crediti e gli slot di ogni squadra',
  (d?.squadre ?? []).length === 2 &&
    d.squadre.every((s) => typeof s.credits_remaining === 'number' && typeof s.slot_rimanenti === 'number'),
  d?.squadre?.map((s) => `${s.name}: ${s.credits_remaining}`).join(' · '),
)

esito(
  'Riceve l ora del server, per calcolare il countdown senza sbagliare',
  Boolean(d?.adesso) && Math.abs(Date.now() - new Date(d.adesso).getTime()) < 60_000,
  `ora del server: ${d?.adesso}`,
)

// ─── 3. Quello che NON deve vedere ──────────────────────────────────────────
//
// La meta' che conta. Si guarda la risposta intera come testo: se una parola
// che non deve esserci ci finisse per qualsiasi strada, qui si vede.

const tutto = JSON.stringify(d)

esito(
  'Nella risposta non c e nessuna nota privata',
  !tutto.includes('SEGRETO'),
  `la nota «SEGRETO: lo voglio a tutti i costi» non compare: ${!tutto.includes('SEGRETO')}`,
)

esito(
  'Nella risposta non c e nessun tetto di spesa',
  !/"max_price"|"tetto"/.test(tutto) && !tutto.includes('77'),
  `nessun campo di tetto, e il valore 77 non compare`,
)

esito(
  'Nella risposta non c e nessun indirizzo email',
  !/@/.test(tutto),
  `nessuna chiocciola in tutta la risposta`,
)

esito(
  'Nella risposta non ci sono identificativi di persone',
  !tutto.includes(amico.id) && !tutto.includes(capo.id),
  `né chi conduce né i partecipanti sono identificabili`,
)

// E dalle tabelle, direttamente, non deve poter leggere niente della lega.
const roseDaTv = await leggi(tv, `roster_players?select=player_id&league_id=eq.${lega}`)
const squadreDaTv = await leggi(tv, `teams?select=name&league_id=eq.${lega}`)
const obiettiviDaTv = await leggi(tv, 'targets?select=note')
esito(
  'Fuori da quella funzione, il televisore non legge niente della lega',
  (roseDaTv.corpo?.length ?? 0) === 0 &&
    (squadreDaTv.corpo?.length ?? 0) === 0 &&
    (obiettiviDaTv.corpo?.length ?? 0) === 0,
  `rose ${roseDaTv.corpo?.length ?? 0}, squadre ${squadreDaTv.corpo?.length ?? 0}, obiettivi ${obiettiviDaTv.corpo?.length ?? 0}`,
)

const codiciDaTv = await leggi(tv, 'tv_codes?select=code')
esito(
  'Il televisore non puo leggere l elenco dei codici',
  (codiciDaTv.corpo?.length ?? 0) === 0,
  `codici visti: ${codiciDaTv.corpo?.length ?? 0}`,
)

// ─── 4. Codici sbagliati, scaduti, revocati ─────────────────────────────────

const inventato = await rpc(tv, 'schermo_tv', { p_codice: 'ZZZZZZ' })
esito(
  'Un codice inventato non apre niente',
  inventato.riga?.valido === false,
  `risposta: ${JSON.stringify(inventato.riga)}`,
)

const vuoto = await rpc(tv, 'schermo_tv', { p_codice: '' })
esito(
  'Un codice vuoto non apre niente, e non da errore',
  vuoto.riga?.valido === false,
  `risposta: ${JSON.stringify(vuoto.riga)}`,
)

const minuscolo = await rpc(tv, 'schermo_tv', { p_codice: buono.toLowerCase() })
esito(
  'Il codice funziona anche scritto in minuscolo: al telecomando capita',
  minuscolo.riga?.valido === true,
  `«${buono.toLowerCase()}» apre lo schermo`,
)

await sql(`update public.tv_codes set expires_at = now() - interval '1 minute'
  where league_id = '${lega}';`)
const scaduto = await rpc(tv, 'schermo_tv', { p_codice: buono })
esito(
  'Un codice scaduto smette di aprire',
  scaduto.riga?.valido === false,
  `risposta: ${JSON.stringify(scaduto.riga)}`,
)

await rpc(capo, 'crea_codice_tv', { p_lega: lega, p_ore: 12 })
const revocaDaAltri = await rpc(amico, 'revoca_codice_tv', { p_lega: lega })
await rpc(capo, 'revoca_codice_tv', { p_lega: lega })
const dopoRevoca = await rpc(tv, 'schermo_tv', { p_codice: buono })
esito(
  'Revoca solo l amministratore, e dopo il link non apre piu',
  revocaDaAltri.riga?.esito === 'non_autorizzato' && dopoRevoca.riga?.valido === false,
  `revoca da un partecipante: ${revocaDaAltri.riga?.esito}; dopo la revoca il codice è ${dopoRevoca.riga?.valido ? 'ancora buono' : 'spento'}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-codice-tv.mjs --pulisci')
