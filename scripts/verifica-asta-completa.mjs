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
const STAGIONE_DI_PROVA = 'PROVA-VAR'

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

/** Lettura diretta di una tabella o di una vista, con i permessi di chi chiede. */
async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, { headers: testa(u) })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

/** Scrittura diretta: serve a provare che certe cose il client non le puo' fare. */
async function scrivi(u, percorso, metodo, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    method: metodo,
    headers: { ...testa(u), Prefer: 'return=representation' },
    body: JSON.stringify(corpo),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

// ─── Listone di prova, con nomi che si ordinano in modo prevedibile ─────────

const admin = await registra('admin')
const amico = await registra('amico')
const terzo = await registra('terzo')
await sql(`insert into public.app_admins (user_id) values ('${admin.id}') on conflict do nothing;`)

const CALCIATORI = []
let id = 908200
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
await rpc(admin, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })
const idDi = (nome) => CALCIATORI.find((c) => c.nome === nome).id

/** Il calciatore in asta adesso, con il suo lotto. Null se non c'e' nessuno. */
async function inAsta(lega) {
  return (await sql(`select l.id, p.name, p.role, p.quotation
    from public.auction_lots l
    join public.auctions a on a.id = l.auction_id
    join public.players p on p.id = l.player_id
    where a.league_id = '${lega}' and l.status = 'open';`))[0] ?? null
}

