// ═══════════════════════════════════════════════════════════════════════════
// Verifica delle sotto-fette 4c, 4d ed 4e.
//
//   4c  le sette combinazioni di metodo e variante, più la modalità live
//   4d  i poteri dell'amministratore: passa, assegna, aggiudica, annulla
//   4e  la chiamata con passo
//   +   la rete di sicurezza che chiude i lotti dimenticati
//
// Ogni scenario si costruisce la sua lega, così le prove non si disturbano.
//
// Uso:  node scripts/verifica-asta-completa.mjs [--pulisci]
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
  await sql('delete from public.player_stats;')
  await sql('delete from public.players;')
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
  return { email, token: j.access_token, id: j.user.id, nome }
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

// ─── Listone di prova, con nomi che si ordinano in modo prevedibile ─────────

const admin = await registra('admin')
const amico = await registra('amico')
const terzo = await registra('terzo')
await sql(`insert into public.app_admins (user_id) values ('${admin.id}') on conflict do nothing;`)

const CALCIATORI = []
let id = 8200
for (const [ruolo, base] of [['P', 'portiere'], ['D', 'difensore'], ['C', 'centrocampo'], ['A', 'attacco']]) {
  for (const lettera of ['A', 'B', 'C', 'D']) {
    CALCIATORI.push({
      id: id++,
      nome: `${lettera}${base}`,
      ruolo,
      squadra: 'Prova FC',
      quotazione: lettera === 'A' ? 30 : lettera === 'B' ? 20 : lettera === 'C' ? 10 : 3,
    })
  }
}
await rpc(admin, 'importa_listone', { p_stagione: '2026/27', p_righe: CALCIATORI })
const idDi = (nome) => CALCIATORI.find((c) => c.nome === nome).id

/** Costruisce una lega pronta con l'asta configurata e aperta. */
async function scenario(nome, impostazioni, opzioni = {}) {
  const slot = opzioni.slot ?? { P: 1, D: 1, C: 1, A: 1 }
  const lega = (await rpc(admin, 'crea_lega', {
    p_nome: nome,
    p_stagione: '2026/27',
    p_nome_squadra: `Admin ${nome}`,
    p_crediti: opzioni.crediti ?? 100,
    p_slot_p: slot.P, p_slot_d: slot.D, p_slot_c: slot.C, p_slot_a: slot.A,
    p_offerta_minima: 1,
    p_max_partecipanti: 3,
  })).riga
  const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
  await rpc(amico, 'entra_in_lega', { p_codice: codice, p_nome_squadra: `Amico ${nome}` })
  if (opzioni.tre) await rpc(terzo, 'entra_in_lega', { p_codice: codice, p_nome_squadra: `Terzo ${nome}` })

  const config = await rpc(admin, 'configura_asta', {
    p_lega: lega,
    p_metodo: impostazioni.metodo,
    p_variante: impostazioni.variante,
    p_conduzione: impostazioni.conduzione ?? 'app',
    p_tipo_chiamata: impostazioni.tipo ?? 'libera',
    p_secondi_inattivita: 3,
    p_secondi_countdown: 3,
    p_filtro_random: impostazioni.filtro ?? {},
  })
  if (!opzioni.nonAprire) await rpc(admin, 'apri_asta', { p_lega: lega, p_sorteggia: false })

  const asta = (await sql(`select id, current_role_phase, nomination_order, current_turn_index
                           from public.auctions where league_id = '${lega}';`))[0]
  const squadre = await sql(`select id, name, user_id from public.teams where league_id = '${lega}';`)
  const utenteDi = (idSquadra) => [admin, amico, terzo].find((u) => u.id === squadre.find((s) => s.id === idSquadra).user_id)

  return { lega, asta, squadre, utenteDi, config }
}

const scadi = (idLotto) =>
  sql(`update public.auction_lots set last_bid_at = now() - interval '30 seconds' where id = '${idLotto}';`)

// ═══════════════════════════════════════════════════════════════════════════
// 4c · Le varianti
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n── 4c · le varianti ───────────────────────────────────────────\n')

