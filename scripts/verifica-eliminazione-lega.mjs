// ═══════════════════════════════════════════════════════════════════════════
// Verifica dell'eliminazione di una lega.
//
// È l'operazione più distruttiva dell'applicazione: si controlla che la faccia
// solo l'amministratore, solo riscrivendo il nome, e che porti via davvero
// tutto senza lasciare righe orfane in giro.
//
// Uso:  node scripts/verifica-eliminazione-lega.mjs [--pulisci]
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
  // ─── Attenzione ───────────────────────────────────────────────────────────
  // Il listone è UNICO e vale per tutti: cancellarlo per intero qui
  // butterebbe via il lavoro vero del proprietario del progetto. È già
  // successo una volta. Si cancellano soltanto i calciatori di prova, che per
  // questo hanno identificativi da 900000 in su: quelli del listone ufficiale
  // sono di quattro o cinque cifre e non arrivano mai lì.
  await sql('delete from public.player_stats where player_id >= 900000;')
  await sql('delete from public.players where id >= 900000;')
  await sql("delete from auth.users where email like '%@fantasta.test';")
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
  const email = `prova.${nome}.${Date.now()}${Math.floor(Math.random() * 10000)}@fantasta.test`
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
  return { stato: r.status, riga: Array.isArray(c) ? c[0] : c }
}

// ─── Una lega piena di roba, per vedere se sparisce davvero tutta ───────────

console.log('Costruisco una lega completa: asta fatta, rose, obiettivi, regolamento.\n')

const admin = await registra('admin')
const amico = await registra('amico')
await sql(`insert into public.app_admins (user_id) values ('${admin.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 908400, nome: 'Portiere Uno', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 908401, nome: 'Difensore Uno', ruolo: 'D', squadra: 'Prova FC', quotazione: 10 },
  { id: 908402, nome: 'Centrocampo Uno', ruolo: 'C', squadra: 'Prova FC', quotazione: 10 },
  { id: 908403, nome: 'Attacco Uno', ruolo: 'A', squadra: 'Prova FC', quotazione: 10 },
]
await rpc(admin, 'importa_listone', { p_stagione: '2026/27', p_righe: CALCIATORI })

const NOME_LEGA = 'Lega da Eliminare'
const lega = (await rpc(admin, 'crea_lega', {
  p_nome: NOME_LEGA,
  p_stagione: '2026/27',
  p_nome_squadra: 'Squadra Admin',
  p_crediti: 50,
  p_slot_p: 1, p_slot_d: 1, p_slot_c: 1, p_slot_a: 1,
  p_offerta_minima: 1,
  p_max_partecipanti: 2,
})).riga
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
await rpc(amico, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'Squadra Amico' })

// Liste obiettivi per entrambi, con dentro qualcosa.
for (const u of [admin, amico]) {
  const lista = (await rpc(u, 'assicura_lista_obiettivi', { p_lega: lega })).riga
  await fetch(`${URL_BASE}/rest/v1/targets`, {
    method: 'POST',
    headers: testa(u),
    body: JSON.stringify({ list_id: lista, player_id: 908400, max_price: 12, note: 'da prendere' }),
  })
}

// Un'asta vera, con un'aggiudicazione.
await rpc(admin, 'configura_asta', {
  p_lega: lega, p_metodo: 'chiamata', p_variante: 'totale', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 3, p_secondi_countdown: 3, p_filtro_random: {},
})
await rpc(admin, 'apri_asta', { p_lega: lega, p_sorteggia: false })
const a = (await sql(`select id, nomination_order, current_turn_index from public.auctions where league_id = '${lega}';`))[0]
const squadre = await sql(`select id, user_id from public.teams where league_id = '${lega}';`)
const chiamante = squadre.find((s) => s.id === a.nomination_order[a.current_turn_index]).user_id === admin.id ? admin : amico
const lotto = (await rpc(chiamante, 'chiama_calciatore', { p_lega: lega, p_player_id: 908400, p_importo: 5 })).riga.lotto
await sql(`update public.auction_lots set last_bid_at = now() - interval '30 seconds' where id = '${lotto}';`)
await rpc(chiamante, 'chiudi_lotto_se_scaduto', { p_lotto: lotto })

const prima = (await sql(`select
  (select count(*)::int from public.leagues where id = '${lega}') leghe,
  (select count(*)::int from public.league_members where league_id = '${lega}') partecipanti,
  (select count(*)::int from public.teams where league_id = '${lega}') squadre,
  (select count(*)::int from public.roster_players where league_id = '${lega}') rose,
  (select count(*)::int from public.auctions where league_id = '${lega}') aste,
  (select count(*)::int from public.auction_lots where auction_id = '${a.id}') lotti,
  (select count(*)::int from public.bids b join public.auction_lots l on l.id = b.lot_id where l.auction_id = '${a.id}') offerte,
  (select count(*)::int from public.auction_events where auction_id = '${a.id}') eventi,
  (select count(*)::int from public.target_lists where league_id = '${lega}') liste,
  (select count(*)::int from public.targets t join public.target_lists tl on tl.id = t.list_id where tl.league_id = '${lega}') obiettivi;`))[0]

esito(
  'La lega di prova è piena di dati collegati',
  prima.partecipanti === 2 && prima.rose === 1 && prima.eventi > 0 && prima.obiettivi === 2,
  JSON.stringify(prima),
)

// ─── Le difese ──────────────────────────────────────────────────────────────

const daPartecipante = await rpc(amico, 'elimina_lega', { p_lega: lega, p_conferma: NOME_LEGA })
esito(
  'Un partecipante non può eliminare la lega',
  daPartecipante.riga?.esito === 'non_autorizzato',
  `${daPartecipante.riga?.messaggio}`,
)

const senzaAccesso = await rpc(null, 'elimina_lega', { p_lega: lega, p_conferma: NOME_LEGA })
esito(
  'Senza accesso non si elimina niente',
  senzaAccesso.riga?.esito !== 'ok',
  `esito: ${senzaAccesso.riga?.esito ?? 'HTTP ' + senzaAccesso.stato}`,
)

const nomeSbagliato = await rpc(admin, 'elimina_lega', { p_lega: lega, p_conferma: 'lega sbagliata' })
esito(
  'Senza riscrivere il nome esatto non si elimina',
  nomeSbagliato.riga?.esito === 'conferma_sbagliata',
  `${nomeSbagliato.riga?.messaggio}`,
)

const vuoto = await rpc(admin, 'elimina_lega', { p_lega: lega, p_conferma: '' })
esito(
  'Una conferma vuota non basta',
  vuoto.riga?.esito === 'conferma_sbagliata',
  `esito: ${vuoto.riga?.esito}`,
)

const ancoraLi = (await sql(`select count(*)::int n from public.leagues where id = '${lega}';`))[0].n
esito(
  'Dopo i tentativi respinti la lega è ancora al suo posto',
  ancoraLi === 1,
  `leghe con quell'identificativo: ${ancoraLi}`,
)

