// ═══════════════════════════════════════════════════════════════════════════
// Verifica degli scambi fra squadre.
//
// PERCHE' QUESTE PROVE CONTANO
//
// Uno scambio tocca la rosa di un altro e i crediti di tutti e due. E' l'unica
// funzione dell'app in cui il gesto di una persona cambia la squadra di
// un'altra: se sbaglia, non produce un errore, produce una lega in cui qualcuno
// si ritrova senza un difensore e nessuno sa spiegargli perche'.
//
// La prova che conta piu' di tutte e' quella sui reparti che non pareggiano:
// e' la regola che tiene in piedi le rose, ed e' l'unica che un'interfaccia
// distratta lascerebbe passare.
//
// Le rose si preparano scrivendo direttamente nel database: il motore d'asta
// e' gia' provato altrove, e farlo girare qui vorrebbe dire provare due volte
// la stessa cosa per arrivare al punto di partenza.
//
// Uso:  node scripts/verifica-scambi.mjs [--pulisci]
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
const STAGIONE_DI_PROVA = 'PROVA-SCAM'

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
  return { stato: r.status, riga: Array.isArray(c) ? c[0] : c }
}

async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, { headers: testa(u) })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

async function scrivi(u, percorso, metodo, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    method: metodo,
    headers: { ...testa(u), Prefer: 'return=representation' },
    body: JSON.stringify(corpo),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Preparo due squadre con le rose già fatte.\n')

const anna = await registra('anna')
const bruno = await registra('bruno')
const estraneo = await registra('estraneo')
await sql(`insert into public.app_admins (user_id) values ('${anna.id}') on conflict do nothing;`)

const CALCIATORI = []
let id = 907300
for (const [ruolo, base] of [['P', 'Por'], ['D', 'Dif'], ['C', 'Cen'], ['A', 'Att']]) {
  for (const n of [1, 2, 3, 4]) {
    CALCIATORI.push({
      id: id++, nome: `${base}${n}`, ruolo, squadra: 'Prova FC', quotazione: 10,
    })
  }
}
await rpc(anna, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })
const idDi = (n) => CALCIATORI.find((c) => c.nome === n).id

async function creaLega(nome, opzioni = {}) {
  const lega = (await rpc(anna, 'crea_lega', {
    p_nome: nome,
    p_stagione: STAGIONE_DI_PROVA,
    p_nome_squadra: `Anna ${nome}`,
    p_crediti: 100,
    p_slot_p: 1, p_slot_d: 1, p_slot_c: 1, p_slot_a: 1,
    p_scambi: opzioni.scambi ?? true,
    p_scambi_crediti: opzioni.scambiCrediti ?? true,
    p_max_partecipanti: 4,
  })).riga
  const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
  await rpc(bruno, 'entra_in_lega', { p_codice: codice, p_nome_squadra: `Bruno ${nome}` })

  const squadre = await sql(`select id, user_id, name from public.teams
    where league_id = '${lega}' order by created_at;`)
  return { lega, squadreAnna: squadre[0], squadreBruno: squadre[1] }
}

/** Mette un calciatore in rosa senza passare dall'asta: qui e' preparazione. */
async function metti(lega, squadra, nome, prezzo) {
  await sql(`insert into public.roster_players (league_id, team_id, player_id, price)
    values ('${lega}', '${squadra}', ${idDi(nome)}, ${prezzo});`)
  await sql(`update public.teams set credits_remaining = credits_remaining - ${prezzo}
    where id = '${squadra}';`)
}

// ─── 1. Lo scambio normale ──────────────────────────────────────────────────