// Chiamata per ruolo: si parte dai portieri e non si esce dal reparto.
{
  const s = await scenario('PerRuolo', { metodo: 'chiamata', variante: 'per_ruolo' })
  const diTurno = s.utenteDi(s.asta.nomination_order[s.asta.current_turn_index])

  esito(
    'Chiamata per ruolo: si parte dal reparto dei portieri',
    s.asta.current_role_phase === 'P',
    `reparto aperto: ${s.asta.current_role_phase}`,
  )

  const fuoriReparto = await rpc(diTurno, 'chiama_calciatore', {
    p_lega: s.lega, p_player_id: idDi('Adifensore'), p_importo: 1,
  })
  esito(
    'Non si chiama un difensore mentre è aperto il reparto portieri',
    fuoriReparto.riga?.esito === 'reparto_chiuso',
    `${fuoriReparto.riga?.messaggio}`,
  )

  // Si riempiono i portieri di entrambe le squadre.
  for (let giro = 0; giro < 2; giro++) {
    const a = (await sql(`select nomination_order, current_turn_index from public.auctions where id = '${s.asta.id}';`))[0]
    const chi = s.utenteDi(a.nomination_order[a.current_turn_index])
    const nome = giro === 0 ? 'Aportiere' : 'Bportiere'
    const l = await rpc(chi, 'chiama_calciatore', { p_lega: s.lega, p_player_id: idDi(nome), p_importo: 1 })
    await scadi(l.riga.lotto)
    await rpc(chi, 'chiudi_lotto_se_scaduto', { p_lotto: l.riga.lotto })
  }

  const dopo = (await sql(`select current_role_phase from public.auctions where id = '${s.asta.id}';`))[0]
  esito(
    'Completati i portieri, il reparto avanza da solo ai difensori',
    dopo.current_role_phase === 'D',
    `reparto aperto ora: ${dopo.current_role_phase}`,
  )
}

// Ibrida: prima i portieri, poi tutto libero.
{
  const s = await scenario('Ibrida', { metodo: 'chiamata', variante: 'ibrida' })
  esito(
    'Ibrida: si parte comunque dai portieri',
    s.asta.current_role_phase === 'P',
    `reparto aperto: ${s.asta.current_role_phase}`,
  )

  for (let giro = 0; giro < 2; giro++) {
    const a = (await sql(`select nomination_order, current_turn_index from public.auctions where id = '${s.asta.id}';`))[0]
    const chi = s.utenteDi(a.nomination_order[a.current_turn_index])
    const l = await rpc(chi, 'chiama_calciatore', {
      p_lega: s.lega, p_player_id: idDi(giro === 0 ? 'Aportiere' : 'Bportiere'), p_importo: 1,
    })
    await scadi(l.riga.lotto)
    await rpc(chi, 'chiudi_lotto_se_scaduto', { p_lotto: l.riga.lotto })
  }

  const dopo = (await sql(`select current_role_phase from public.auctions where id = '${s.asta.id}';`))[0]
  const a = (await sql(`select nomination_order, current_turn_index from public.auctions where id = '${s.asta.id}';`))[0]
  const chi = s.utenteDi(a.nomination_order[a.current_turn_index])
  const libero = await rpc(chi, 'chiama_calciatore', {
    p_lega: s.lega, p_player_id: idDi('Aattacco'), p_importo: 1,
  })
  esito(
    'Ibrida: finiti i portieri si chiama chiunque',
    dopo.current_role_phase === null && libero.riga?.esito === 'ok',
    `reparto ora: ${dopo.current_role_phase ?? 'nessuno, tutto libero'}; chiamata di un attaccante: ${libero.riga?.esito}`,
  )
}

// Alfabetico: apre il server, in ordine.
{
  const s = await scenario('Alfabetico', { metodo: 'alfabetico', variante: 'totale' })

  const nonSiChiama = await rpc(amico, 'chiama_calciatore', {
    p_lega: s.lega, p_player_id: idDi('Aattacco'), p_importo: 1,
  })
  esito(
    'Nei metodi automatici i partecipanti non chiamano',
    nonSiChiama.riga?.esito === 'metodo_non_disponibile',
    `${nonSiChiama.riga?.messaggio}`,
  )

  const primo = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  const nomePrimo = (await sql(`select p.name from public.auction_lots l join public.players p on p.id = l.player_id
                                where l.id = '${primo.riga.lotto}';`))[0].name
  esito(
    'Alfabetico totale: il server apre il primo in ordine alfabetico',
    nomePrimo === 'Aattacco',
    `primo lotto: ${nomePrimo} (atteso Aattacco)`,
  )

  const senzaOfferte = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  esito(
    'Non si aprono due lotti insieme',
    senzaOfferte.riga?.esito === 'lotto_chiuso',
    `${senzaOfferte.riga?.messaggio}`,
  )

  // Nessuno offre: allo scadere il calciatore viene passato.
  await scadi(primo.riga.lotto)
  const passato = await rpc(admin, 'chiudi_lotto_se_scaduto', { p_lotto: primo.riga.lotto })
  const stato = (await sql(`select status from public.auction_lots where id = '${primo.riga.lotto}';`))[0].status
  esito(
    'Un lotto senza offerte viene passato, non aggiudicato',
    passato.riga?.esito === 'ok' && stato === 'passed' && passato.riga?.squadra === null,
    `${passato.riga?.messaggio} · stato del lotto: ${stato}`,
  )

  const secondo = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  const nomeSecondo = (await sql(`select p.name from public.auction_lots l join public.players p on p.id = l.player_id
                                  where l.id = '${secondo.riga.lotto}';`))[0].name
  esito(
    'Chi è stato passato non viene riproposto',
    nomeSecondo === 'Acentrocampo',
    `secondo lotto: ${nomeSecondo} (atteso Acentrocampo, non Aattacco)`,
  )

  // La prima offerta su un lotto aperto dal server vale come apertura.
  const primaOfferta = await rpc(amico, 'rilancia', { p_lotto: secondo.riga.lotto, p_importo: 4 })
  esito(
    'Sul lotto aperto dal server la prima offerta vale come apertura',
    primaOfferta.riga?.esito === 'ok' && primaOfferta.riga?.offerta === 4,
    `offerta accettata a ${primaOfferta.riga?.offerta}`,
  )
}

