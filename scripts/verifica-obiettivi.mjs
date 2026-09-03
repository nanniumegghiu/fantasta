// ═══════════════════════════════════════════════════════════════════════════
// Verifica della Fetta 3: la lista obiettivi.
//
// La prova che conta più di tutte: un compagno di lega, e in particolare
// **l'amministratore**, non deve poter leggere gli obiettivi di un altro.
// Se questa fallisce, il gioco è finito prima di cominciare.
//
// Uso:  node scripts/verifica-obiettivi.mjs [--pulisci]
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
const STAGIONE_DI_PROVA = 'PROVA-OBIET'

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

function testa(u, extra = {}) {
  return {
    apikey: CHIAVE,
    ...(u ? { Authorization: `Bearer ${u.token}` } : {}),
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rpc(u, funzione, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: testa(u),
    body: JSON.stringify(corpo ?? {}),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, { headers: testa(u) })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

async function scrivi(u, percorso, metodo, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    method: metodo,
    headers: testa(u, { Prefer: 'return=representation' }),
    body: JSON.stringify(corpo),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

// ─── Preparazione: una lega, un listone, tre persone ────────────────────────

console.log('Preparo una lega con amministratore, amico ed estraneo.\n')
const admin = await registra('admin')
const amico = await registra('amico')
const estraneo = await registra('estraneo')

await sql(`insert into public.app_admins (user_id) values ('${admin.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 909001, nome: 'Lautaro Martinez', ruolo: 'A', squadra: 'Inter', quotazione: 35 },
  { id: 909002, nome: 'Kean', ruolo: 'A', squadra: 'Fiorentina', quotazione: 28 },
  { id: 909003, nome: 'Di Gregorio', ruolo: 'P', squadra: 'Juventus', quotazione: 15 },
  { id: 909004, nome: 'Falcone', ruolo: 'P', squadra: 'Lecce', quotazione: 9 },
  { id: 909005, nome: 'Montipo', ruolo: 'P', squadra: 'Hellas Verona', quotazione: 8 },
  { id: 909006, nome: 'Bastoni', ruolo: 'D', squadra: 'Inter', quotazione: 18 },
]
await rpc(admin, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (await rpc(admin, 'crea_lega', {
  p_nome: 'Lega Obiettivi',
  p_stagione: STAGIONE_DI_PROVA,
  p_nome_squadra: 'Real Madrink',
  p_max_partecipanti: 4,
})).corpo
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
await rpc(amico, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'F.C. Pirlo' })

// ─── 1. La lista nasce alla prima apertura ──────────────────────────────────

const creazione = await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })
const listaAmico = creazione.corpo
esito(
  'La lista nasce alla prima apertura',
  creazione.stato === 200 && typeof listaAmico === 'string',
  `id lista: ${listaAmico}`,
)

const fasce = await leggi(
  amico,
  `tiers?select=id,name,color,position,role&list_id=eq.${listaAmico}&order=role,position`,
)
const perRuolo = new Set((fasce.corpo ?? []).map((f) => f.role))
esito(
  'Nasce con tre fasce di partenza per ognuno dei quattro reparti',
  fasce.corpo?.length === 12 && perRuolo.size === 4,
  `${fasce.corpo?.length} fasce su ${perRuolo.size} reparti: ${[...perRuolo].join(', ')}`,
)

const seconda = await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })
const quanteFasce = (await sql(`select count(*)::int n from public.tiers where list_id = '${listaAmico}';`))[0].n
esito(
  'Riaprirla non crea una seconda lista ne fasce doppie',
  seconda.corpo === listaAmico && quanteFasce === 12,
  `stessa lista, fasce ancora ${quanteFasce}`,
)

const fuoriLega = await rpc(estraneo, 'assicura_lista_obiettivi', { p_lega: lega })
esito(
  'Chi non e nella lega non puo crearsi una lista',
  fuoriLega.stato >= 400,
  `HTTP ${fuoriLega.stato}: ${fuoriLega.corpo?.message ?? ''}`,
)

// ─── 2. I quattro metodi ────────────────────────────────────────────────────

const fasciaAttacco = (fasce.corpo ?? []).find((f) => f.role === 'A' && f.position === 0)
const fasciaDifesa = (fasce.corpo ?? []).find((f) => f.role === 'D' && f.position === 0)
const idFasciaTop = fasciaAttacco?.id ?? null

const obiettivo = await scrivi(amico, 'targets', 'POST', {
  list_id: listaAmico,
  player_id: 909001,
  tier_id: idFasciaTop,
  max_price: 90,
  note: 'Non oltre 90, poi vado su Kean',
})
esito(
  'Metodo delle fasce e del tetto: un obiettivo con fascia, tetto e nota',
  obiettivo.stato === 201 && obiettivo.corpo?.[0]?.max_price === 90,
  `HTTP ${obiettivo.stato}, tetto ${obiettivo.corpo?.[0]?.max_price}, nota "${obiettivo.corpo?.[0]?.note}"`,
)

const altri = await scrivi(amico, 'targets', 'POST', [
  { list_id: listaAmico, player_id: 909002, max_price: 55 },
  { list_id: listaAmico, player_id: 909003, max_price: 25 },
  { list_id: listaAmico, player_id: 909004, max_price: 12 },
  { list_id: listaAmico, player_id: 909005, max_price: 10 },
])
esito(
  'Si aggiungono piu obiettivi in una volta',
  altri.stato === 201 && altri.corpo?.length === 4,
  `aggiunti ${altri.corpo?.length} obiettivi`,
)

const doppio = await scrivi(amico, 'targets', 'POST', {
  list_id: listaAmico,
  player_id: 909001,
})
esito(
  'Lo stesso calciatore non entra due volte nella stessa lista',
  doppio.stato >= 400,
  `HTTP ${doppio.stato}: ${doppio.corpo?.message?.slice(0, 70) ?? ''}`,
)

const inesistente = await scrivi(amico, 'targets', 'POST', {
  list_id: listaAmico,
  player_id: 999999,
})
esito(
  'Non si puo mettere un calciatore che non esiste nel listone',
  inesistente.stato >= 400,
  `HTTP ${inesistente.stato}: ${inesistente.corpo?.message?.slice(0, 70) ?? ''}`,
)

// Slot: ci sono gia', li ha allineati il server sul regolamento della lega.
const idSlot = (await sql(`select id from public.roster_slots
  where list_id = '${listaAmico}' and role = 'A' order by position limit 1;`))[0].id
const idObiettivoLautaro = obiettivo.corpo?.[0]?.id
const candidato = await scrivi(amico, 'slot_candidates', 'POST', {
  slot_id: idSlot,
  target_id: idObiettivoLautaro,
  position: 0,
})
esito(
  'Strategia degli slot: un posto della rosa con il suo candidato',
  candidato.stato === 201,
  `candidato agganciato al primo posto d'attacco`,
)

// Incrocio portieri
const incrocio = await scrivi(amico, 'goalkeeper_pairings', 'POST', {
  list_id: listaAmico,
  name: 'Lecce + Verona',
  note: 'Quando il Lecce gioca in casa, il Verona è fuori: si alternano bene',
})
const idIncrocio = incrocio.corpo?.[0]?.id
const idFalcone = (await leggi(amico, `targets?select=id&list_id=eq.${listaAmico}&player_id=eq.909004`)).corpo[0].id
const idMontipo = (await leggi(amico, `targets?select=id&list_id=eq.${listaAmico}&player_id=eq.909005`)).corpo[0].id
const membri = await scrivi(amico, 'pairing_members', 'POST', [
  { pairing_id: idIncrocio, target_id: idFalcone, position: 0 },
  { pairing_id: idIncrocio, target_id: idMontipo, position: 1 },
])
esito(
  'Incrocio portieri: due portieri e la nota sul calendario',
  incrocio.stato === 201 && membri.corpo?.length === 2,
  `"${incrocio.corpo?.[0]?.name}" con ${membri.corpo?.length} portieri`,
)

// Fasce e slot sono alternativi: la lista ha UN metodo, non due interruttori.
const scelta = await scrivi(amico, `target_lists?id=eq.${listaAmico}`, 'PATCH', {
  metodo: 'slot',
  metodo_confermato: true,
  usa_incroci: true,
})
esito(
  'Il proprietario sceglie un metodo solo, e le aggiunte restano separate',
  scelta.stato === 200 &&
    scelta.corpo?.[0]?.metodo === 'slot' &&
    scelta.corpo?.[0]?.metodo_confermato === true,
  `metodo ${scelta.corpo?.[0]?.metodo}, tetti ${scelta.corpo?.[0]?.usa_tetti}, incroci ${scelta.corpo?.[0]?.usa_incroci}`,
)

const metodoAssurdo = await scrivi(amico, `target_lists?id=eq.${listaAmico}`, 'PATCH', {
  metodo: 'entrambi',
})
esito(
  'Non esiste un metodo che li combini',
  metodoAssurdo.stato >= 400,
  `HTTP ${metodoAssurdo.stato}: ${metodoAssurdo.corpo?.message?.slice(0, 70) ?? ''}`,
)

// ═══════════════════════════════════════════════════════════════════════════
// 3. Le prove che contano: nessun altro deve vedere niente
// ═══════════════════════════════════════════════════════════════════════════

const listaVistaDaAdmin = await leggi(admin, `target_lists?select=id&id=eq.${listaAmico}`)
esito(
  "L'AMMINISTRATORE DI LEGA non vede la lista di un partecipante",
  Array.isArray(listaVistaDaAdmin.corpo) && listaVistaDaAdmin.corpo.length === 0,
  `HTTP ${listaVistaDaAdmin.stato}, righe: ${JSON.stringify(listaVistaDaAdmin.corpo)}`,
)

const obiettiviVistiDaAdmin = await leggi(admin, `targets?select=player_id,max_price,note&list_id=eq.${listaAmico}`)
esito(
  "L'AMMINISTRATORE non vede gli obiettivi, i tetti e le note",
  Array.isArray(obiettiviVistiDaAdmin.corpo) && obiettiviVistiDaAdmin.corpo.length === 0,
  `HTTP ${obiettiviVistiDaAdmin.stato}, righe: ${JSON.stringify(obiettiviVistiDaAdmin.corpo)}`,
)

const tuttiGliObiettivi = await leggi(admin, 'targets?select=player_id,max_price')
esito(
  "L'AMMINISTRATORE non vede nessun obiettivo nemmeno senza filtro",
  Array.isArray(tuttiGliObiettivi.corpo) && tuttiGliObiettivi.corpo.length === 0,
  `HTTP ${tuttiGliObiettivi.stato}, righe restituite: ${tuttiGliObiettivi.corpo?.length}`,
)

const fasceAltrui = await leggi(admin, `tiers?select=name&list_id=eq.${listaAmico}`)
const slotAltrui = await leggi(admin, `roster_slots?select=label&list_id=eq.${listaAmico}`)
const incrociAltrui = await leggi(admin, `goalkeeper_pairings?select=name,note&list_id=eq.${listaAmico}`)
esito(
  "L'AMMINISTRATORE non vede fasce, slot ne incroci",
  fasceAltrui.corpo?.length === 0 && slotAltrui.corpo?.length === 0 && incrociAltrui.corpo?.length === 0,
  `fasce ${fasceAltrui.corpo?.length}, slot ${slotAltrui.corpo?.length}, incroci ${incrociAltrui.corpo?.length}`,
)

const candidatiAltrui = await leggi(admin, 'slot_candidates?select=slot_id')
const membriAltrui = await leggi(admin, 'pairing_members?select=pairing_id')
esito(
  'Nemmeno candidati e membri degli incroci trapelano',
  candidatiAltrui.corpo?.length === 0 && membriAltrui.corpo?.length === 0,
  `candidati ${candidatiAltrui.corpo?.length}, membri ${membriAltrui.corpo?.length}`,
)

const estraneoVede = await leggi(estraneo, 'targets?select=player_id')
esito(
  'Un estraneo alla lega non vede niente',
  Array.isArray(estraneoVede.corpo) && estraneoVede.corpo.length === 0,
  `righe: ${estraneoVede.corpo?.length}`,
)

// ─── Scritture altrui ───────────────────────────────────────────────────────

const scrivaAdmin = await scrivi(admin, 'targets', 'POST', {
  list_id: listaAmico,
  player_id: 909006,
  note: 'intruso',
})
esito(
  "L'amministratore non puo aggiungere obiettivi nella lista di un altro",
  scrivaAdmin.stato >= 400,
  `HTTP ${scrivaAdmin.stato}: ${scrivaAdmin.corpo?.message?.slice(0, 70) ?? ''}`,
)

const modificaAdmin = await scrivi(admin, `targets?id=eq.${idObiettivoLautaro}`, 'PATCH', {
  max_price: 1,
})
const tettoVero = (await sql(`select max_price from public.targets where id = '${idObiettivoLautaro}';`))[0].max_price
esito(
  "L'amministratore non puo modificare il tetto di un altro",
  tettoVero === 90,
  `HTTP ${modificaAdmin.stato}, righe toccate ${JSON.stringify(modificaAdmin.corpo)}, tetto reale ancora ${tettoVero}`,
)

const cancellaAdmin = await scrivi(admin, `targets?id=eq.${idObiettivoLautaro}`, 'DELETE', undefined)
const esisteAncora = (await sql(`select count(*)::int n from public.targets where id = '${idObiettivoLautaro}';`))[0].n
esito(
  "L'amministratore non puo cancellare gli obiettivi di un altro",
  esisteAncora === 1,
  `HTTP ${cancellaAdmin.stato}, l obiettivo esiste ancora: ${esisteAncora === 1}`,
)

// La lista dell'amministratore, per provare l'incrocio fra due liste diverse.
const listaAdmin = (await rpc(admin, 'assicura_lista_obiettivi', { p_lega: lega })).corpo
const suoSlot = (await sql(`select id from public.roster_slots
  where list_id = '${listaAdmin}' and role = 'A' order by position limit 1;`))[0].id
const candidatoIncrociato = await scrivi(admin, 'slot_candidates', 'POST', {
  slot_id: suoSlot,
  target_id: idObiettivoLautaro, // obiettivo dell'amico
})
esito(
  'Non si puo agganciare al proprio slot un obiettivo di un altro',
  candidatoIncrociato.stato >= 400,
  `HTTP ${candidatoIncrociato.stato}: ${candidatoIncrociato.corpo?.message?.slice(0, 70) ?? ''}`,
)

const listaFinta = await scrivi(estraneo, 'target_lists', 'POST', {
  league_id: lega,
  user_id: estraneo.id,
})
esito(
  'Non si puo creare una lista in una lega di cui non si fa parte',
  listaFinta.stato >= 400,
  `HTTP ${listaFinta.stato}: ${listaFinta.corpo?.message?.slice(0, 70) ?? ''}`,
)

const listaPerAltri = await scrivi(amico, 'target_lists', 'POST', {
  league_id: lega,
  user_id: admin.id,
})
esito(
  'Non si puo creare una lista intestata a un altro',
  listaPerAltri.stato >= 400,
  `HTTP ${listaPerAltri.stato}: ${listaPerAltri.corpo?.message?.slice(0, 70) ?? ''}`,
)

// ─── Il proprietario invece vede tutto il suo ───────────────────────────────

const mieiObiettivi = await leggi(
  amico,
  `targets?select=player_id,max_price,note,tiers(name),players(name,role)&list_id=eq.${listaAmico}&order=player_id`,
)
esito(
  'Il proprietario vede i suoi obiettivi con fascia e calciatore uniti',
  mieiObiettivi.corpo?.length === 5 && mieiObiettivi.corpo[0]?.players?.name === 'Lautaro Martinez',
  `${mieiObiettivi.corpo?.length} obiettivi; il primo: ${JSON.stringify(mieiObiettivi.corpo?.[0])?.slice(0, 110)}`,
)

// ═══════════════════════════════════════════════════════════════════════════
// Le aggiunte fatte dal posto giusto, e il riordino
// ═══════════════════════════════════════════════════════════════════════════

// Una fascia appartiene a un reparto: e' quello che permette, durante l'asta,
// di guardare solo i portieri mentre si chiamano i portieri.
const inFasciaGiusta = await rpc(amico, 'aggiungi_a_fascia', {
  p_fascia: fasciaDifesa.id,
  p_calciatori: [909006],
})
const inFasciaSbagliata = await rpc(amico, 'aggiungi_a_fascia', {
  p_fascia: fasciaDifesa.id,
  p_calciatori: [909002],
})
esito(
  'Una fascia di difensori non accoglie un attaccante',
  inFasciaGiusta.corpo === 1 && inFasciaSbagliata.corpo === 0,
  `difensore aggiunto: ${inFasciaGiusta.corpo}, attaccante rifiutato: ${inFasciaSbagliata.corpo === 0}`,
)

const spostoDoveNonSiPuo = await rpc(amico, 'riordina_obiettivi', {
  p_righe: [{ id: obiettivo.corpo[0].id, priorita: 0, fascia: fasciaDifesa.id }],
})
const dovEFinito = (await sql(`select f.role from public.targets t
  join public.tiers f on f.id = t.tier_id where t.id = '${obiettivo.corpo[0].id}';`))[0]
esito(
  'Il riordino non sposta un attaccante in una fascia di difensori',
  spostoDoveNonSiPuo.corpo === 0 && dovEFinito?.role === 'A',
  `righe toccate ${spostoDoveNonSiPuo.corpo}; l attaccante è ancora in una fascia di reparto ${dovEFinito?.role}`,
)

// ─── Gli slot sono quelli del regolamento ───────────────────────────────────
// La regola nuova: la quantita' non la sceglie l'utente, la decide la lega.
// Vale in tutti e due i versi, e va provata violandola.

const regolamento = (await sql(`select slots_p, slots_d, slots_c, slots_a
  from public.leagues where id = '${lega}';`))[0]
const slotCreati = await sql(`select role, label, position from public.roster_slots
  where list_id = '${listaAmico}' order by role, position;`)
const perReparto = { P: 0, D: 0, C: 0, A: 0 }
for (const x of slotCreati) perReparto[x.role]++
const combaciano =
  perReparto.P === regolamento.slots_p && perReparto.D === regolamento.slots_d &&
  perReparto.C === regolamento.slots_c && perReparto.A === regolamento.slots_a
esito(
  'Gli slot ci sono gia alla prima apertura, quanti ne vuole il regolamento',
  combaciano && slotCreati.some((x) => x.label === 'Portiere 1'),
  `regolamento ${regolamento.slots_p}/${regolamento.slots_d}/${regolamento.slots_c}/${regolamento.slots_a}, slot ${perReparto.P}/${perReparto.D}/${perReparto.C}/${perReparto.A}; il primo portiere si chiama "${slotCreati.find((x) => x.role === 'P')?.label}"`,
)

const slotInPiu = await scrivi(amico, 'roster_slots', 'POST', {
  list_id: listaAmico,
  role: 'A',
  label: 'Attaccante di troppo',
  position: 99,
})
const dopoTentativo = (await sql(`select count(*)::int n from public.roster_slots
  where list_id = '${listaAmico}';`))[0].n
esito(
  'Non si puo aggiungere uno slot che il regolamento non prevede',
  slotInPiu.stato >= 400 && dopoTentativo === slotCreati.length,
  `HTTP ${slotInPiu.stato}; slot ancora ${dopoTentativo}`,
)

const unSlot = slotCreati.length > 0
  ? (await sql(`select id, label, position, role from public.roster_slots
      where list_id = '${listaAmico}' and role = 'D' order by position limit 1;`))[0]
  : null
const cancellaSlot = await scrivi(amico, `roster_slots?id=eq.${unSlot.id}`, 'DELETE', {})
const esisteAncoraSlot = (await sql(`select count(*)::int n from public.roster_slots
  where id = '${unSlot.id}';`))[0].n
esito(
  'Non si puo cancellare un posto della rosa',
  esisteAncoraSlot === 1,
  `HTTP ${cancellaSlot.stato}, lo slot "${unSlot.label}" c'è ancora`,
)

const rinomina = await scrivi(amico, `roster_slots?id=eq.${unSlot.id}`, 'PATCH', {
  label: 'Il terzino che salta l uomo',
  max_price: 42,
})
const dopoRinomina = (await sql(`select label, max_price from public.roster_slots
  where id = '${unSlot.id}';`))[0]
esito(
  'Il nome e il massimale dello slot si cambiano',
  dopoRinomina.label === 'Il terzino che salta l uomo' && dopoRinomina.max_price === 42,
  `ora si chiama "${dopoRinomina.label}" con massimale ${dopoRinomina.max_price}`,
)

// Il massimale sta sullo slot **e basta**: il ruolo e la posizione sono del
// regolamento, e il permesso di scrittura non li comprende.
const cambiaRuolo = await scrivi(amico, `roster_slots?id=eq.${unSlot.id}`, 'PATCH', { role: 'A' })
const ruoloDopo = (await sql(`select role from public.roster_slots
  where id = '${unSlot.id}';`))[0].role
esito(
  'Il ruolo di uno slot non si cambia: e un posto della rosa, non una casella libera',
  ruoloDopo === 'D',
  `HTTP ${cambiaRuolo.stato}, il ruolo è ancora ${ruoloDopo}`,
)

// La lega cambia le sue regole: gli slot devono seguirla da soli.
await sql(`update public.leagues set slots_a = slots_a - 1 where id = '${lega}';`)
await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })
const attaccantiDopo = (await sql(`select count(*)::int n from public.roster_slots
  where list_id = '${listaAmico}' and role = 'A';`))[0].n
const posizioniContigue = (await sql(`select array_agg(position order by position) p
  from public.roster_slots where list_id = '${listaAmico}' and role = 'A';`))[0].p
await sql(`update public.leagues set slots_a = slots_a + 1 where id = '${lega}';`)
await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })
const attaccantiRipristinati = (await sql(`select count(*)::int n from public.roster_slots
  where list_id = '${listaAmico}' and role = 'A';`))[0].n