{
  const s = await creaLega('Normale')
  await metti(s.lega, s.squadreAnna.id, 'Dif1', 20)
  await metti(s.lega, s.squadreBruno.id, 'Dif2', 15)

  const proposta = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Dif1')],
    p_suoi_calciatori: [idDi('Dif2')],
    p_crediti: 0,
    p_nota: 'Il tuo si abbina meglio alla mia difesa',
  })
  esito(
    'Un difensore per un difensore: la proposta parte',
    proposta.riga?.esito === 'ok' && Boolean(proposta.riga?.scambio),
    `${proposta.riga?.messaggio}`,
  )

  const daEstraneo = await rpc(estraneo, 'accetta_scambio', { p_scambio: proposta.riga.scambio })
  const daProponente = await rpc(anna, 'accetta_scambio', { p_scambio: proposta.riga.scambio })
  esito(
    'Accetta solo chi riceve: non un estraneo, e nemmeno chi ha proposto',
    daEstraneo.riga?.esito === 'non_autorizzato' && daProponente.riga?.esito === 'non_autorizzato',
    `estraneo: ${daEstraneo.riga?.esito} · proponente: ${daProponente.riga?.esito}`,
  )

  const accettazione = await rpc(bruno, 'accetta_scambio', { p_scambio: proposta.riga.scambio })
  const dopo = await sql(`select p.name, t.name as squadra from public.roster_players r
    join public.players p on p.id = r.player_id
    join public.teams t on t.id = r.team_id
    where r.league_id = '${s.lega}' order by p.name;`)
  const dif1 = dopo.find((x) => x.name === 'Dif1')
  const dif2 = dopo.find((x) => x.name === 'Dif2')
  esito(
    'Accettato, i calciatori cambiano davvero rosa',
    accettazione.riga?.esito === 'ok' &&
      dif1.squadra === s.squadreBruno.name &&
      dif2.squadra === s.squadreAnna.name,
    `Dif1 → ${dif1?.squadra}, Dif2 → ${dif2?.squadra}`,
  )

  const seconda = await rpc(bruno, 'accetta_scambio', { p_scambio: proposta.riga.scambio })
  esito(
    'Uno scambio già fatto non si rifà',
    seconda.riga?.esito === 'gia_chiuso',
    `${seconda.riga?.messaggio}`,
  )
}

// ─── 2. La regola che tiene in piedi le rose ────────────────────────────────

{
  const s = await creaLega('Reparti')
  await metti(s.lega, s.squadreAnna.id, 'Dif1', 20)
  await metti(s.lega, s.squadreBruno.id, 'Att1', 30)

  const sbilanciato = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Dif1')],
    p_suoi_calciatori: [idDi('Att1')],
  })
  esito(
    'Un difensore per un attaccante non si può fare: le rose non resterebbero valide',
    sbilanciato.riga?.esito === 'rifiutato' && /reparto/i.test(sbilanciato.riga?.messaggio ?? ''),
    `${sbilanciato.riga?.messaggio}`,
  )

  const aVuoto = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [],
    p_suoi_calciatori: [],
    p_crediti: 10,
  })
  esito(
    'Uno scambio di soli crediti non è uno scambio',
    aVuoto.riga?.esito === 'rifiutato',
    `${aVuoto.riga?.messaggio}`,
  )

  const nonSua = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Att1')],
    p_suoi_calciatori: [idDi('Dif1')],
  })
  esito(
    'Non si offre un calciatore che non è nella propria rosa',
    nonSua.riga?.esito === 'rifiutato' && /non è \(più\) nella rosa/.test(nonSua.riga?.messaggio ?? ''),
    `${nonSua.riga?.messaggio}`,
  )

  const conSeStesso = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreAnna.id,
    p_miei_calciatori: [idDi('Dif1')],
    p_suoi_calciatori: [idDi('Dif1')],
  })
  esito(
    'Non si scambia con se stessi',
    conSeStesso.riga?.esito === 'non_autorizzato',
    `${conSeStesso.riga?.messaggio}`,
  )
}

// ─── 3. Il conguaglio in crediti ────────────────────────────────────────────

{
  const s = await creaLega('Crediti')
  await metti(s.lega, s.squadreAnna.id, 'Cen1', 10)
  await metti(s.lega, s.squadreBruno.id, 'Cen2', 10)

  const primaA = (await sql(`select credits_remaining c from public.teams where id = '${s.squadreAnna.id}';`))[0].c
  const primaB = (await sql(`select credits_remaining c from public.teams where id = '${s.squadreBruno.id}';`))[0].c

  const p = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Cen1')],
    p_suoi_calciatori: [idDi('Cen2')],
    p_crediti: 12,
  })
  await rpc(bruno, 'accetta_scambio', { p_scambio: p.riga.scambio })

  const dopoA = (await sql(`select credits_remaining c from public.teams where id = '${s.squadreAnna.id}';`))[0].c
  const dopoB = (await sql(`select credits_remaining c from public.teams where id = '${s.squadreBruno.id}';`))[0].c
  esito(
    'Il conguaglio sposta i crediti nella direzione giusta',
    dopoA === primaA - 12 && dopoB === primaB + 12,
    `chi propone da ${primaA} a ${dopoA}, chi riceve da ${primaB} a ${dopoB}`,
  )

  const troppo = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Cen2')],
    p_suoi_calciatori: [idDi('Cen1')],
    p_crediti: 100000,
  })
  esito(
    'Un conguaglio che porterebbe sotto zero viene rifiutato',
    troppo.riga?.esito === 'rifiutato' && /crediti/i.test(troppo.riga?.messaggio ?? ''),
    `${troppo.riga?.messaggio}`,
  )
}

