// ═══════════════════════════════════════════════════════════════════════════
// La pausa fra un reparto e l'altro.
//
// Le due prove che contano sono agli estremi: che **non** si metta in pausa
// all'apertura — quello non è un cambio di reparto, è l'inizio — e che dopo la
// pausa non si apra niente finché chi conduce non lo dice. In mezzo, che il
// calciatore successivo non venga aperto dentro un'asta ferma: sarebbe un
// regalo al primo che rilancia.
//
// Uso:  node scripts/prova-cambio-reparto.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { CHIAVE, URL_BASE, sql } from './lib/fm.mjs'

const STAGIONE = 'PROVA-REP'
const esiti = []
const ok = (nome, buono, dettaglio) => {
  esiti.push(buono)
  console.log(`${buono ? '  OK  ' : ' FALLITA '} ${nome}\n         ${dettaglio}`)
}

async function pulisci() {
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@reparto.test');`)
  await sql("delete from auth.users where email like '%@reparto.test';")
  await sql('delete from public.player_stats where player_id >= 909900 and player_id < 910000;')
  await sql('delete from public.players where id >= 909900 and id < 910000;')
}
if (process.argv.includes('--pulisci')) {
  await pulisci()
  console.log('Pulito.')
  process.exit(0)
}
await pulisci()

const capo = await (
  await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `capo.${Date.now()}@reparto.test`,
      password: 'password-di-prova',
      data: { display_name: 'capo' },
    }),
  })
).json()
await sql(`insert into public.app_admins (user_id) values ('${capo.user.id}') on conflict do nothing;`)

const rpc = async (fn, corpo) => {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${capo.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo ?? {}),
  })
  const t = await r.json().catch(() => null)
  return Array.isArray(t) ? t[0] : t
}

// Due portieri e due difensori: due squadre con un posto per reparto
// esauriscono i portieri in due mosse.
const CALCIATORI = [
  { id: 909900, nome: 'Rep P1', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 909901, nome: 'Rep P2', ruolo: 'P', squadra: 'Prova FC', quotazione: 8 },
  { id: 909902, nome: 'Rep D1', ruolo: 'D', squadra: 'Prova FC', quotazione: 9 },
  { id: 909903, nome: 'Rep D2', ruolo: 'D', squadra: 'Prova FC', quotazione: 7 },
  { id: 909904, nome: 'Rep C1', ruolo: 'C', squadra: 'Prova FC', quotazione: 6 },
  { id: 909905, nome: 'Rep A1', ruolo: 'A', squadra: 'Prova FC', quotazione: 5 },
]
await rpc('importa_listone', { p_stagione: STAGIONE, p_righe: CALCIATORI })

const lega = await rpc('crea_lega', {
  p_nome: 'Lega dei Reparti',
  p_stagione: STAGIONE,
  p_nome_squadra: 'Capolista',
  p_crediti: 100,
  p_slot_p: 1,
  p_slot_d: 1,
  p_slot_c: 1,
  p_slot_a: 1,
  p_max_partecipanti: 4,
})
if (typeof lega !== 'string') { console.error('crea_lega ha risposto:', JSON.stringify(lega)); process.exit(1) }
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

const stato = async () =>
  (await sql(`select status::text s, current_role_phase::text fase
    from public.auctions where league_id = '${lega}';`))[0]

await rpc('apri_asta', { p_lega: lega, p_sorteggia: false })
const dopoApertura = await stato()
ok(
  'All apertura non si va in pausa: quello non e un cambio, e l inizio',
  dopoApertura.s === 'open' && dopoApertura.fase === 'P',
  `asta ${dopoApertura.s}, reparto ${dopoApertura.fase}`,
)

// Si assegnano i due portieri: il reparto dei portieri finisce.
const squadre = await sql(`select id, name from public.teams where league_id = '${lega}' order by created_at;`)
await rpc('assegna_rapido', { p_lega: lega, p_player_id: 909900, p_squadra: squadre[0].id, p_prezzo: 3 })
await rpc('assegna_rapido', { p_lega: lega, p_player_id: 909901, p_squadra: squadre[1].id, p_prezzo: 3 })

const tentativo = await rpc('apri_prossimo_lotto', { p_lega: lega })
const dopoIlCambio = await stato()
ok(
  'Finiti i portieri l asta si ferma da sola, e passa ai difensori',
  dopoIlCambio.s === 'paused' && dopoIlCambio.fase === 'D',
  `asta ${dopoIlCambio.s}, reparto ${dopoIlCambio.fase} · il server dice «${tentativo?.messaggio}»`,
)

const lottiInPausa = (
  await sql(`select count(*)::int n from public.auction_lots lo
    join public.auctions a on a.id = lo.auction_id
    where a.league_id = '${lega}' and lo.status = 'open';`)
)[0].n
ok(
  'Durante la pausa non si apre nessun calciatore',
  lottiInPausa === 0,
  `${lottiInPausa} calciatori all asta mentre l asta e ferma ` +
    '(uno solo vorrebbe dire regalarlo al primo che rilancia)',
)

// Insistere non deve sbloccare niente: la pausa la toglie una persona.
await rpc('apri_prossimo_lotto', { p_lega: lega })
await rpc('apri_prossimo_lotto', { p_lega: lega })
const insistito = await stato()
ok(
  'Insistere con l estrazione non toglie la pausa',
  insistito.s === 'paused',
  `dopo tre tentativi l asta e ancora ${insistito.s}`,
)

const evento = await sql(`select payload::text p from public.auction_events e
  join public.auctions a on a.id = e.auction_id
  where a.league_id = '${lega}' and e.type = 'cambio_reparto';`)
ok(
  'Il cambio di reparto finisce nel registro',
  evento.length === 1 && evento[0].p.includes('"da": "P"') && evento[0].p.includes('"a": "D"'),
  evento.map((x) => x.p).join(' · ') || 'nessuna riga',
)

// Chi conduce dà il via.
await rpc('pausa_asta', { p_lega: lega, p_in_pausa: false })
const ripartita = await rpc('apri_prossimo_lotto', { p_lega: lega })
const [inAsta] = await sql(`select p.name, p.role::text r from public.auction_lots lo
  join public.players p on p.id = lo.player_id
  join public.auctions a on a.id = lo.auction_id
  where a.league_id = '${lega}' and lo.status = 'open';`)
ok(
  'Quando chi conduce riprende, il reparto nuovo parte',
  ripartita?.esito === 'ok' && inAsta?.r === 'D',
  inAsta ? `in asta ${inAsta.name} (${inAsta.r})` : `nessuno: «${ripartita?.messaggio}»`,
)

const passate = esiti.filter(Boolean).length
console.log(`\n${passate} superate su ${esiti.length}.`)
console.log('Pulisci con: node scripts/prova-cambio-reparto.mjs --pulisci')
process.exit(passate === esiti.length ? 0 : 1)
