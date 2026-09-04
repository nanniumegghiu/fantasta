// ═══════════════════════════════════════════════════════════════════════════
// Prova mirata di `nuovo_giro`.
//
// Si costruisce una lega con otto portieri e due posti da portiere, si passano
// tutti e otto senza che nessuno li voglia — che è esattamente quello che
// succede alla fine di un reparto vero — e si controlla che tornino nel mazzo.
//
// Le prove che contano non sono quelle che verificano che funzioni: sono le
// tre che verificano che **non** faccia più di quello che deve. Chi è già
// stato comprato non deve tornare in asta, chi non amministra non deve poter
// rimescolare, e mentre c'è un calciatore in asta non si tocca niente.
//
// Uso:  node scripts/prova-nuovo-giro.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { CHIAVE, URL_BASE, sql } from './lib/fm.mjs'

const STAGIONE = 'PROVA-GIRO'
const esiti = []
const ok = (nome, buono, dettaglio) => {
  esiti.push(buono)
  console.log(`${buono ? '  OK  ' : ' FALLITA '} ${nome}\n         ${dettaglio}`)
}

async function pulisci() {
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@giro.test');`)
  await sql("delete from auth.users where email like '%@giro.test';")
  await sql('delete from public.player_stats where player_id >= 909700 and player_id < 909800;')
  await sql('delete from public.players where id >= 909700 and id < 909800;')
}

if (process.argv.includes('--pulisci')) {
  await pulisci()
  console.log('Pulito.')
  process.exit(0)
}
await pulisci()