// ─── 4. Le impostazioni della lega ──────────────────────────────────────────

{
  const s = await creaLega('SenzaScambi', { scambi: false, scambiCrediti: false })
  await metti(s.lega, s.squadreAnna.id, 'Por1', 10)
  await metti(s.lega, s.squadreBruno.id, 'Por2', 10)

  const vietato = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Por1')],
    p_suoi_calciatori: [idDi('Por2')],
  })
  esito(
    'In una lega senza scambi non si scambia',
    vietato.riga?.esito === 'rifiutato' && /non sono permessi/.test(vietato.riga?.messaggio ?? ''),
    `${vietato.riga?.messaggio}`,
  )
}

{
  const s = await creaLega('SoloSecchi', { scambi: true, scambiCrediti: false })
  await metti(s.lega, s.squadreAnna.id, 'Por3', 10)
  await metti(s.lega, s.squadreBruno.id, 'Por4', 10)

  const conCrediti = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Por3')],
    p_suoi_calciatori: [idDi('Por4')],
    p_crediti: 5,
  })
  const secco = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Por3')],
    p_suoi_calciatori: [idDi('Por4')],
    p_crediti: 0,
  })
  esito(
    'Se la lega vieta il conguaglio, lo scambio secco passa e quello con crediti no',
    conCrediti.riga?.esito === 'rifiutato' && secco.riga?.esito === 'ok',
    `con conguaglio: ${conCrediti.riga?.messaggio} · secco: ${secco.riga?.esito}`,
  )
}

// ─── 5. Quello che succede nel frattempo ────────────────────────────────────

{
  // La rivalidazione al momento dell'accettazione, che e' la ragione per cui
  // esiste. Fra la proposta e la risposta possono passare giorni: qui i
  // crediti di chi propone spariscono nel frattempo, e lo scambio con
  // conguaglio non sta piu' in piedi.
  //
  // Si usa questo e non un calciatore spostato altrove perche' quel caso lo
  // copre gia' la decadenza a cascata, che scatta prima e per un'altra strada.
  const s = await creaLega('Decadenza')
  await metti(s.lega, s.squadreAnna.id, 'Att2', 10)
  await metti(s.lega, s.squadreBruno.id, 'Att3', 10)

  const p = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega,
    p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Att2')],
    p_suoi_calciatori: [idDi('Att3')],
    p_crediti: 40,
  })
  esito(
    'Preparazione: una proposta con conguaglio che al momento sta in piedi',
    p.riga?.esito === 'ok',
    `${p.riga?.messaggio}`,
  )

  // Nel frattempo chi propone resta senza crediti.
  await sql(`update public.teams set credits_remaining = 1 where id = '${s.squadreAnna.id}';`)

  const tardi = await rpc(bruno, 'accetta_scambio', { p_scambio: p.riga.scambio })
  const stato = (await sql(`select status from public.trades where id = '${p.riga.scambio}';`))[0].status
  const roseFerme = (await sql(`select count(*)::int n from public.roster_players
    where league_id = '${s.lega}' and team_id = '${s.squadreAnna.id}'
      and player_id = ${idDi('Att2')};`))[0].n
  esito(
    'Una proposta che nel frattempo non sta piu in piedi decade, e lo dice',
    tardi.riga?.esito === 'decaduto' && stato === 'decaduto' && roseFerme === 1,
    `${tardi.riga?.messaggio} · le rose non sono state toccate: ${roseFerme === 1}`,
  )
}

{
  const s = await creaLega('Concorrenti')
  const carla = await registra('carla')
  const codice = (await sql(`select invite_code from public.leagues where id = '${s.lega}';`))[0].invite_code
  await rpc(carla, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'Carla Concorrenti' })
  const squadraCarla = (await sql(`select id from public.teams
    where league_id = '${s.lega}' and user_id = '${carla.id}';`))[0].id

  await metti(s.lega, s.squadreAnna.id, 'Cen3', 10)
  await metti(s.lega, s.squadreBruno.id, 'Cen4', 10)
  await metti(s.lega, squadraCarla, 'Por1', 10)
  await sql(`insert into public.roster_players (league_id, team_id, player_id, price)
    values ('${s.lega}', '${squadraCarla}', ${idDi('Cen1')}, 5);`)

  // Anna propone lo stesso suo centrocampista a due squadre diverse.
  const aBruno = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega, p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Cen3')], p_suoi_calciatori: [idDi('Cen4')],
  })
  const aCarla = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega, p_a_squadra: squadraCarla,
    p_miei_calciatori: [idDi('Cen3')], p_suoi_calciatori: [idDi('Cen1')],
  })

  await rpc(bruno, 'accetta_scambio', { p_scambio: aBruno.riga.scambio })
  const altra = (await sql(`select status from public.trades where id = '${aCarla.riga.scambio}';`))[0].status
  esito(
    'Accettata una proposta, le altre sugli stessi calciatori decadono subito',
    altra === 'decaduto',
    `la proposta a Carla è ora «${altra}» invece di restare in attesa`,
  )
}