esito(
  'Se la lega cambia i suoi numeri, gli slot la seguono',
  attaccantiDopo === regolamento.slots_a - 1 &&
    attaccantiRipristinati === regolamento.slots_a &&
    JSON.stringify(posizioniContigue.map(Number)) ===
      JSON.stringify([...Array(regolamento.slots_a - 1).keys()]),
  `da ${regolamento.slots_a} a ${attaccantiDopo} e ritorno a ${attaccantiRipristinati}; posizioni ${JSON.stringify(posizioniContigue)}`,
)

const slotAttacco = (await sql(`select id from public.roster_slots
  where list_id = '${listaAmico}' and role = 'A' order by position limit 1;`))[0].id

const dentroSlot = await rpc(amico, 'aggiungi_a_slot', {
  p_slot: slotAttacco,
  p_calciatori: [909001, 909002],
})
const candidati = await sql(`select c.position, p.name from public.slot_candidates c
  join public.targets t on t.id = c.target_id
  join public.players p on p.id = t.player_id
  where c.slot_id = '${slotAttacco}' order by c.position;`)
esito(
  'Aggiungere a uno slot crea l obiettivo e lo aggancia, in un gesto solo',
  dentroSlot.corpo === 2 && candidati.length === 2,
  `candidati in ordine: ${candidati.map((c) => c.name).join(', ')}`,
)