async function registra(nome) {
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${nome}.${Date.now()}${Math.floor(Math.random() * 999)}@giro.test`,
      password: 'password-di-prova',
      data: { display_name: nome },
    }),
  })
  return await r.json()
}

const capo = await registra('capo')
await sql(`insert into public.app_admins (user_id) values ('${capo.user.id}') on conflict do nothing;`)

const chiama = async (token, fn, corpo) => {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo ?? {}),
  })
  const t = await r.json().catch(() => null)
  return Array.isArray(t) ? t[0] : t
}
const rpc = (fn, corpo) => chiama(capo.access_token, fn, corpo)

const CALCIATORI = Array.from({ length: 8 }, (_, i) => ({
  id: 909700 + i,
  nome: `Giro P${i + 1}`,
  ruolo: 'P',
  squadra: 'Prova FC',
  quotazione: 10 - i,
}))
await rpc('importa_listone', { p_stagione: STAGIONE, p_righe: CALCIATORI })

const lega = await rpc('crea_lega', {
  p_nome: 'Lega del Giro',
  p_stagione: STAGIONE,
  p_nome_squadra: 'Capolista',
  p_crediti: 100,
  p_slot_p: 2,
  // Il regolamento non ammette reparti da zero posti: si mette il minimo, e
  // la fase resta sui portieri finche non li hanno presi tutti.
  p_slot_d: 1,
  p_slot_c: 1,
  p_slot_a: 1,
  p_max_partecipanti: 4,
})

// Un'asta vuole almeno due squadre. La seconda non ha proprietario: serve solo
// a fare numero, e il turno la salta da sola.
await sql(`insert into public.teams (league_id, user_id, name, credits_remaining)
  values ('${lega}', null, 'Fantasma', 100);`)

await rpc('configura_asta', {
  p_lega: lega,
  p_metodo: 'random',
  p_variante: 'per_ruolo',
  p_conduzione: 'app',
  p_tipo_chiamata: 'libera',
  p_secondi_inattivita: 3,
  p_secondi_countdown: 3,
})
await rpc('apri_asta', { p_lega: lega, p_sorteggia: false })

async function lottoAperto() {
  const [l] = await sql(`select lo.id, lo.player_id from public.auction_lots lo
    join public.auctions a on a.id = lo.auction_id
    where a.league_id = '${lega}' and lo.status = 'open' limit 1;`)
  return l ?? null
}

/**
 * Passa tutto quello che si apre, finché non si apre più niente.
 *
 * Chiede un lotto nuovo **solo se non ce n'è già uno**: passare un calciatore
 * ne apre subito un altro da solo, perché nei metodi a estrazione la catena è
 * automatica. La prima versione di questa prova chiedeva sempre di estrarre,
 * si prendeva un «c'è già un calciatore all'asta» al secondo giro, e usciva
 * dopo un solo passaggio dando la colpa alla funzione nuova.
 */
async function passaTutti() {
  let quanti = 0
  for (let i = 0; i < 20; i++) {
    let l = await lottoAperto()
    if (!l) {
      const aperto = await rpc('apri_prossimo_lotto', { p_lega: lega })
      if (aperto?.esito !== 'ok') break
      l = await lottoAperto()
      if (!l) break
    }
    await rpc('passa_lotto', { p_lotto: l.id })
    quanti++
  }
  return quanti
}

// Nessuno li vuole: si passano tutti.
const passati = await passaTutti()

const finito = await rpc('apri_prossimo_lotto', { p_lega: lega })
ok(
  'Passati tutti, il reparto risulta finito',
  passati === 8 && finito?.esito === 'listone_finito',
  `${passati} passati, poi il server dice «${finito?.esito}: ${finito?.messaggio}»`,
)

const giro = await rpc('nuovo_giro', { p_lega: lega })
ok(
  'Il giro nuovo rimette nel mazzo chi nessuno ha voluto',
  giro?.esito === 'ok' && giro?.rimessi === 8,
  `${giro?.rimessi} rimessi · «${giro?.messaggio}»`,
)

const dopo = await rpc('apri_prossimo_lotto', { p_lega: lega })
const tornatoInAsta = await lottoAperto()
ok(
  'E subito dopo torna in asta qualcuno',
  Boolean(tornatoInAsta),
  tornatoInAsta
    ? `in asta il calciatore ${tornatoInAsta.player_id}`
    : `nessuno: il server ha detto «${dopo?.esito}: ${dopo?.messaggio}»`,
)

const conLottoAperto = await rpc('nuovo_giro', { p_lega: lega })
ok(
  'Con un calciatore in asta non si rimescola niente',
  conLottoAperto?.esito === 'lotto_chiuso',
  `«${conLottoAperto?.messaggio}»`,
)

// Uno lo si compra davvero: quello non deve tornare nel mazzo mai più.
const inAsta = await lottoAperto()
const [miaSquadra] = await sql(
  `select id from public.teams where league_id = '${lega}' and user_id = '${capo.user.id}';`,
)
await rpc('assegna_rapido', {
  p_lega: lega,
  p_player_id: inAsta.player_id,
  p_squadra: miaSquadra.id,
  p_prezzo: 5,
})

await passaTutti()
const giro2 = await rpc('nuovo_giro', { p_lega: lega })
// La prova giusta non è «quel calciatore non ha lotti annullati»: ne ha uno,
// legittimo, del primo giro, quando ancora non l'aveva comprato nessuno.
// Quella sbagliata è passata per un soffio e diceva il falso.
//
// Quello che conta è che il **secondo** giro rimetta nel mazzo sette e non
// otto: chi nel frattempo è finito in una rosa resta fuori. E che ci resti.
const [ancoraSuo] = await sql(`select count(*)::int n from public.roster_players
  where league_id = '${lega}' and player_id = ${inAsta.player_id};`)
ok(
  'Chi è già stato comprato non torna nel mazzo',
  giro2?.rimessi === 7 && ancoraSuo.n === 1,
  `il secondo giro ne ha rimessi ${giro2?.rimessi} su 8: fuori il comprato ` +
    `(${inAsta.player_id}), che è ancora in rosa (${ancoraSuo.n} riga)`,
)

const registro = await sql(`select payload::text from public.auction_events e
  join public.auctions a on a.id = e.auction_id
  where a.league_id = '${lega}' and e.type = 'nuovo_giro' order by seq;`)
ok(
  'Ogni rimescolata finisce nel registro',
  registro.length === 2 && registro.every((r) => r.payload.includes('reparto')),
  registro.map((r) => r.payload).join(' · ') || 'nessuna riga',
)

const [visibile] = await sql(`select count(*)::int n from public.registro_asta r
  join public.auctions a on a.id = r.auction_id
  where a.league_id = '${lega}' and r.type = 'nuovo_giro' and r.manuale;`)
ok(
  'Il registro lo marca come intervento, non come gioco normale',
  visibile.n === 2,
  `${visibile.n} righe su 2 marcate «intervento»`,
)

const intruso = await registra('intruso')
const tentativo = await chiama(intruso.access_token, 'nuovo_giro', { p_lega: lega })
ok(
  'Un giro nuovo non lo apre chi capita',
  tentativo?.esito === 'non_autorizzato',
  `«${tentativo?.messaggio}»`,
)

const passate = esiti.filter(Boolean).length
console.log(`\n${passate} superate su ${esiti.length}.`)
console.log('Pulisci con: node scripts/prova-nuovo-giro.mjs --pulisci')
process.exit(passate === esiti.length ? 0 : 1)