/** Costruisce una lega pronta con l'asta configurata e aperta. */
async function scenario(nome, impostazioni, opzioni = {}) {
  const slot = opzioni.slot ?? { P: 1, D: 1, C: 1, A: 1 }
  const lega = (await rpc(admin, 'crea_lega', {
    p_nome: nome,
    p_stagione: STAGIONE_DI_PROVA,
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

  // Il pezzo nuovo: nessuno ha premuto niente, e il prossimo e' gia' in asta.
  const secondo = await inAsta(s.lega)
  esito(
    'Chiuso un lotto, il successivo si apre da solo',
    secondo !== null && secondo.name === 'Acentrocampo',
    `in asta adesso: ${secondo?.name ?? 'nessuno'} (atteso Acentrocampo, non Aattacco che era stato passato)`,
  )

  // La prima offerta su un lotto aperto dal server vale come apertura.
  const primaOfferta = await rpc(amico, 'rilancia', { p_lotto: secondo.id, p_importo: 4 })
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
  // Solo la prima estrazione si chiede: da lì in poi la catena va da sola.
  await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  const nomi = new Set()
  for (let i = 0; i < 4; i++) {
    const l = await inAsta(s.lega)
    if (!l) break
    nomi.add(l.name)
    await scadi(l.id)
    await rpc(admin, 'chiudi_lotto_se_scaduto', { p_lotto: l.id })
  }
  esito(
    'Random: una sola estrazione chiesta, e la catena va avanti da sola',
    nomi.size === 4,
    `estratti di fila senza premere altro: ${[...nomi].join(', ')}`,
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

  // Anche dopo un «non lo vuole nessuno» il prossimo e' gia' li'.
  const l2 = await inAsta(s.lega)
  esito(
    'Dopo un passaggio il successivo si apre da solo',
    l2 !== null,
    `in asta adesso: ${l2?.name ?? 'nessuno'}`,
  )

  await rpc(amico, 'rilancia', { p_lotto: l2.id, p_importo: 5 })
  const passaConOfferta = await rpc(admin, 'passa_lotto', { p_lotto: l2.id })
  esito(
    "Non si passa un calciatore su cui c'è già un'offerta",
    passaConOfferta.riga?.esito === 'lotto_chiuso',
    `${passaConOfferta.riga?.messaggio}`,
  )
  await rpc(admin, 'aggiudica_ora', { p_lotto: l2.id })

  // ─── Come si ferma la catena ──────────────────────────────────────────────
  // Da quando i lotti si aprono da soli, in un'asta automatica c'e' sempre
  // qualcuno in asta: e l'assegnazione rapida, giustamente, rifiuta di
  // assegnare un calciatore mentre la stanza sta rilanciando su un altro.
  // La via d'uscita e' la pausa: ferma la catena, e il lotto in corso lo si
  // chiude a mano. Va provata, perche' e' l'unica che c'e'.
  await rpc(admin, 'pausa_asta', { p_lega: s.lega, p_in_pausa: true })
  const daChiudere = await inAsta(s.lega)
  if (daChiudere) await rpc(admin, 'passa_lotto', { p_lotto: daChiudere.id })
  const dopoLaPausa = await inAsta(s.lega)
  esito(
    'In pausa la catena si ferma: chiuso il lotto, non se ne apre un altro',
    dopoLaPausa === null,
    `chiuso "${daChiudere?.name ?? 'nessuno'}", in asta adesso: ${dopoLaPausa?.name ?? 'nessuno'}`,
  )

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

console.log("\n── il riempimento finale ─────────────────────────────────────\n")

// Il listone finisce prima delle rose: quattro attaccanti per sei posti.
// E' la situazione vera di fine serata, quella in cui prima l'asta si
// chiudeva lasciando le squadre incomplete.
{
  const s = await scenario('Riempimento', { metodo: 'alfabetico', variante: 'totale' }, {
    slot: { P: 1, D: 1, C: 1, A: 3 },
  })

  // Nessuno offre niente: la catena scorre da sola e passa tutti.
  await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  let passati = 0
  for (let i = 0; i < 40; i++) {
    const l = await inAsta(s.lega)
    if (!l) break
    await scadi(l.id)
    await rpc(admin, 'chiudi_lotto_se_scaduto', { p_lotto: l.id })
    passati++
  }

  const astaDopo = (await sql(`select status from public.auctions where league_id = '${s.lega}';`))[0]
  const vuoti = (await sql(`select coalesce(sum(slot_rimanenti), 0)::int n
    from public.team_budget where league_id = '${s.lega}';`))[0].n
  esito(
    'Finito il listone con le rose incomplete, l asta NON si chiude',
    astaDopo.status === 'open' && vuoti > 0,
    `${passati} calciatori passati, asta ancora ${astaDopo.status}, slot vuoti ${vuoti}`,
  )

  const finito = await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  esito(
    'E lo dice: il listone e finito, non la partita',
    finito.riga?.esito === 'listone_finito',
    `${finito.riga?.esito}: ${finito.riga?.messaggio}`,
  )

  // Il pezzo nuovo: si ripesca per nome chi era stato passato.
  const nonAdmin = await rpc(amico, 'apri_lotto_scelto', {
    p_lega: s.lega, p_player_id: idDi('Aattacco'),
  })
  esito(
    'Mette all asta un nome scelto solo l amministratore',
    nonAdmin.riga?.esito === 'non_autorizzato',
    `${nonAdmin.riga?.messaggio}`,
  )

  const ripescato = await rpc(admin, 'apri_lotto_scelto', {
    p_lega: s.lega, p_player_id: idDi('Aattacco'),
  })
  const inAstaOra = await inAsta(s.lega)
  esito(
    'Chi era stato passato si puo rimettere all asta cercandolo per nome',
    ripescato.riga?.esito === 'ok' && inAstaOra?.name === 'Aattacco',
    `${ripescato.riga?.messaggio} · in asta: ${inAstaOra?.name}`,
  )

  const doppio = await rpc(admin, 'apri_lotto_scelto', {
    p_lega: s.lega, p_player_id: idDi('Battacco'),
  })
  esito(
    'Non se ne aprono due insieme nemmeno cosi',
    doppio.riga?.esito === 'lotto_chiuso',
    `${doppio.riga?.messaggio}`,
  )

  // Lo si compra davvero, e da comprato non si ripesca piu'.
  const squadraAmico = s.squadre.find((q) => q.user_id === amico.id).id
  await rpc(amico, 'rilancia', { p_lotto: inAstaOra.id, p_importo: 3 })
  await rpc(admin, 'aggiudica_ora', { p_lotto: inAstaOra.id })

  const giaPreso = await rpc(admin, 'apri_lotto_scelto', {
    p_lega: s.lega, p_player_id: idDi('Aattacco'),
  })
  esito(
    'Un calciatore gia comprato non torna all asta',
    giaPreso.riga?.esito === 'gia_acquistato',
    `${giaPreso.riga?.messaggio}`,
  )

  const inRosa = (await sql(`select price from public.roster_players
    where league_id = '${s.lega}' and team_id = '${squadraAmico}'
      and player_id = ${idDi('Aattacco')};`))[0]
  esito(
    'Il ripescato finisce in rosa al prezzo battuto',
    inRosa?.price === 3,
    `comprato a ${inRosa?.price}`,
  )

  // Chiusura a mano: prima non esisteva, perche' l'asta si chiudeva da sola.
  const chiusuraNonAdmin = await rpc(amico, 'chiudi_asta', { p_lega: s.lega })
  const chiusura = await rpc(admin, 'chiudi_asta', { p_lega: s.lega })
  const finale = (await sql(`select a.status, l.status lega from public.auctions a
    join public.leagues l on l.id = a.league_id where a.league_id = '${s.lega}';`))[0]
  esito(
    'L amministratore chiude l asta a mano, e il messaggio dice cosa resta scoperto',
    chiusuraNonAdmin.riga?.esito === 'non_autorizzato' &&
      chiusura.riga?.esito === 'ok' &&
      finale.status === 'closed' && finale.lega === 'done',
    `${chiusura.riga?.messaggio} · asta ${finale.status}, lega ${finale.lega}`,
  )

  const dopoChiusa = await rpc(admin, 'apri_lotto_scelto', {
    p_lega: s.lega, p_player_id: idDi('Battacco'),
  })
  esito(
    'A asta chiusa non si apre piu niente',
    dopoChiusa.riga?.esito === 'asta_non_aperta',
    `${dopoChiusa.riga?.messaggio}`,
  )
}

console.log("\n── le correzioni, e il registro che le mostra ─────────────────\n")

// Un asta di tre ore ha sempre qualcosa da sistemare. Il punto non e che
// l'amministratore possa correggere: e che ogni correzione si veda, con il
// motivo, e la vedano tutti. Qui si prova esattamente quello.
{
  const s = await scenario('Correzioni', { metodo: 'alfabetico', variante: 'totale' })
  const squadraAmico = s.squadre.find((q) => q.user_id === amico.id).id

  // Si compra un calciatore, per avere qualcosa da correggere.
  await rpc(admin, 'apri_prossimo_lotto', { p_lega: s.lega })
  const lotto = await inAsta(s.lega)
  await rpc(amico, 'rilancia', { p_lotto: lotto.id, p_importo: 6 })
  await rpc(admin, 'aggiudica_ora', { p_lotto: lotto.id })

  const comprato = (await sql(`select p.id, p.name from public.roster_players r
    join public.players p on p.id = r.player_id
    where r.league_id = '${s.lega}' and r.team_id = '${squadraAmico}';`))[0]
  esito(
    'Preparazione: un calciatore in rosa da correggere',
    Boolean(comprato),
    `${comprato?.name} comprato a 6`,
  )

  // ─── Il motivo non e facoltativo ─────────────────────────────────────────

  const senzaMotivo = await rpc(admin, 'rimuovi_dalla_rosa', {
    p_lega: s.lega, p_player_id: comprato.id, p_motivo: '',
  })
  esito(
    'Senza motivo non si corregge niente',
    senzaMotivo.riga?.esito === 'non_autorizzato',
    `${senzaMotivo.riga?.messaggio}`,
  )

  const daPartecipante = await rpc(amico, 'rimuovi_dalla_rosa', {
    p_lega: s.lega, p_player_id: comprato.id, p_motivo: 'me lo tolgo da solo',
  })
  esito(
    'Un partecipante non tocca le rose, nemmeno la sua',
    daPartecipante.riga?.esito === 'non_autorizzato',
    `${daPartecipante.riga?.messaggio}`,
  )

  // ─── La correzione del prezzo ────────────────────────────────────────────

  const primaDelPrezzo = (await sql(`select credits_remaining from public.teams
    where id = '${squadraAmico}';`))[0].credits_remaining
  const correzione = await rpc(admin, 'correggi_prezzo', {
    p_lega: s.lega, p_player_id: comprato.id, p_prezzo: 9,
    p_motivo: 'avevo battuto 6 invece di 9',
  })
  const dopoIlPrezzo = (await sql(`select t.credits_remaining,
    (select price from public.roster_players r
     where r.team_id = t.id and r.player_id = ${comprato.id}) prezzo
    from public.teams t where t.id = '${squadraAmico}';`))[0]
  esito(
    'Il prezzo si corregge, e i crediti seguono la differenza',
    correzione.riga?.esito === 'ok' &&
      dopoIlPrezzo.prezzo === 9 &&
      dopoIlPrezzo.credits_remaining === primaDelPrezzo - 3,
    `${correzione.riga?.messaggio} · crediti da ${primaDelPrezzo} a ${dopoIlPrezzo.credits_remaining}`,
  )

  const troppo = await rpc(admin, 'correggi_prezzo', {
    p_lega: s.lega, p_player_id: comprato.id, p_prezzo: 100000,
    p_motivo: 'proviamo a sfondare il budget',
  })
  const restato = (await sql(`select price from public.roster_players
    where league_id = '${s.lega}' and player_id = ${comprato.id};`))[0].price
  esito(
    'Nemmeno correggendo si porta una squadra sotto quello che le serve',
    troppo.riga?.esito === 'oltre_il_massimo' && restato === 9,
    `${troppo.riga?.messaggio} · prezzo ancora ${restato}`,
  )

  // ─── La rimozione ────────────────────────────────────────────────────────

  const primaDellaRimozione = (await sql(`select credits_remaining from public.teams
    where id = '${squadraAmico}';`))[0].credits_remaining
  const rimozione = await rpc(admin, 'rimuovi_dalla_rosa', {
    p_lega: s.lega, p_player_id: comprato.id,
    p_motivo: 'aggiudicato a chi non aveva rilanciato',
  })
  const dopoLaRimozione = (await sql(`select t.credits_remaining,
    (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa
    from public.teams t where t.id = '${squadraAmico}';`))[0]
  esito(
    'Il calciatore esce dalla rosa e i crediti tornano indietro',
    rimozione.riga?.esito === 'ok' &&
      dopoLaRimozione.rosa === 0 &&
      dopoLaRimozione.credits_remaining === primaDellaRimozione + 9,
    `${rimozione.riga?.messaggio} · crediti da ${primaDellaRimozione} a ${dopoLaRimozione.credits_remaining}`,
  )

  // La parte che si dimentica: il lotto va annullato, altrimenti quel
  // calciatore non tornerebbe mai piu fra gli estraibili.
  const statoLotto = (await sql(`select status from public.auction_lots
    where id = '${lotto.id}';`))[0].status
  esito(
    'Il calciatore tolto torna disponibile per l asta',
    statoLotto === 'cancelled',
    `il lotto che lo aveva assegnato ora è ${statoLotto}`,
  )

  // ─── Il registro ─────────────────────────────────────────────────────────

  const registro = await leggi(
    amico,
    `registro_asta?select=type,manuale,motivo,attore,calciatore,squadra,payload&league_id=eq.${s.lega}&order=seq`,
  )
  const manuali = (registro.corpo ?? []).filter((r) => r.manuale)
  const laRimozione = manuali.find((r) => r.type === 'rimozione')
  const laCorrezione = manuali.find((r) => r.type === 'correzione_prezzo')
  esito(
    'Il registro lo legge un partecipante, non solo chi lo ha scritto',
    registro.stato === 200 && manuali.length >= 2,
    `${registro.corpo?.length ?? 0} eventi, di cui ${manuali.length} interventi manuali`,
  )

  esito(
    'Ogni intervento porta con se il motivo, il nome e chi lo ha fatto',
    laRimozione?.motivo === 'aggiudicato a chi non aveva rilanciato' &&
      laCorrezione?.motivo === 'avevo battuto 6 invece di 9' &&
      Boolean(laRimozione?.calciatore) && Boolean(laRimozione?.squadra) &&
      Boolean(laRimozione?.attore),
    `rimozione: "${laRimozione?.motivo}" su ${laRimozione?.calciatore} (${laRimozione?.squadra}), da ${laRimozione?.attore}`,
  )

  esito(
    'La correzione conserva il prezzo di prima e quello di dopo',
    laCorrezione?.payload?.prezzo_prima === 6 && laCorrezione?.payload?.prezzo === 9,
    `da ${laCorrezione?.payload?.prezzo_prima} a ${laCorrezione?.payload?.prezzo}`,
  )

  // Il gioco normale non deve finire fra gli interventi: se ci finisse, il
  // registro annegherebbe le correzioni nel rumore e non servirebbe piu'.
  const rilanci = (registro.corpo ?? []).filter((r) => r.type === 'rilancio')
  esito(
    'Il gioco normale non e un intervento manuale',
    rilanci.length > 0 && rilanci.every((r) => r.manuale === false),
    `${rilanci.length} rilanci nel registro, nessuno segnato come manuale`,
  )

  // ─── Il registro non si riscrive ─────────────────────────────────────────

  const seq = (await sql(`select e.seq from public.auction_events e
    join public.auctions a on a.id = e.auction_id
    where a.league_id = '${s.lega}' and e.type = 'rimozione';`))[0].seq
  const riscrittura = await scrivi(admin, `auction_events?seq=eq.${seq}`, 'PATCH', {
    payload: { motivo_admin: 'in realtà avevo ragione io' },
  })
  const cancellazione = await scrivi(admin, `auction_events?seq=eq.${seq}`, 'DELETE', {})
  const ancoraLi = (await sql(`select payload ->> 'motivo_admin' m
    from public.auction_events where seq = ${seq};`))[0]
  esito(
    'Nemmeno l amministratore riscrive o cancella il registro',
    ancoraLi?.m === 'aggiudicato a chi non aveva rilanciato',
    `PATCH ${riscrittura.stato}, DELETE ${cancellazione.stato}, il motivo è ancora "${ancoraLi?.m}"`,
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