const ruoloSbagliato = await rpc(amico, 'aggiungi_a_slot', {
  p_slot: slotAttacco,
  p_calciatori: [909003],
})
esito(
  'Uno slot di attaccanti non accoglie un portiere',
  ruoloSbagliato.corpo === 0,
  `calciatori aggiunti: ${ruoloSbagliato.corpo}`,
)

const aggiuntaAltrui = await rpc(admin, 'aggiungi_a_slot', {
  p_slot: slotAttacco,
  p_calciatori: [909006],
})
esito(
  'Nessuno aggiunge candidati negli slot di un altro',
  aggiuntaAltrui.corpo === 0,
  `calciatori aggiunti dall amministratore: ${aggiuntaAltrui.corpo}`,
)

// Riordino dei candidati: si rovescia l'ordine e si ricontrolla.
const idCandidati = (await sql(`select target_id from public.slot_candidates
  where slot_id = '${slotAttacco}' order by position;`)).map((c) => c.target_id)
await rpc(amico, 'riordina_candidati', {
  p_slot: slotAttacco,
  p_ordine: [...idCandidati].reverse(),
})
const dopoRiordino = await sql(`select p.name from public.slot_candidates c
  join public.targets t on t.id = c.target_id
  join public.players p on p.id = t.player_id
  where c.slot_id = '${slotAttacco}' order by c.position;`)