// Alfabetico per ruolo.
{
  const s = await scenario('AlfaRuolo', { metodo: 'alfabetico', variante: 'per_ruolo' })
  const primo = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  const nome = (await sql(`select p.name from public.auction_lots l join public.players p on p.id = l.player_id
                           where l.id = '${primo.riga.lotto}';`))[0].name
  esito(
    'Alfabetico per ruolo: comincia dai portieri, in ordine',
    nome === 'Aportiere',
    `primo lotto: ${nome} (atteso Aportiere)`,
  )
}

// Random, con e senza filtro del bacino.
{
  const s = await scenario('Random', { metodo: 'random', variante: 'totale' })
  const nomi = new Set()
  for (let i = 0; i < 4; i++) {
    const l = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
    if (l.riga?.esito !== 'ok') break
    nomi.add((await sql(`select p.name from public.auction_lots l join public.players p on p.id = l.player_id
                         where l.id = '${l.riga.lotto}';`))[0].name)
    await scadi(l.riga.lotto)
    await rpc(admin, 'chiudi_lotto_se_scaduto', { p_lotto: l.riga.lotto })
  }
  esito(
    'Random: il server estrae calciatori diversi',
    nomi.size === 4,
    `estratti: ${[...nomi].join(', ')}`,
  )

  const f = await scenario('RandomFiltro', {
    metodo: 'random', variante: 'totale', filtro: { quotazione_minima: 25 },
  })
  const l = await rpc(admin, 'apri_prossimo_lotto', { p_lega: f.lega })
  const q = (await sql(`select p.name, p.quotation from public.auction_lots l
                        join public.players p on p.id = l.player_id where l.id = '${l.riga.lotto}';`))[0]
  esito(
    'Random con filtro: estrae solo sopra la quotazione minima',
    q.quotation >= 25,
    `estratto ${q.name}, quotazione ${q.quotation} (soglia 25)`,
  )
}