// ─── 6. Rifiutare e ritirare sono due cose diverse ──────────────────────────

{
  const s = await creaLega('Risposte')
  await metti(s.lega, s.squadreAnna.id, 'Dif3', 10)
  await metti(s.lega, s.squadreBruno.id, 'Dif4', 10)

  const p1 = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega, p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Dif3')], p_suoi_calciatori: [idDi('Dif4')],
  })
  await rpc(bruno, 'rispondi_scambio', { p_scambio: p1.riga.scambio, p_accetto: false })
  const s1 = (await sql(`select status from public.trades where id = '${p1.riga.scambio}';`))[0].status

  const p2 = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega, p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Dif3')], p_suoi_calciatori: [idDi('Dif4')],
  })
  await rpc(anna, 'rispondi_scambio', { p_scambio: p2.riga.scambio, p_accetto: false })
  const s2 = (await sql(`select status from public.trades where id = '${p2.riga.scambio}';`))[0].status

  esito(
    'Chi riceve rifiuta, chi propone ritira: il registro li distingue',
    s1 === 'rifiutato' && s2 === 'ritirato',
    `risposta di chi riceve: «${s1}» · risposta di chi propone: «${s2}»`,
  )

  const daEstraneo = await rpc(estraneo, 'rispondi_scambio', {
    p_scambio: p1.riga.scambio, p_accetto: false,
  })
  esito(
    'A una proposta che non ti riguarda non si risponde',
    daEstraneo.riga?.esito !== 'ok',
    `${daEstraneo.riga?.esito}: ${daEstraneo.riga?.messaggio}`,
  )
}

// ─── 7. Chi vede cosa, e chi non può scrivere ───────────────────────────────

{
  const s = await creaLega('Trasparenza')
  const carla = await registra('carla2')
  const codice = (await sql(`select invite_code from public.leagues where id = '${s.lega}';`))[0].invite_code
  await rpc(carla, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'Carla Trasparenza' })

  await metti(s.lega, s.squadreAnna.id, 'Att4', 10)
  await metti(s.lega, s.squadreBruno.id, 'Att1', 10)
  const p = await rpc(anna, 'proponi_scambio', {
    p_lega: s.lega, p_a_squadra: s.squadreBruno.id,
    p_miei_calciatori: [idDi('Att4')], p_suoi_calciatori: [idDi('Att1')],
  })

  const daTerzo = await leggi(carla, `scambi?select=*&league_id=eq.${s.lega}`)
  const daFuori = await leggi(estraneo, `scambi?select=id&league_id=eq.${s.lega}`)
  esito(
    'Gli scambi li vede tutta la lega, non solo le due squadre coinvolte',
    daTerzo.stato === 200 && (daTerzo.corpo?.length ?? 0) === 1,
    `un terzo partecipante vede ${daTerzo.corpo?.length ?? 0} scambi; chi non è della lega ne vede ${daFuori.corpo?.length ?? 0}`,
  )

  const voce = daTerzo.corpo?.[0]
  esito(
    'La vista porta i nomi e i calciatori già uniti',
    voce?.squadra_propone && voce?.squadra_riceve &&
      Array.isArray(voce?.danno) && voce.danno[0]?.nome === 'Att4',
    `${voce?.squadra_propone} dà ${voce?.danno?.[0]?.nome} a ${voce?.squadra_riceve}`,
  )

  const scritturaDiretta = await scrivi(bruno, 'trades', 'POST', {
    league_id: s.lega,
    from_team_id: s.squadreBruno.id,
    to_team_id: s.squadreAnna.id,
    credits: 0,
  })
  const forzatura = await scrivi(bruno, `trades?id=eq.${p.riga.scambio}`, 'PATCH', {
    status: 'accettato',
  })
  const statoVero = (await sql(`select status from public.trades where id = '${p.riga.scambio}';`))[0].status
  esito(
    'Dal client non si crea né si accetta uno scambio scrivendo nella tabella',
    scritturaDiretta.stato >= 400 && statoVero === 'proposto',
    `POST ${scritturaDiretta.stato}, PATCH ${forzatura.stato}, lo scambio è ancora «${statoVero}»`,
  )
}

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-scambi.mjs --pulisci')