esito(
  'I candidati di uno slot si riordinano',
  dopoRiordino[0].name === candidati[1].name,
  `prima "${candidati.map((c) => c.name).join(', ')}", ora "${dopoRiordino.map((c) => c.name).join(', ')}"`,
)

const riordinoAltrui = await rpc(admin, 'riordina_candidati', {
  p_slot: slotAttacco,
  p_ordine: idCandidati,
})
esito(
  'Nessuno riordina gli slot di un altro',
  riordinoAltrui.corpo === 0,
  `righe toccate dall amministratore: ${riordinoAltrui.corpo}`,
)

// ─── Togliere un candidato da un posto ──────────────────────────────────────
// Nel metodo degli slot un obiettivo esiste perche' e' candidato a un posto:
// staccarlo e lasciarlo nella lista produrrebbe un avanzo da togliere due
// volte. Ma se sta anche altrove, deve restare.

const secondoSlotA = (await sql(`select id from public.roster_slots
  where list_id = '${listaAmico}' and role = 'A' order by position offset 1 limit 1;`))[0].id
await rpc(amico, 'aggiungi_a_slot', { p_slot: secondoSlotA, p_calciatori: [909001] })

const kean = (await sql(`select id from public.targets
  where list_id = '${listaAmico}' and player_id = 909002;`))[0].id
