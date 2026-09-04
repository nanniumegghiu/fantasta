// ═══════════════════════════════════════════════════════════════════════════
// Verifica di `bot-asta.mjs`.
//
// PERCHE' UNA PROVA PER UN ATTREZZO DI PROVA
//
// I bot servono a scoprire i difetti dell'asta. Se sono loro a essere rotti,
// il difetto si vede lo stesso — ma sembra dell'app, e si passa la serata a
// cercarlo nel posto sbagliato. Un attrezzo di misura che nessuno ha tarato
// non misura: consola.
//
// Qui l'asta si fa **davvero**: si costruisce una lega di prova con il suo
// listone, si mettono dentro tre compagni finti, si apre l'asta e si lancia
// `bot-asta.mjs` come lo si lancia a mano. Poi si guarda cosa e' successo.
//
// LE PROVE CHE CONTANO DI PIU'
//
// Non sono quelle che verificano che i bot rilancino: quello si vede a occhio.
// Sono quelle che verificano che **non possano fare piu' di una persona**. Un
// bot che scavalcasse i crediti, o riempisse un reparto oltre il regolamento,
// non sarebbe un avversario: sarebbe una scorciatoia, e l'asta che avresti
// provato non sarebbe l'asta che giocherai.
//
// Uso:  node scripts/verifica-bot-asta.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync, spawn } from 'node:child_process'
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

// Dominio e stagione tutti suoi. `--elimina` degli amici porta via ogni
// account del dominio: non deve nemmeno sfiorare @amici.fantasta, dove stanno
// i compagni con cui l'utente sta provando l'asta vera.
const DOMINIO_PROVA = 'prova.bot.fantasta'
// `importa_listone` ritira i calciatori della stagione che carica: due suite
// che condividono la stagione si spengono il listone a vicenda, e le prove
// passano o falliscono a seconda dell'ordine in cui le lanci.
const STAGIONE_DI_PROVA = 'PROVA-BOT'

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
  // Prima le leghe, poi le persone: un amministratore e' referenziato dalla
  // sua lega, e cancellarlo per primo fallisce.
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@fantasta.test');`)
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@${DOMINIO_PROVA}');`)
  await sql(`delete from public.teams where user_id in
    (select id from auth.users where email like '%@${DOMINIO_PROVA}');`)
  await sql("delete from auth.users where email like '%@fantasta.test';")
  await sql(`delete from auth.users where email like '%@${DOMINIO_PROVA}';`)
  await sql('delete from public.player_stats where player_id >= 900000;')
  await sql('delete from public.players where id >= 900000;')
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

async function rpc(u, funzione, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo ?? {}),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

const ambiente = { ...process.env, FANTASTA_DOMINIO_AMICI: DOMINIO_PROVA }

