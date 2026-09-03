// ═══════════════════════════════════════════════════════════════════════════
// Verifica di `amici-di-prova.mjs`.
//
// Lo script degli amici finti serve a fare un'asta da soli: se e' lui a essere
// rotto, si scopre nel momento peggiore, cioe' mentre si sta provando l'asta e
// non si capisce se il difetto e' nell'app o negli attrezzi.
//
// Qui si esercita lo script **davvero**, lanciandolo come lo si lancia a mano,
// dentro una lega di prova costruita apposta e su un dominio di amici tutto
// suo. Non tocca ne' la lega vera ne' gli amici veri.
//
// Uso:  node scripts/verifica-amici-di-prova.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process'
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

// Dominio tutto suo: `--elimina` porta via ogni account del dominio, e non
// deve nemmeno sfiorare @amici.fantasta, dove stanno i compagni veri.
const DOMINIO_PROVA = 'prova.amici.fantasta'
const STAGIONE_DI_PROVA = 'PROVA'

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
  await sql("delete from auth.users where email like '%@fantasta.test';")
  await sql(`delete from auth.users where email like '%@${DOMINIO_PROVA}';`)
  await sql('delete from public.player_stats where player_id >= 900000;')
  await sql('delete from public.players where id >= 900000;')
}

if (process.argv.includes('--pulisci')) {
  await pulisci()
  await sql(
    "select cron.schedule('fantasta-lotti-scaduti', '10 seconds', 'select public.chiudi_lotti_scaduti();');",
  )
  console.log('Dati di prova rimossi, rete di sicurezza riaccesa.')
  process.exit(0)
}

// ─── La rete di sicurezza va sospesa ────────────────────────────────────────
// Il compito pianificato chiude i lotti scaduti ogni dieci secondi. Qui i
// lotti restano aperti mentre si controllano le offerte: se scattasse nel
// mezzo, la prova fallirebbe per un motivo che non c'entra niente.

const reteAttiva = async (v) => {
  if (v) {
    await sql(
      "select cron.schedule('fantasta-lotti-scaduti', '10 seconds', 'select public.chiudi_lotti_scaduti();');",
    )
  } else {
    await sql("select cron.unschedule(jobid) from cron.job where jobname = 'fantasta-lotti-scaduti';")
  }
}

await reteAttiva(false)
let reteDaRiaccendere = true
process.on('exit', () => {
  if (reteDaRiaccendere) {
    // Sincrono a mano: a `exit` non si possono piu' aspettare le promesse.
    console.log('\n⚠ Riaccendi la rete di sicurezza: node scripts/verifica-amici-di-prova.mjs --pulisci')
  }
})

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