await rpc(amico, 'togli_da_slot', { p_slot: slotAttacco, p_obiettivo: kean })
const keanRimasto = (await sql(`select count(*)::int n from public.targets where id = '${kean}';`))[0].n
esito(
  'Togliere da un posto un calciatore che non sta altrove lo toglie dalla lista',
  keanRimasto === 0,
  `Kean era candidato a un posto solo: righe rimaste ${keanRimasto}`,
)

const lautaro = (await sql(`select id from public.targets
  where list_id = '${listaAmico}' and player_id = 909001;`))[0].id
await rpc(amico, 'togli_da_slot', { p_slot: slotAttacco, p_obiettivo: lautaro })
const lautaroRimasto = (await sql(`select count(*)::int n from public.targets where id = '${lautaro}';`))[0].n
const lautaroAltrove = (await sql(`select count(*)::int n from public.slot_candidates
  where target_id = '${lautaro}';`))[0].n
esito(
  'Chi e candidato anche a un altro posto resta nella lista',
  lautaroRimasto === 1 && lautaroAltrove === 1,
  `Lautaro è ancora in lista (${lautaroRimasto}) e candidato a ${lautaroAltrove} posto`,
)

const scollegaAltrui = await rpc(admin, 'togli_da_slot', {
  p_slot: secondoSlotA,
  p_obiettivo: lautaro,
})
const dopoTentativoAltrui = (await sql(`select count(*)::int n from public.slot_candidates
  where target_id = '${lautaro}';`))[0].n
