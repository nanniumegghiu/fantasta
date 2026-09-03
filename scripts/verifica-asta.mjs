// ═══════════════════════════════════════════════════════════════════════════
// Verifica della Fetta 4a: il motore dell'asta.
//
// Copre i casi limite elencati in .claude/skills/regole-asta/SKILL.md, cioè
// quelli che rompono l'asta davanti a dieci persone: il massimo offribile,
// due offerte nello stesso istante, l'offerta che arriva mentre il countdown
// scade, l'ultimo slot, la chiusura automatica.
//
// Il tempo si prova in due modi: spostando indietro l'istante dell'ultimo
// rilancio, per controllare l'aritmetica del server senza aspettare, e una
// volta sull'orologio vero, per controllare che tutto funzioni davvero.
//
// Uso:  node scripts/verifica-asta.mjs [--pulisci]
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
  await sql("select cron.schedule('fantasta-lotti-scaduti', '10 seconds', 'select public.chiudi_lotti_scaduti();');")
  console.log('Dati di prova rimossi, rete di sicurezza riaccesa.')
  process.exit(0)
}


// ─── La rete di sicurezza va sospesa durante le prove ───────────────────────
//
// Il compito pianificato chiude i lotti scaduti ogni dieci secondi. Queste
// prove fanno scadere i lotti spostando indietro l'ora dell'ultimo rilancio,
// quindi la rete interverrebbe **al posto loro**, e non si capirebbe più chi
// ha chiuso cosa. Non è un difetto del prodotto: è che una prova sul tempo e
// un compito che guarda il tempo non possono girare insieme.
//
// Si sospende qui e si riaccende alla fine, anche se qualcosa va storto.

const reteAttiva = async (v) => {
  if (v) {
    await sql(
      "select cron.schedule('fantasta-lotti-scaduti', '10 seconds', 'select public.chiudi_lotti_scaduti();');",
    )
  } else {
    // Questa forma non fallisce se il compito non c'è: restituisce zero righe.
    await sql("select cron.unschedule(jobid) from cron.job where jobname = 'fantasta-lotti-scaduti';")
  }
}

await reteAttiva(false)
process.on('exit', () => {
  // Riaccenderla è importante: lasciarla spenta lascerebbe l'app senza rete.
  void reteAttiva(true)
})

// La stagione dei dati di prova non e' mai quella vera: l'importazione
// del listone ritira i calciatori della stagione indicata che non sono nel
// file, e con una stagione condivisa manderebbe fuori listone i calciatori
// veri. E' gia' successo.
// Una stagione tutta sua, diversa da quella di ogni altra suite.
// `importa_listone` ritira i calciatori della stagione che sta caricando e
// che non trova nel file: con una stagione condivisa, ogni suite spegneva il
// listone di quella lanciata prima, e le prove passavano o fallivano a
// seconda dell'ordine. Vale anche la ragione originale: non e' mai la
// stagione vera, perche' spegnerebbe il listone dell'utente.
const STAGIONE_DI_PROVA = 'PROVA-ASTA'

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
  return { email, token: j.access_token, id: j.user.id, nome }
}