function amici(...argomenti) {
  try {
    return {
      codice: 0,
      testo: execFileSync(process.execPath, [join(radice, 'scripts', 'amici-di-prova.mjs'), ...argomenti], {
        encoding: 'utf8',
        env: ambiente,
      }),
    }
  } catch (e) {
    return { codice: e.status ?? 1, testo: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** Lancia i bot come li lancia l'utente, e li lascia giocare. */
function accendiBot(...argomenti) {
  const p = spawn(process.execPath, [join(radice, 'scripts', 'bot-asta.mjs'), ...argomenti], {
    env: ambiente,
  })
  const righe = []
  p.stdout.on('data', (d) => righe.push(String(d)))
  p.stderr.on('data', (d) => righe.push(String(d)))
  return { processo: p, testo: () => righe.join(''), finito: new Promise((r) => p.on('close', r)) }
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

// ═══════════════════════════════════════════════════════════════════════════
// Preparazione
// ═══════════════════════════════════════════════════════════════════════════

console.log('Preparo una lega di prova, con il suo listone e i suoi compagni finti.\n')
await pulisci()

const capo = await registra('capo')
await sql(`insert into public.app_admins (user_id) values ('${capo.id}') on conflict do nothing;`)

// Ventiquattro calciatori: quattro squadre da quattro posti ne consumano
// sedici, e ne restano abbastanza perche' l'asta non finisca il listone.
const CALCIATORI = []
let n = 909200
for (const ruolo of ['P', 'D', 'C', 'A']) {
  for (let i = 1; i <= 6; i++) {
    CALCIATORI.push({
      id: n++,
      nome: `Bot ${ruolo}${i}`,
      ruolo,
      squadra: 'Prova FC',
      quotazione: [30, 22, 15, 9, 4, 1][i - 1],
    })
  }
}
await rpc(capo, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (
  await rpc(capo, 'crea_lega', {
    p_nome: 'Lega dei Bot',
    p_stagione: STAGIONE_DI_PROVA,
    p_nome_squadra: 'La Capolista',
    p_crediti: 100,
    p_slot_p: 1,
    p_slot_d: 1,
    p_slot_c: 1,
    p_slot_a: 1,
    p_max_partecipanti: 6,
  })
).corpo
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0]
  .invite_code

amici('--lega', codice, '--quanti', '3')
const squadre = await sql(`select t.id, t.name, u.email from public.teams t
  join auth.users u on u.id = t.user_id where t.league_id = '${lega}' order by t.created_at;`)

// Countdown corti: la prova non deve durare un quarto d'ora.
//
// L'esito si controlla. La prima versione lo buttava via, la configurazione
// falliva in silenzio e l'asta restava con il metodo predefinito: le prove
// misuravano un'asta diversa da quella che credevano di aver preparato, e
// dicevano «i bot non rilanciano» quando il difetto era due schermate prima.
const configurata = await rpc(capo, 'configura_asta', {
  p_lega: lega,
  p_metodo: 'random',
  p_variante: 'totale',
  p_conduzione: 'app',
  p_tipo_chiamata: 'libera',
  // Tre e tre sono i minimi che il regolamento del database consente, e sono
  // gli stessi minimi che l'interfaccia offre. La prima versione chiedeva due
  // secondi di countdown: il database rifiutava con un errore di vincolo, la
  // configurazione non veniva scritta e l'asta restava con le impostazioni
  // predefinite. Nessun difetto del prodotto — l'interfaccia quel valore non
  // lo lascia nemmeno scrivere — ma la prova stava misurando un'altra asta.
  p_secondi_inattivita: 3,
  p_secondi_countdown: 3,
})
const impostazioni = (
  await sql(`select method::text m, variant::text v, bid_type::text b, inactivity_seconds i
    from public.auctions where league_id = '${lega}';`)
)[0] ?? {}
esito(
  'L asta di prova e configurata come dice la prova, non come capita',
  configurata.corpo?.[0]?.esito === 'ok' && impostazioni.m === 'random',
  `il server ha risposto «${configurata.corpo?.[0]?.esito ?? configurata.stato}: ` +
    `${configurata.corpo?.[0]?.messaggio ?? ''}» · asta ${impostazioni.m}/${impostazioni.v}, ` +
    `inattivita ${impostazioni.i}s`,
)

// ═══════════════════════════════════════════════════════════════════════════
// 1. Con l'asta chiusa i bot non combinano niente
// ═══════════════════════════════════════════════════════════════════════════

const aFreddo = accendiBot('--lega', codice)
await attendi(6000)
aFreddo.processo.kill('SIGINT')
await aFreddo.finito
const offerteAFreddo = (
  await sql(`select count(*)::int n from public.bids b
    join public.auction_lots l on l.id = b.lot_id
    join public.auctions a on a.id = l.auction_id where a.league_id = '${lega}';`)
)[0].n
esito(
  'Con l asta non ancora aperta i bot lo dicono e non fanno niente',
  offerteAFreddo === 0 && /non ancora aperta|aprila dall/i.test(aFreddo.testo()),
  `${offerteAFreddo} offerte, e hanno detto: «${(aFreddo.testo().match(/asta [^\n]*/) ?? ['—'])[0].trim()}»`,
)

esito(
  'Ogni bot ha un carattere suo, scritto in chiaro prima di cominciare',
  /paga \d+% del valore · risponde in \d/.test(aFreddo.testo()),
  (aFreddo.testo().match(/paga \d+% del valore[^\n]*/) ?? ['—'])[0].trim(),
)

// Il carattere non deve cambiare a ogni riavvio, o due partite non sarebbero
// confrontabili e un difetto visto una volta non si riprodurrebbe piu'.
const aFreddo2 = accendiBot('--lega', codice)
await attendi(5000)
aFreddo2.processo.kill('SIGINT')
await aFreddo2.finito
const caratteri = (t) => (t.match(/paga \d+% del valore · risponde in [\d.]+s/g) ?? []).join('|')
esito(
  'Il carattere e stabile: due partite sono confrontabili',
  caratteri(aFreddo.testo()) === caratteri(aFreddo2.testo()) && caratteri(aFreddo.testo()) !== '',
  caratteri(aFreddo.testo()).split('|').join('  ·  ') || 'nessun carattere stampato',
)

const senzaUno = accendiBot('--lega', codice, '--senza', squadre[1].email.split('@')[0])
await attendi(5000)
senzaUno.processo.kill('SIGINT')
await senzaUno.finito
esito(
  '--senza toglie dal campo il compagno che vuoi comandare tu',
  /2 avversari in campo/.test(senzaUno.testo()) &&
    !senzaUno.testo().includes(squadre[1].email.split('@')[0]),
  (senzaUno.testo().match(/\d+ avversari in campo[^\n]*/) ?? ['—'])[0],
)

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'asta vera
// ═══════════════════════════════════════════════════════════════════════════

await rpc(capo, 'apri_asta', { p_lega: lega, p_sorteggia: true })
console.log('\nAsta aperta. I bot giocano per due minuti e mezzo.\n')

const partita = accendiBot('--lega', codice)

// Nel mezzo, una persona vera entra e si prende un calciatore pagandolo
// troppo: serve a provare che i bot **si fermano**, e che si puo' vincere
// contro di loro.
let vintoDaUmano = false
const scadenza = Date.now() + 150000
while (Date.now() < scadenza) {
  await attendi(1200)
  const [lotto] = await sql(`select l.id, l.current_bid from public.auction_lots l
    join public.auctions a on a.id = l.auction_id
    where a.league_id = '${lega}' and l.status = 'open' limit 1;`)

  // Chi amministra estrae il primo calciatore, e ne estrae un altro se la
  // catena si ferma. E' quello che fa una persona davanti alla plancia: i bot
  // non hanno — e non devono avere — nessun potere di conduzione.
  if (!lotto) {
    await rpc(capo, 'apri_prossimo_lotto', { p_lega: lega })
    continue
  }
  // L'app di chi amministra chiede al server di chiudere il lotto appena il
  // countdown e' finito: senza, ci pensa la rete di sicurezza, che passa ogni
  // dieci secondi. La prova fa quello che fa l'app, altrimenti misurerebbe la
  // lentezza del compito pianificato invece della velocita' dell'asta.
  await rpc(capo, 'chiudi_lotto_se_scaduto', { p_lotto: lotto.id })

  if (vintoDaUmano) continue
  const r = await rpc(capo, 'rilancia', { p_lotto: lotto.id, p_importo: lotto.current_bid + 12 })
  if (r.corpo?.esito === 'ok') vintoDaUmano = true
}

partita.processo.kill('SIGINT')
await partita.finito

// ═══════════════════════════════════════════════════════════════════════════
// 3. Cosa e' successo
// ═══════════════════════════════════════════════════════════════════════════

const idBot = squadre.filter((s) => s.email.endsWith(DOMINIO_PROVA)).map((s) => s.id)

const offerte = await sql(`select count(*)::int n, count(distinct b.team_id)::int quanti
  from public.bids b join public.auction_lots l on l.id = b.lot_id
  join public.auctions a on a.id = l.auction_id where a.league_id = '${lega}'
  and b.team_id in (${idBot.map((i) => `'${i}'`).join(',')});`)
esito(
  'I bot rilanciano davvero, e non uno solo',
  offerte[0].n > 0 && offerte[0].quanti >= 2,
  `${offerte[0].n} offerte da ${offerte[0].quanti} squadre diverse`,
)

const rose = await sql(`select t.name, count(r.id)::int presi, sum(r.price)::int spesi,
    t.credits_remaining crediti
  from public.teams t left join public.roster_players r on r.team_id = t.id
  where t.league_id = '${lega}' group by 1, 4 order by 1;`)
const comprati = rose.reduce((s, r) => s + r.presi, 0)
esito(
  'Le rose si riempiono da sole: e la ragione per cui esistono',
  // Tre e non «tutti»: quanti se ne comprano in due minuti e mezzo dipende
  // dai tempi di reazione e dalla rete, non dalla correttezza. Sotto tre pero'
  // vuol dire che la catena si e' fermata, ed e' quello che questa prova deve
  // accorgersi di vedere.
  comprati >= 3,
  `${comprati} calciatori assegnati in due minuti · ` +
    rose.map((r) => `${r.name}: ${r.presi}`).join(' · '),
)

esito(
  'Contro i bot si vince: chi paga di piu si prende il calciatore',
  rose.find((r) => r.name === 'La Capolista')?.presi > 0,
  vintoDaUmano
    ? `La Capolista ha ${rose.find((r) => r.name === 'La Capolista')?.presi ?? 0} calciatori`
    : 'la persona non e mai riuscita a rilanciare',
)

// ─── Le prove che contano: i bot non possono fare piu' di una persona ───────

const CREDITI = (await sql(`select credits_initial c from public.leagues where id = '${lega}';`))[0].c
const conti = rose.every((r) => (r.spesi ?? 0) + r.crediti === CREDITI)
esito(
  'Nessun bot spende crediti che non ha: i conti tornano a uno a uno',
  conti,
  `ognuna doveva tornare a ${CREDITI} · ` +
    rose.map((r) => `${r.name}: ${r.spesi ?? 0}+${r.crediti}=${(r.spesi ?? 0) + r.crediti}`).join(' · '),
)

const sforati = await sql(`select t.name, p.role::text ruolo, count(*)::int quanti
  from public.roster_players r
  join public.teams t on t.id = r.team_id
  join public.players p on p.id = r.player_id
  where t.league_id = '${lega}' group by 1, 2 having count(*) > 1;`)
esito(
  'Nessun bot sfora il regolamento: un posto per reparto, e non uno di piu',
  sforati.length === 0,
  sforati.length ? sforati.map((s) => `${s.name} ha ${s.quanti} ${s.ruolo}`).join(' · ') : 'nessun reparto sforato',
)

const doppioni = await sql(`select p.name, count(*)::int quanti from public.roster_players r
  join public.players p on p.id = r.player_id
  join public.teams t on t.id = r.team_id and t.league_id = '${lega}'
  group by 1 having count(*) > 1;`)
esito(
  'Lo stesso calciatore non finisce in due rose',
  doppioni.length === 0,
  doppioni.length ? doppioni.map((d) => d.name).join(' · ') : 'nessun calciatore in due squadre',
)

const fuoriAsta = await sql(`select count(*)::int n from public.roster_players r
  join public.teams t on t.id = r.team_id and t.league_id = '${lega}'
  where r.source <> 'auction';`)
esito(
  'Tutto quello che i bot hanno preso e passato dall asta, non dal database',
  fuoriAsta[0].n === 0,
  `${fuoriAsta[0].n} righe entrate per altre strade`,
)

const prezziAssurdi = await sql(`select count(*)::int n from public.roster_players r
  join public.teams t on t.id = r.team_id and t.league_id = '${lega}'
  where r.price < 1 or r.price > ${CREDITI};`)
esito(
  'Nessun prezzo fuori dal mondo: ne sotto il minimo, ne sopra i crediti iniziali',
  prezziAssurdi[0].n === 0,
  `${prezziAssurdi[0].n} prezzi impossibili su ${comprati} acquisti, con ${CREDITI} crediti a testa`,
)

// ─── In pausa non si gioca ──────────────────────────────────────────────────

await rpc(capo, 'pausa_asta', { p_lega: lega, p_in_pausa: true })
const primaDellaPausa = (
  await sql(`select count(*)::int n from public.bids b
    join public.auction_lots l on l.id = b.lot_id
    join public.auctions a on a.id = l.auction_id where a.league_id = '${lega}';`)
)[0].n
const inPausa = accendiBot('--lega', codice)
await attendi(12000)
inPausa.processo.kill('SIGINT')
await inPausa.finito
const dopoLaPausa = (
  await sql(`select count(*)::int n from public.bids b
    join public.auction_lots l on l.id = b.lot_id
    join public.auctions a on a.id = l.auction_id where a.league_id = '${lega}';`)
)[0].n
esito(
  'Con l asta in pausa i bot stanno fermi',
  dopoLaPausa === primaDellaPausa,
  `offerte prima ${primaDellaPausa}, dopo ${dopoLaPausa}; hanno detto: «${
    (inPausa.testo().match(/asta in pausa/) ?? ['niente'])[0]
  }»`,
)

// ─── A asta chiusa si spengono da soli ──────────────────────────────────────

await rpc(capo, 'pausa_asta', { p_lega: lega, p_in_pausa: false })
const allaChiusura = accendiBot('--lega', codice)
await attendi(4000)

// CHIUDERE UN'ASTA A ESTRAZIONE RICHIEDE TRE MOSSE, NON UNA
//
// Ed e' un rilievo, non un difetto: ogni singolo rifiuto e' giusto. Ma messi
// in fila costringono a un ragionamento che, la sera dell'asta, nessuno fara'.
//
//   `chiudi_asta` → «c'e' un calciatore all'asta: chiudi prima quello».
//   `passa_lotto` → «c'e' gia' un'offerta: non si puo' passare, semmai
//                    aggiudicare».
//   e se intanto l'asta e' aperta, chiudere quel lotto **ne apre subito un
//   altro**, perche' nei metodi a estrazione la catena e' automatica.
//
// La via che funziona e' una sola: **pausa, poi aggiudica il calciatore in
// asta, poi chiudi**. La pausa e' il pezzo che non e' scritto da nessuna
// parte, ed e' quello che spezza la catena. Annotato fra i rilievi della
// Fetta 8.
await rpc(capo, 'pausa_asta', { p_lega: lega, p_in_pausa: true })
const [ancoraAperto] = await sql(`select l.id, l.current_bidder_team_id chi
  from public.auction_lots l join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}' and l.status = 'open' limit 1;`)
if (ancoraAperto) {
  await rpc(capo, ancoraAperto.chi ? 'aggiudica_ora' : 'passa_lotto', { p_lotto: ancoraAperto.id })
}
const chiusura = await rpc(capo, 'chiudi_asta', { p_lega: lega })

const spenti = await Promise.race([
  allaChiusura.finito.then(() => true),
  attendi(20000).then(() => false),
])
if (!spenti) allaChiusura.processo.kill('SIGINT')
esito(
  'Quando l asta si chiude i bot si spengono da soli, senza che nessuno li fermi',
  spenti,
  `chiusura: «${chiusura.corpo?.[0]?.esito}» · ` +
    (spenti ? 'processo terminato da solo' : 'sono rimasti accesi: li ho dovuti fermare io'),
)

esito(
  'Alla fine dicono com e andata, squadra per squadra',
  /crediti\s+P\s+D\s+C\s+A/.test(allaChiusura.testo()),
  (allaChiusura.testo().match(/squadra\s+crediti[^\n]*/) ?? ['—'])[0].trim(),
)

// ─── Il riepilogo funziona anche da solo ────────────────────────────────────

const soloRiepilogo = accendiBot('--lega', codice, '--riepilogo')
await soloRiepilogo.finito
esito(
  '--riepilogo racconta l asta senza far giocare nessuno',
  /I dieci pagati di piu|crediti\s+P\s+D\s+C\s+A/.test(soloRiepilogo.testo()) &&
    !/avversari in campo/.test(soloRiepilogo.testo()),
  soloRiepilogo.testo().trim().split('\n').slice(0, 2).join(' / '),
)

// ═══════════════════════════════════════════════════════════════════════════

const passate = esiti.filter((e) => e.ok).length
console.log(`\n${passate} superate su ${esiti.length}.`)
if (passate < esiti.length) {
  console.log('\nFallite:')
  for (const e of esiti.filter((x) => !x.ok)) console.log(`  · ${e.nome}`)
}
console.log('Pulisci con: node scripts/verifica-bot-asta.mjs --pulisci')
process.exit(passate === esiti.length ? 0 : 1)