// Modalità live: il timer non chiude niente, chiude l'amministratore.
{
  const s = await scenario('Live', { metodo: 'chiamata', variante: 'totale', conduzione: 'live' })
  const diTurno = s.utenteDi(s.asta.nomination_order[s.asta.current_turn_index])
  const l = await rpc(diTurno, 'chiama_calciatore', {
    p_lega: s.lega, p_player_id: idDi('Aportiere'), p_importo: 5,
  })
  await scadi(l.riga.lotto)
  const timerSpento = await rpc(diTurno, 'chiudi_lotto_se_scaduto', { p_lotto: l.riga.lotto })
  esito(
    'In modalità live il timer non aggiudica niente',
    timerSpento.riga?.esito === 'non_ancora_scaduto',
    `${timerSpento.riga?.messaggio}`,
  )

  const daNonAdmin = await rpc(amico, 'aggiudica_ora', { p_lotto: l.riga.lotto })
  const chiude = await rpc(admin, 'aggiudica_ora', { p_lotto: l.riga.lotto })
  esito(
    'In modalità live aggiudica solo l amministratore',
    daNonAdmin.riga?.esito === 'non_autorizzato' && chiude.riga?.esito === 'ok',
    `partecipante: ${daNonAdmin.riga?.messaggio} · amministratore: ${chiude.riga?.messaggio}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 4e · La chiamata con passo
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n── 4e · la chiamata con passo ─────────────────────────────────\n')

{
  const libera = await scenario('SenzaPasso', { metodo: 'chiamata', variante: 'totale' })
  const chi = libera.utenteDi(libera.asta.nomination_order[libera.asta.current_turn_index])
  const l = await rpc(chi, 'chiama_calciatore', { p_lega: libera.lega, p_player_id: idDi('Aportiere'), p_importo: 1 })
  const nonSiPassa = await rpc(amico, 'passa', { p_lotto: l.riga.lotto })
  esito(
    'Nella chiamata libera non si può passare',
    nonSiPassa.riga?.esito === 'metodo_non_disponibile',
    `${nonSiPassa.riga?.messaggio}`,
  )
}

{
  const s = await scenario('ConPasso', { metodo: 'chiamata', variante: 'totale', tipo: 'con_passo' }, { tre: true })
  const a = (await sql(`select nomination_order, current_turn_index from public.auctions where id = '${s.asta.id}';`))[0]
  const chiamante = s.utenteDi(a.nomination_order[a.current_turn_index])
  const altri = [admin, amico, terzo].filter((u) => u.id !== chiamante.id)

  const l = await rpc(chiamante, 'chiama_calciatore', {
    p_lega: s.lega, p_player_id: idDi('Aportiere'), p_importo: 3,
  })

  const passo = await rpc(altri[0], 'passa', { p_lotto: l.riga.lotto })
  const dopoIlPasso = await rpc(altri[0], 'rilancia', { p_lotto: l.riga.lotto, p_importo: 9 })
  esito(
    'Chi passa non può più rilanciare su quel calciatore',
    passo.riga?.esito === 'ok' && passo.riga?.chiuso === false && dopoIlPasso.riga?.esito === 'hai_passato',
    `${passo.riga?.messaggio} · poi il rilancio: ${dopoIlPasso.riga?.messaggio}`,
  )

  const ultimo = await rpc(altri[1], 'passa', { p_lotto: l.riga.lotto })
  const stato = (await sql(`select l.status, t.name from public.auction_lots l
    left join public.teams t on t.id = l.awarded_team_id where l.id = '${l.riga.lotto}';`))[0]
  esito(
    'Quando passano tutti tranne uno il lotto si chiude subito, senza aspettare il timer',
    ultimo.riga?.chiuso === true && stato.status === 'awarded',
    `${ultimo.riga?.messaggio} · aggiudicato a ${stato.name}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 4d · I poteri dell'amministratore
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n── 4d · i poteri dell'amministratore ──────────────────────────\n")

{
  const s = await scenario('Poteri', { metodo: 'alfabetico', variante: 'totale' })
  const squadraAmico = s.squadre.find((q) => q.user_id === amico.id).id

  const l = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })

  const passaNonAdmin = await rpc(amico, 'passa_lotto', { p_lotto: l.riga.lotto })
  esito(
    'Un partecipante non può passare un calciatore',
    passaNonAdmin.riga?.esito === 'non_autorizzato',
    `${passaNonAdmin.riga?.messaggio}`,
  )

  const passa = await rpc(admin, 'passa_lotto', { p_lotto: l.riga.lotto })
  esito(
    "L'amministratore passa un calciatore che non vuole nessuno",
    passa.riga?.esito === 'ok',
    `${passa.riga?.messaggio}`,
  )

  const l2 = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  await rpc(amico, 'rilancia', { p_lotto: l2.riga.lotto, p_importo: 5 })
  const passaConOfferta = await rpc(admin, 'passa_lotto', { p_lotto: l2.riga.lotto })
  esito(
    "Non si passa un calciatore su cui c'è già un'offerta",
    passaConOfferta.riga?.esito === 'lotto_chiuso',
    `${passaConOfferta.riga?.messaggio}`,
  )
  await rpc(admin, 'aggiudica_ora', { p_lotto: l2.riga.lotto })

  // Assegnazione rapida.
  const troppo = await rpc(admin, 'assegna_rapido', {
    p_lega: s.lega, p_player_id: idDi('Bportiere'), p_squadra: squadraAmico, p_prezzo: 9999,
  })
  esito(
    "Nemmeno l'amministratore può sforare il massimo offribile di una squadra",
    troppo.riga?.esito === 'oltre_il_massimo',
    `${troppo.riga?.messaggio}`,
  )

  const creditiPrima = (await sql(`select credits_remaining from public.teams where id = '${squadraAmico}';`))[0].credits_remaining
  const assegna = await rpc(admin, 'assegna_rapido', {
    p_lega: s.lega, p_player_id: idDi('Bportiere'), p_squadra: squadraAmico, p_prezzo: 7,
  })
  const dopoAssegna = (await sql(`select t.credits_remaining,
    (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa
    from public.teams t where t.id = '${squadraAmico}';`))[0]
  esito(
    "L'amministratore assegna un calciatore senza fare l'asta",
    assegna.riga?.esito === 'ok' && dopoAssegna.credits_remaining === creditiPrima - 7,
    `crediti da ${creditiPrima} a ${dopoAssegna.credits_remaining}, calciatori in rosa ${dopoAssegna.rosa}`,
  )

  const fonte = (await sql(`select source from public.roster_players
    where league_id = '${s.lega}' and player_id = ${idDi('Bportiere')};`))[0].source
  esito(
    "L'assegnazione rapida resta tracciata come tale",
    fonte === 'quick_assign',
    `fonte dell'acquisto registrata: ${fonte}`,
  )

  // Annullamento dell'ultima aggiudicazione.
  const annullaNonAdmin = await rpc(amico, 'annulla_ultima_aggiudicazione', { p_lega: s.lega })
  const primaDellAnnullo = (await sql(`select credits_remaining from public.teams where id = '${squadraAmico}';`))[0].credits_remaining
  const annulla = await rpc(admin, 'annulla_ultima_aggiudicazione', { p_lega: s.lega })
  const dopoAnnullo = (await sql(`select t.credits_remaining,
    (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa
    from public.teams t where t.id = '${squadraAmico}';`))[0]
  esito(
    "Solo l'amministratore annulla, e i crediti tornano indietro",
    annullaNonAdmin.riga?.esito === 'non_autorizzato' &&
      annulla.riga?.esito === 'ok' &&
      dopoAnnullo.credits_remaining === primaDellAnnullo + 7,
    `partecipante respinto; crediti da ${primaDellAnnullo} a ${dopoAnnullo.credits_remaining}, rosa ora ${dopoAnnullo.rosa}`,
  )

  const tornaLibero = (await sql(`select count(*)::int n from public.roster_players
    where league_id = '${s.lega}' and player_id = ${idDi('Bportiere')};`))[0].n
  esito(
    'Il calciatore annullato torna disponibile',
    tornaLibero === 0,
    `righe di rosa che lo contengono: ${tornaLibero}`,
  )

  const registro = await sql(`select type from public.auction_events
    where auction_id = '${s.asta.id}' order by seq;`)
  esito(
    'Il registro conserva sia aggiudicazione sia annullamento',
    registro.some((r) => r.type === 'aggiudicazione') && registro.some((r) => r.type === 'annullamento'),
    `eventi registrati: ${registro.map((r) => r.type).join(', ')}`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// La rete di sicurezza
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n── la rete di sicurezza ───────────────────────────────────────\n')

{
  const s = await scenario('Rete', { metodo: 'chiamata', variante: 'totale' })
  const chi = s.utenteDi(s.asta.nomination_order[s.asta.current_turn_index])
  const l = await rpc(chi, 'chiama_calciatore', { p_lega: s.lega, p_player_id: idDi('Aportiere'), p_importo: 4 })
  await scadi(l.riga.lotto)

  const daClient = await rpc(amico, 'chiudi_lotti_scaduti', {})
  esito(
    'La rete di sicurezza non è richiamabile dal client',
    daClient.stato >= 400,
    `HTTP ${daClient.stato}: ${JSON.stringify(daClient.riga)?.slice(0, 90)}`,
  )

  const quanti = (await sql('select public.chiudi_lotti_scaduti() as n;'))[0].n
  const stato = (await sql(`select status, final_price from public.auction_lots where id = '${l.riga.lotto}';`))[0]
  esito(
    'La rete di sicurezza chiude i lotti che nessuno ha segnalato',
    quanti >= 1 && stato.status === 'awarded' && stato.final_price === 4,
    `lotti chiusi in questo passaggio: ${quanti}; il nostro è ${stato.status} a ${stato.final_price}`,
  )

  await reteAttiva(true)
  const pianificato = await sql("select jobname, schedule, active from cron.job where jobname = 'fantasta-lotti-scaduti';")
  esito(
    'La rete di sicurezza è pianificata e attiva',
    pianificato.length === 1 && pianificato[0].active === true,
    `compito "${pianificato[0]?.jobname}" ogni ${pianificato[0]?.schedule}`,
  )
}

// ─── Riepilogo ──────────────────────────────────────────────────────────────

await reteAttiva(true)

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-asta-completa.mjs --pulisci')