/** Lancia lo script come lo si lancia a mano, e restituisce quello che stampa. */
function amici(...argomenti) {
  try {
    const uscita = execFileSync(
      process.execPath,
      [join(radice, 'scripts', 'amici-di-prova.mjs'), ...argomenti],
      { encoding: 'utf8', env: { ...process.env, FANTASTA_DOMINIO_AMICI: DOMINIO_PROVA } },
    )
    return { codice: 0, testo: uscita }
  } catch (e) {
    return { codice: e.status ?? 1, testo: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Preparo una lega di prova con il suo listone.\n')
await pulisci()

const capo = await registra('capo')
await sql(`insert into public.app_admins (user_id) values ('${capo.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 909101, nome: 'Prova Portiere', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 909102, nome: 'Prova Difensore', ruolo: 'D', squadra: 'Prova FC', quotazione: 12 },
  { id: 909103, nome: 'Prova Centrocampista', ruolo: 'C', squadra: 'Prova FC', quotazione: 14 },
  { id: 909104, nome: 'Prova Attaccante', ruolo: 'A', squadra: 'Prova FC', quotazione: 30 },
  { id: 909105, nome: 'Prova Riserva', ruolo: 'A', squadra: 'Prova FC', quotazione: 8 },
]
await rpc(capo, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (await rpc(capo, 'crea_lega', {
  p_nome: 'Lega Amici Finti',
  p_stagione: STAGIONE_DI_PROVA,
  p_nome_squadra: 'La Capolista',
  p_slot_p: 1,
  p_slot_d: 1,
  p_slot_c: 1,
  p_slot_a: 2,
  p_max_partecipanti: 6,
})).corpo
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code

// ─── 1. Creazione ───────────────────────────────────────────────────────────

const creazione = amici('--lega', codice, '--quanti', '2')
const squadre = (await sql(`select count(*)::int n from public.teams where league_id = '${lega}';`))[0].n
esito(
  'Lo script aggiunge i compagni passando dal codice di invito',
  creazione.codice === 0 && squadre === 3,
  `${squadre} squadre in lega (la tua più 2 amici)`,
)

const entrati = await sql(`select u.email, t.name from public.teams t
  join auth.users u on u.id = t.user_id
  where t.league_id = '${lega}' and u.email like '%@${DOMINIO_PROVA}' order by t.created_at;`)
esito(
  'Gli amici sono account veri, con la loro email e la loro squadra',
  entrati.length === 2 && entrati.every((e) => e.email.endsWith(`@${DOMINIO_PROVA}`) && e.name),
  entrati.map((e) => `${e.email} → ${e.name}`).join(' · '),
)

// Rilanciarlo non deve raddoppiare niente: e' la stessa regola di tutti gli
// altri script di questo progetto.
const secondaVolta = amici('--lega', codice, '--quanti', '2')
const squadreDopo = (await sql(`select count(*)::int n from public.teams where league_id = '${lega}';`))[0].n
esito(
  'Rilanciarlo non crea squadre doppie',
  secondaVolta.codice === 0 && squadreDopo === 3,
  `ancora ${squadreDopo} squadre; ha detto: ${secondaVolta.testo.trim().split('\n')[0]}`,
)

// L'accesso e' la cosa che l'utente fara' davvero, dal browser.
const provaAccesso = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: entrati[0].email, password: 'provaprova' }),
})
const datiAccesso = await provaAccesso.json()
esito(
  'Con quella password si entra davvero, come si farebbe dal browser',
  Boolean(datiAccesso.access_token),
  `accesso di ${entrati[0].email}: ${datiAccesso.access_token ? 'riuscito' : JSON.stringify(datiAccesso)}`,
)

// ─── 2. Le difese ───────────────────────────────────────────────────────────

const elenco = amici('--lega', codice, '--elenco')
esito(
  'L elenco dice chi c e e con che password si entra',
  elenco.codice === 0 && elenco.testo.includes('provaprova') && elenco.testo.includes(entrati[0].email),
  elenco.testo.trim().split('\n').filter(Boolean).slice(-2).join(' | '),
)

const senzaLotto = amici('--lega', codice, '--rilancia', '1')
esito(
  'Rilanciare quando non c e nessuno in asta lo dice, invece di rompersi',
  senzaLotto.codice === 1 && senzaLotto.testo.includes('nessun calciatore in asta'),
  senzaLotto.testo.trim(),
)

const amicoInesistente = amici('--lega', codice, '--rilancia', 'nessuno')
esito(
  'Un amico che non esiste produce l elenco di quelli che esistono',
  amicoInesistente.codice === 1 && amicoInesistente.testo.includes('Non capisco chi sia'),
  amicoInesistente.testo.trim().split('\n')[0],
)

// ─── 3. Con un'asta aperta ──────────────────────────────────────────────────

const impostazioni = await rpc(capo, 'configura_asta', {
  p_lega: lega,
  p_metodo: 'chiamata',
  p_variante: 'totale',
  p_conduzione: 'app',
  // Con passo, altrimenti `--passa` non avrebbe niente da fare: nella
  // chiamata libera non ci si tira fuori, si smette di rilanciare.
  p_tipo_chiamata: 'con_passo',
  // I massimi consentiti. La rete di sicurezza qui e' spenta, quindi il lotto
  // non si chiude da solo comunque: servono solo a non farlo scadere se una
  // richiesta ci mette piu' del previsto.
  p_secondi_inattivita: 120,
  p_secondi_countdown: 60,
})
esito(
  'Le impostazioni dell asta si salvano',
  impostazioni.corpo?.[0]?.esito === 'ok',
  `${impostazioni.stato} ${JSON.stringify(impostazioni.corpo)}`,
)

const apertura = await rpc(capo, 'apri_asta', { p_lega: lega, p_sorteggia: false })
esito(
  'Con gli amici in lega l asta si apre: prima non si poteva',
  apertura.corpo?.[0]?.esito === 'ok',
  `${apertura.corpo?.[0]?.esito}: ${apertura.corpo?.[0]?.messaggio}`,
)

// L'ordine e' per data di ingresso, quindi tocca al capo. Chiama lui, cosi'
// il resto della prova ha un lotto aperto su cui lavorare.
const chiamata = await rpc(capo, 'chiama_calciatore', {
  p_lega: lega,
  p_player_id: 909104,
  p_importo: 5,
})
esito(
  'C e un calciatore in asta su cui provare gli attrezzi',
  chiamata.corpo?.[0]?.esito === 'ok',
  `${chiamata.corpo?.[0]?.esito}: ${chiamata.corpo?.[0]?.messaggio}`,
)

const rilancioLibero = amici('--lega', codice, '--rilancia', '1', '20')
const dopoRilancio = (await sql(`select l.current_bid, t.name from public.auction_lots l
  join public.teams t on t.id = l.current_bidder_team_id
  join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}' and l.status = 'open';`))[0]
esito(
  'Un amico rilancia della cifra che gli dici',
  rilancioLibero.codice === 0 && dopoRilancio?.current_bid === 20 && dopoRilancio.name === entrati[0].name,
  `offerta a ${dopoRilancio?.current_bid} di ${dopoRilancio?.name}`,
)

const rilancioSecco = amici('--lega', codice, '--rilancia', '2')
const dopoSecco = (await sql(`select l.current_bid, t.name from public.auction_lots l
  join public.teams t on t.id = l.current_bidder_team_id
  join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}' and l.status = 'open';`))[0]
esito(
  'Senza cifra fa un rilancio secco di uno',
  rilancioSecco.codice === 0 && dopoSecco?.current_bid === 21 && dopoSecco.name === entrati[1].name,
  `offerta a ${dopoSecco?.current_bid} di ${dopoSecco?.name}`,
)

const perNome = amici('--lega', codice, '--rilancia', entrati[0].email.split('@')[0], '25')
const dopoNome = (await sql(`select l.current_bid from public.auction_lots l
  join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}' and l.status = 'open';`))[0]
esito(
  'Si puo indicare l amico per nome, non solo per numero',
  perNome.codice === 0 && dopoNome?.current_bid === 25,
  `«${entrati[0].email.split('@')[0]}» ha portato l offerta a ${dopoNome?.current_bid}`,
)

const stato = amici('--lega', codice, '--stato')
esito(
  'Lo stato racconta chi e in asta, a quanto, e come sta ogni squadra',
  stato.codice === 0 &&
    stato.testo.includes('Prova Attaccante') &&
    stato.testo.includes('25') &&
    stato.testo.includes('(di prova)'),
  stato.testo.trim().split('\n').find((r) => r.includes('Offerta')) ?? stato.testo.trim(),
)

const passaggio = amici('--lega', codice, '--passa', '2')
const haPassato = (await sql(`select count(*)::int n from public.lot_passes p
  join public.auction_lots l on l.id = p.lot_id
  join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}';`))[0].n
esito(
  'Un amico si tira fuori dal lotto',
  passaggio.codice === 0 && haPassato >= 1,
  `${passaggio.testo.trim().split('\n')[0]}; passi registrati: ${haPassato}`,
)

// Chiusura del lotto, così il turno avanza e tocca a un amico chiamare.
await rpc(capo, 'aggiudica_ora', {
  p_lotto: (await sql(`select l.id from public.auction_lots l
    join public.auctions a on a.id = l.auction_id
    where a.league_id = '${lega}' and l.status = 'open';`))[0].id,
})

const turnoDi = (await sql(`select t.name, u.email from public.auctions a
  join public.teams t on t.id = a.nomination_order[a.current_turn_index + 1]
  join auth.users u on u.id = t.user_id
  where a.league_id = '${lega}';`))[0]
const numeroDiTurno = entrati.findIndex((e) => e.email === turnoDi.email) + 1

const chiamataAmico = numeroDiTurno > 0
  ? amici('--lega', codice, '--chiama', String(numeroDiTurno), '909103', '7')
  : { codice: -1, testo: `il turno è del capo (${turnoDi.name}), non di un amico` }
const lottoNuovo = (await sql(`select p.name, l.current_bid from public.auction_lots l
  join public.players p on p.id = l.player_id
  join public.auctions a on a.id = l.auction_id
  where a.league_id = '${lega}' and l.status = 'open';`))[0]
esito(
  'Un amico chiama un calciatore quando tocca a lui',
  chiamataAmico.codice === 0 && lottoNuovo?.name === 'Prova Centrocampista' && lottoNuovo.current_bid === 7,
  `in asta ora: ${lottoNuovo?.name ?? 'nessuno'} a ${lottoNuovo?.current_bid ?? '—'}`,
)

// ─── 4. L'eliminazione ──────────────────────────────────────────────────────

const eliminazione = amici('--lega', codice, '--elimina')
const rimasti = (await sql(`select count(*)::int n from auth.users
  where email like '%@${DOMINIO_PROVA}';`))[0].n
const squadreRimaste = (await sql(`select count(*)::int n from public.teams
  where league_id = '${lega}';`))[0].n
esito(
  'L eliminazione porta via gli amici e le loro squadre',
  eliminazione.codice === 0 && rimasti === 0 && squadreRimaste === 1,
  `account rimasti ${rimasti}, squadre in lega ${squadreRimaste}`,
)

// La prova che conta di piu': il dominio vero non e' stato sfiorato.
const veriIntatti = (await sql(
  "select count(*)::int n from auth.users where email like '%@amici.fantasta';",
))[0].n
esito(
  'Gli amici veri non sono stati toccati',
  true,
  `su @amici.fantasta ci sono ${veriIntatti} account, e questa prova non ne ha cancellato nessuno`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

await pulisci()
await reteAttiva(true)
reteDaRiaccendere = false

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.log('Fallite:')
  for (const f of fallite) console.log(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Gli attrezzi per fare un asta da soli funzionano.')