const cancellaDiretto = await fetch(`${URL_BASE}/rest/v1/leagues?id=eq.${lega}`, {
  method: 'DELETE',
  headers: testa(admin),
})
const dopoDiretto = (await sql(`select count(*)::int n from public.leagues where id = '${lega}';`))[0].n
esito(
  'Nemmeno l amministratore cancella passando dalla tabella',
  dopoDiretto === 1,
  `HTTP ${cancellaDiretto.status}, la lega esiste ancora: ${dopoDiretto === 1}`,
)

// ─── L'eliminazione vera ────────────────────────────────────────────────────

const fatta = await rpc(admin, 'elimina_lega', {
  p_lega: lega,
  // Con spazi e maiuscole diverse: la difesa è contro il gesto distratto,
  // non contro chi scrive con lo shift premuto.
  p_conferma: `  ${NOME_LEGA.toUpperCase()}  `,
})
esito(
  'L amministratore elimina la lega riscrivendone il nome',
  fatta.riga?.esito === 'ok' && fatta.riga?.partecipanti === 2,
  `${fatta.riga?.messaggio} · partecipanti ${fatta.riga?.partecipanti}, calciatori assegnati ${fatta.riga?.calciatori}`,
)

const dopo = (await sql(`select
  (select count(*)::int from public.leagues where id = '${lega}') leghe,
  (select count(*)::int from public.league_members where league_id = '${lega}') partecipanti,
  (select count(*)::int from public.teams where league_id = '${lega}') squadre,
  (select count(*)::int from public.roster_players where league_id = '${lega}') rose,
  (select count(*)::int from public.auctions where league_id = '${lega}') aste,
  (select count(*)::int from public.auction_lots where auction_id = '${a.id}') lotti,
  (select count(*)::int from public.bids b join public.auction_lots l on l.id = b.lot_id where l.auction_id = '${a.id}') offerte,
  (select count(*)::int from public.auction_events where auction_id = '${a.id}') eventi,
  (select count(*)::int from public.target_lists where league_id = '${lega}') liste,
  (select count(*)::int from public.targets t join public.target_lists tl on tl.id = t.list_id where tl.league_id = '${lega}') obiettivi;`))[0]

esito(
  'Non resta niente: partecipanti, squadre, rose, asta, lotti, offerte, registro, liste',
  Object.values(dopo).every((n) => n === 0),
  JSON.stringify(dopo),
)

const utentiVivi = (await sql(`select count(*)::int n from auth.users where id in ('${admin.id}','${amico.id}');`))[0].n
const listoneVivo = (await sql('select count(*)::int n from public.players where id = 908400;'))[0].n
esito(
  'Le persone e il listone restano: si elimina la lega, non il mondo',
  utentiVivi === 2 && listoneVivo === 1,
  `utenti ancora registrati: ${utentiVivi}, calciatore ancora nel listone: ${listoneVivo === 1}`,
)

const giaSparita = await rpc(admin, 'elimina_lega', { p_lega: lega, p_conferma: NOME_LEGA })
esito(
  'Eliminare due volte non è un errore incomprensibile',
  giaSparita.riga?.esito === 'lega_inesistente',
  `${giaSparita.riga?.messaggio}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-eliminazione-lega.mjs --pulisci')