esito(
  'Nessuno stacca i candidati dagli slot di un altro',
  scollegaAltrui.corpo === false && dopoTentativoAltrui === 1,
  `risposta ${JSON.stringify(scollegaAltrui.corpo)}, candidature ancora ${dopoTentativoAltrui}`,
)

// Riordino degli obiettivi per priorità.
const daRiordinare = await sql(`select id from public.targets
  where list_id = '${listaAmico}' order by created_at limit 3;`)
const quante = await rpc(amico, 'riordina_obiettivi', {
  p_righe: daRiordinare.map((r, i) => ({ id: r.id, priorita: daRiordinare.length - i })),
})
const priorita = await sql(`select priority from public.targets
  where id in (${daRiordinare.map((r) => `'${r.id}'`).join(',')}) order by priority;`)
esito(
  'Gli obiettivi si riordinano in una chiamata sola',
  quante.corpo === 3 && priorita[0].priority === 1,
  `righe toccate ${quante.corpo}, priorità ora ${priorita.map((p) => p.priority).join(', ')}`,
)

const riordinoObiettiviAltrui = await rpc(admin, 'riordina_obiettivi', {
  p_righe: daRiordinare.map((r) => ({ id: r.id, priorita: 99 })),
})
const nonToccate = (await sql(`select count(*)::int n from public.targets
  where id in (${daRiordinare.map((r) => `'${r.id}'`).join(',')}) and priority = 99;`))[0].n
esito(
  'Nessuno riordina gli obiettivi di un altro',
  riordinoObiettiviAltrui.corpo === 0 && nonToccate === 0,
  `righe toccate ${riordinoObiettiviAltrui.corpo}, priorità cambiate ${nonToccate}`,
)

// Incroci: solo portieri.
const gruppo = (await sql(`select id from public.goalkeeper_pairings where list_id = '${listaAmico}' limit 1;`))[0].id
const soloPortieri = await rpc(amico, 'aggiungi_a_incrocio', {
  p_incrocio: gruppo,
  p_calciatori: [909003, 909001],
})
esito(
  'In un incrocio entrano solo portieri',
  soloPortieri.corpo === 1,
  `su due calciatori proposti, uno portiere e uno attaccante, ne è entrato ${soloPortieri.corpo}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Nessuna lista è trapelata. Pulisci con: node scripts/verifica-obiettivi.mjs --pulisci')