const testa = (u, extra = {}) => ({
  apikey: CHIAVE,
  ...(u ? { Authorization: `Bearer ${u.token}` } : {}),
  'Content-Type': 'application/json',
  ...extra,
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

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Preparazione ───────────────────────────────────────────────────────────
// Lega minuscola apposta: 4 slot, 20 crediti, offerta minima 1.
// Il massimo offribile all'inizio deve essere 20 − 3 = 17, e si controlla a mano.

console.log('Preparo una lega da due squadre, rosa da 4, budget 20.\n')
const admin = await registra('admin')
const amico = await registra('amico')
await sql(`insert into public.app_admins (user_id) values ('${admin.id}') on conflict do nothing;`)

const RUOLI = ['P', 'D', 'C', 'A']
const CALCIATORI = []
let id = 908100
for (const r of RUOLI) {
  for (let i = 1; i <= 3; i++) {
    CALCIATORI.push({ id: id++, nome: `${r}${i} Prova`, ruolo: r, squadra: 'Prova FC', quotazione: 5 })
  }
}
await rpc(admin, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (await rpc(admin, 'crea_lega', {
  p_nome: 'Lega Asta',
  p_stagione: STAGIONE_DI_PROVA,
  p_nome_squadra: 'Squadra Admin',
  p_crediti: 20,
  p_slot_p: 1, p_slot_d: 1, p_slot_c: 1, p_slot_a: 1,
  p_offerta_minima: 1,
  p_max_partecipanti: 2,
})).corpo
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
await rpc(amico, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'Squadra Amico' })

const squadre = await sql(`select t.id, t.name, t.user_id from public.teams t where t.league_id = '${lega}';`)
const squadraDi = (u) => squadre.find((s) => s.user_id === u.id).id
const utenteDi = (idSquadra) => (squadraDi(admin) === idSquadra ? admin : amico)

// ─── 1. Impostazioni ────────────────────────────────────────────────────────

// L'ibrida è «prima i portieri, poi movimento libero»: ha senso solo quando
// sono i partecipanti a chiamare. Nei metodi automatici coincide con la
// divisione per ruoli, e il server la rifiuta invece di far finta.
const combinazioneImpossibile = await rpc(admin, 'configura_asta', {
  p_lega: lega, p_metodo: 'random', p_variante: 'ibrida', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 3, p_secondi_countdown: 3,
})
esito(
  'Una combinazione che non ha senso viene rifiutata con la spiegazione',
  combinazioneImpossibile.riga?.esito === 'metodo_non_disponibile',
  `${combinazioneImpossibile.riga?.messaggio}`,
)

const daNonAdmin = await rpc(amico, 'configura_asta', {
  p_lega: lega, p_metodo: 'chiamata', p_variante: 'totale', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 3, p_secondi_countdown: 3,
})
esito(
  'Un partecipante non cambia le impostazioni dell asta',
  daNonAdmin.riga?.esito === 'non_autorizzato',
  `${daNonAdmin.riga?.messaggio}`,
)

const configurata = await rpc(admin, 'configura_asta', {
  p_lega: lega, p_metodo: 'chiamata', p_variante: 'totale', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 3, p_secondi_countdown: 3,
})
esito('L amministratore configura l asta', configurata.riga?.esito === 'ok', configurata.riga?.messaggio)

// ─── 2. Apertura ────────────────────────────────────────────────────────────

const aperturaAmico = await rpc(amico, 'apri_asta', { p_lega: lega, p_sorteggia: true })
esito(
  'Un partecipante non apre l asta',
  aperturaAmico.riga?.esito === 'non_autorizzato',
  `${aperturaAmico.riga?.messaggio}`,
)

const apertura = await rpc(admin, 'apri_asta', { p_lega: lega, p_sorteggia: true })
const asta = (await sql(`select id, status, nomination_order, current_turn_index
                         from public.auctions where league_id = '${lega}';`))[0]
const statoLega = (await sql(`select status from public.leagues where id = '${lega}';`))[0].status
esito(
  'L asta si apre e l ordine viene sorteggiato',
  apertura.riga?.esito === 'ok' && asta.status === 'open' && asta.nomination_order.length === 2,
  `stato asta ${asta.status}, stato lega ${statoLega}, ordine di ${asta.nomination_order.length} squadre`,
)

// ─── 3. Il massimo offribile ────────────────────────────────────────────────

const budget = await sql(`select name, credits_remaining, slot_rimanenti, massimo_offribile
                          from public.team_budget where league_id = '${lega}' order by name;`)
esito(
  'Il massimo offribile tiene da parte un credito per ogni slot restante',
  budget.every((b) => b.massimo_offribile === 17 && b.slot_rimanenti === 4),
  `20 crediti, 4 slot, offerta minima 1 → massimo ${budget[0].massimo_offribile} (atteso 17)`,
)

// ─── 4. Chiamata ────────────────────────────────────────────────────────────

const diTurno = utenteDi(asta.nomination_order[asta.current_turn_index])
const nonDiTurno = diTurno === admin ? amico : admin

const fuoriTurno = await rpc(nonDiTurno, 'chiama_calciatore', {
  p_lega: lega, p_player_id: 908100, p_importo: 1,
})
esito(
  'Non si chiama fuori dal proprio turno',
  fuoriTurno.riga?.esito === 'non_e_il_tuo_turno',
  `${fuoriTurno.riga?.messaggio}`,
)

const troppoAlta = await rpc(diTurno, 'chiama_calciatore', {
  p_lega: lega, p_player_id: 908100, p_importo: 18,
})
esito(
  'Non si puo offrire oltre il massimo, nemmeno chiamando',
  troppoAlta.riga?.esito === 'oltre_il_massimo',
  `${troppoAlta.riga?.messaggio}`,
)

const chiamata = await rpc(diTurno, 'chiama_calciatore', {
  p_lega: lega, p_player_id: 908100, p_importo: 5,
})
const lotto = chiamata.riga?.lotto
esito(
  'La chiamata apre il lotto con la prima offerta',
  chiamata.riga?.esito === 'ok' && typeof lotto === 'string',
  `${chiamata.riga?.messaggio} lotto ${lotto}`,
)

const doppiaChiamata = await rpc(diTurno, 'chiama_calciatore', {
  p_lega: lega, p_player_id: 908101, p_importo: 1,
})
esito(
  'Non si apre un secondo lotto mentre uno e in corso',
  doppiaChiamata.riga?.esito === 'lotto_chiuso',
  `${doppiaChiamata.riga?.messaggio}`,
)

// ─── 5. Rilanci ─────────────────────────────────────────────────────────────

const bassa = await rpc(nonDiTurno, 'rilancia', { p_lotto: lotto, p_importo: 5 })
esito(
  'Un rilancio pari o inferiore viene rifiutato con un messaggio utile',
  bassa.riga?.esito === 'offerta_troppo_bassa',
  `${bassa.riga?.messaggio}`,
)

const oltre = await rpc(nonDiTurno, 'rilancia', { p_lotto: lotto, p_importo: 18 })
esito(
  'Un rilancio oltre il massimo viene rifiutato',
  oltre.riga?.esito === 'oltre_il_massimo',
  `${oltre.riga?.messaggio}`,
)

const buono = await rpc(nonDiTurno, 'rilancia', { p_lotto: lotto, p_importo: 6 })
esito('Un rilancio valido passa', buono.riga?.esito === 'ok', `ora siamo a ${buono.riga?.offerta}`)

// Due offerte identiche nello stesso istante: ne deve passare una sola.
const [a, b] = await Promise.all([
  rpc(diTurno, 'rilancia', { p_lotto: lotto, p_importo: 7 }),
  rpc(nonDiTurno, 'rilancia', { p_lotto: lotto, p_importo: 7 }),
])
const passate = [a, b].filter((x) => x.riga?.esito === 'ok').length
const offerteScritte = (await sql(`select count(*)::int n from public.bids where lot_id = '${lotto}' and amount = 7;`))[0].n
esito(
  'Due offerte identiche nello stesso istante: ne passa una sola',
  passate === 1 && offerteScritte === 1,
  `accettate ${passate} su 2; offerte da 7 registrate: ${offerteScritte}; l altra: "${[a, b].find((x) => x.riga?.esito !== 'ok')?.riga?.messaggio}"`,
)

// ─── 6. Il tempo ────────────────────────────────────────────────────────────

const prestoPerChiudere = await rpc(diTurno, 'chiudi_lotto_se_scaduto', { p_lotto: lotto })
esito(
  'Il lotto non si chiude prima del tempo, nemmeno se qualcuno lo chiede',
  prestoPerChiudere.riga?.esito === 'non_ancora_scaduto',
  `${prestoPerChiudere.riga?.messaggio}`,
)

// Si sposta indietro l'ultimo rilancio: è il modo per provare l'aritmetica
// del server senza stare ad aspettare.
await sql(`update public.auction_lots set last_bid_at = now() - interval '10 seconds' where id = '${lotto}';`)

const tardiPerRilanciare = await rpc(diTurno, 'rilancia', { p_lotto: lotto, p_importo: 9 })
esito(
  'Un rilancio arrivato dopo la campanella viene rifiutato',
  tardiPerRilanciare.riga?.esito === 'lotto_chiuso',
  `${tardiPerRilanciare.riga?.messaggio}`,
)

const creditiPrima = (await sql(`select credits_remaining from public.teams
  where id = '${(await sql(`select current_bidder_team_id c from public.auction_lots where id = '${lotto}';`))[0].c}';`))[0].credits_remaining

const chiusura = await rpc(diTurno, 'chiudi_lotto_se_scaduto', { p_lotto: lotto })
const dopo = (await sql(`select t.credits_remaining, t.name,
  (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa
  from public.teams t where t.id = '${chiusura.riga?.squadra}';`))[0]
esito(
  'Allo scadere il calciatore va al miglior offerente e i crediti si scalano',
  chiusura.riga?.esito === 'ok' && dopo.rosa === 1 && dopo.credits_remaining === creditiPrima - chiusura.riga.prezzo,
  `${dopo.name}: prezzo ${chiusura.riga?.prezzo}, crediti da ${creditiPrima} a ${dopo.credits_remaining}, calciatori in rosa ${dopo.rosa}`,
)

const evento = await sql(`select type, payload from public.auction_events
  where auction_id = '${asta.id}' and type = 'aggiudicazione' order by seq desc limit 1;`)
esito(
  'Ogni aggiudicazione lascia una riga nel registro',
  evento.length === 1,
  `evento "${evento[0]?.type}" con prezzo ${evento[0]?.payload?.prezzo}`,
)

const giaPreso = await rpc(
  utenteDi((await sql(`select nomination_order[current_turn_index+1] t from public.auctions where id='${asta.id}';`))[0].t),
  'chiama_calciatore',
  { p_lega: lega, p_player_id: 908100, p_importo: 1 },
)
esito(
  'Un calciatore gia comprato non si richiama',
  giaPreso.riga?.esito === 'gia_acquistato',
  `${giaPreso.riga?.messaggio}`,
)

// ─── 7. Prova sull orologio vero ────────────────────────────────────────────

const turnoOra = (await sql(`select nomination_order[current_turn_index+1] t from public.auctions where id='${asta.id}';`))[0].t
const chiamanteVero = utenteDi(turnoOra)
const lottoVero = (await rpc(chiamanteVero, 'chiama_calciatore', {
  p_lega: lega, p_player_id: 908103, p_importo: 2,
})).riga?.lotto

console.log('\n         (aspetto 7 secondi veri per far scadere il countdown…)')
await attendi(7000)
const chiusuraVera = await rpc(chiamanteVero, 'chiudi_lotto_se_scaduto', { p_lotto: lottoVero })
esito(
  'Sull orologio vero: 3 secondi di attesa piu 3 di countdown e il lotto si chiude',
  chiusuraVera.riga?.esito === 'ok',
  `${chiusuraVera.riga?.messaggio} a ${chiusuraVera.riga?.prezzo} crediti`,
)

// ─── 8. Ruolo pieno ─────────────────────────────────────────────────────────

const conDifensore = (await sql(`select t.id, t.user_id from public.teams t
  join public.roster_players r on r.team_id = t.id
  join public.players p on p.id = r.player_id
  where t.league_id = '${lega}' and p.role = 'D' limit 1;`))[0]

if (conDifensore) {
  // Si forza il turno su quella squadra per provare il rifiuto sul ruolo pieno.
  const indice = asta.nomination_order.indexOf(conDifensore.id)
  await sql(`update public.auctions set current_turn_index = ${indice} where id = '${asta.id}';`)
  const pieno = await rpc(utenteDi(conDifensore.id), 'chiama_calciatore', {
    p_lega: lega, p_player_id: 908104, p_importo: 1,
  })
  esito(
    'Chi ha il reparto pieno non puo chiamare un altro di quel ruolo',
    pieno.riga?.esito === 'ruolo_pieno',
    `${pieno.riga?.messaggio}`,
  )
}

// ─── 9. Scritture dirette ───────────────────────────────────────────────────

async function scriviDiretto(u, tabella, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/${tabella}`, {
    method: 'POST',
    headers: testa(u, { Prefer: 'return=representation' }),
    body: JSON.stringify(corpo),
  })
  return { stato: r.status, testo: (await r.text()).slice(0, 80) }
}

const offertaFinta = await scriviDiretto(amico, 'bids', {
  lot_id: lotto, team_id: squadraDi(amico), amount: 999,
})
const rosaFinta = await scriviDiretto(amico, 'roster_players', {
  league_id: lega, team_id: squadraDi(amico), player_id: 908105, price: 0,
})
esito(
  'Nessuno scrive offerte o acquisti passando dalle tabelle',
  offertaFinta.stato >= 400 && rosaFinta.stato >= 400,
  `offerta HTTP ${offertaFinta.stato}, acquisto HTTP ${rosaFinta.stato}`,
)

const primoEvento = (await sql(`select seq, type from public.auction_events
  where auction_id = '${asta.id}' order by seq limit 1;`))[0]

const modifica = await fetch(`${URL_BASE}/rest/v1/auction_events?seq=eq.${primoEvento.seq}`, {
  method: 'PATCH',
  headers: testa(amico),
  body: JSON.stringify({ type: 'falso' }),
})
const cancella = await fetch(`${URL_BASE}/rest/v1/auction_events?seq=eq.${primoEvento.seq}`, {
  method: 'DELETE',
  headers: testa(amico),
})
const dopoTentativi = (await sql(`select type from public.auction_events where seq = ${primoEvento.seq};`))[0]
esito(
  'Il registro dell asta non si modifica ne si cancella dal client',
  dopoTentativi?.type === primoEvento.type,
  `evento ${primoEvento.seq} era "${primoEvento.type}", dopo modifica (HTTP ${modifica.status}) e cancellazione (HTTP ${cancella.status}) è ancora "${dopoTentativi?.type}"`,
)

// ─── 10. Fino in fondo: l asta si chiude da sola ────────────────────────────

let giri = 0
while (giri < 20) {
  const a = (await sql(`select id, status, nomination_order, current_turn_index
                        from public.auctions where id = '${asta.id}';`))[0]
  if (a.status !== 'open') break

  const squadraTurno = a.nomination_order[a.current_turn_index]
  const mancanti = (await sql(`select p.role, public.slot_liberi_ruolo('${squadraTurno}', p.role) liberi
    from (select unnest(enum_range(null::public.ruolo_calciatore)) role) p;`))
    .filter((r) => r.liberi > 0)
    .map((r) => r.role)

  // Solo il listone di prova: da quando l'asta rispetta la stagione della
  // lega, pescare fra i calciatori veri porterebbe a chiamate rifiutate.
  const disponibile = (await sql(`select p.id from public.players p
    where p.season = '${STAGIONE_DI_PROVA}' and p.active
      and p.role = any(array[${mancanti.map((r) => `'${r}'`).join(',')}]::public.ruolo_calciatore[])
      and not exists (select 1 from public.roster_players r
                      where r.league_id = '${lega}' and r.player_id = p.id)
    limit 1;`))[0]
  if (!disponibile) break

  const chiam = await rpc(utenteDi(squadraTurno), 'chiama_calciatore', {
    p_lega: lega, p_player_id: disponibile.id, p_importo: 1,
  })
  if (chiam.riga?.esito !== 'ok') break
  await sql(`update public.auction_lots set last_bid_at = now() - interval '10 seconds' where id = '${chiam.riga.lotto}';`)
  await rpc(utenteDi(squadraTurno), 'chiudi_lotto_se_scaduto', { p_lotto: chiam.riga.lotto })
  giri++
}

const finale = (await sql(`select status from public.auctions where id = '${asta.id}';`))[0]
const legaFinale = (await sql(`select status from public.leagues where id = '${lega}';`))[0]
const rose = await sql(`select t.name, t.credits_remaining,
  (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa
  from public.teams t where t.league_id = '${lega}' order by t.name;`)
esito(
  'Quando le rose sono complete l asta si chiude da sola',
  finale.status === 'closed' && legaFinale.status === 'done' && rose.every((r) => r.rosa === 4),
  `asta ${finale.status}, lega ${legaFinale.status}; ${rose.map((r) => `${r.name}: ${r.rosa} calciatori, ${r.credits_remaining} crediti`).join(' · ')}`,
)

esito(
  'Nessuna squadra e finita sotto zero crediti',
  rose.every((r) => r.credits_remaining >= 0),
  `crediti residui: ${rose.map((r) => r.credits_remaining).join(', ')}`,
)

const duplicati = await sql(`select player_id, count(*) n from public.roster_players
  where league_id = '${lega}' group by player_id having count(*) > 1;`)
esito(
  'Nessun calciatore e finito in due rose',
  duplicati.length === 0,
  `calciatori duplicati: ${duplicati.length}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

await reteAttiva(true)

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-asta.mjs --pulisci')
