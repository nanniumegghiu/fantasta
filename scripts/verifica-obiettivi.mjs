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
await rpc(admin, 'importa_listone', { p_stagione: '2026/27', p_righe: CALCIATORI })

const lega = (await rpc(admin, 'crea_lega', {
  p_nome: 'Lega Obiettivi',
  p_stagione: '2026/27',
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

const fasce = await leggi(amico, `tiers?select=name,color,position&list_id=eq.${listaAmico}&order=position`)
esito(
  'Nasce con tre fasce di partenza, non vuota',
  fasce.corpo?.length === 3 && fasce.corpo[0].name === 'Da prendere assolutamente',
  `fasce: ${fasce.corpo?.map((f) => f.name).join(' · ')}`,
)

const seconda = await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })
const quanteFasce = (await sql(`select count(*)::int n from public.tiers where list_id = '${listaAmico}';`))[0].n
esito(
  'Riaprirla non crea una seconda lista ne fasce doppie',
  seconda.corpo === listaAmico && quanteFasce === 3,
  `stessa lista, fasce ancora ${quanteFasce}`,
)

const fuoriLega = await rpc(estraneo, 'assicura_lista_obiettivi', { p_lega: lega })
esito(
  'Chi non e nella lega non puo crearsi una lista',
  fuoriLega.stato >= 400,
  `HTTP ${fuoriLega.stato}: ${fuoriLega.corpo?.message ?? ''}`,
)

// ─── 2. I quattro metodi ────────────────────────────────────────────────────

const idFasciaTop = fasce.corpo ? (await leggi(amico, `tiers?select=id&list_id=eq.${listaAmico}&position=eq.0`)).corpo[0].id : null

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

// Slot
const slot = await scrivi(amico, 'roster_slots', 'POST', {
  list_id: listaAmico,
  role: 'A',
  label: 'Attaccante 1 — top',
  position: 0,
})
const idSlot = slot.corpo?.[0]?.id
const idObiettivoLautaro = obiettivo.corpo?.[0]?.id
const candidato = await scrivi(amico, 'slot_candidates', 'POST', {
  slot_id: idSlot,
  target_id: idObiettivoLautaro,
  position: 0,
})
esito(
  'Strategia degli slot: uno slot con il suo candidato',
  slot.stato === 201 && candidato.stato === 201,
  `slot "${slot.corpo?.[0]?.label}" con 1 candidato`,
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

const metodi = await scrivi(amico, `target_lists?id=eq.${listaAmico}`, 'PATCH', {
  usa_slot: true,
  usa_incroci: true,
})
esito(
  'Il proprietario accende e spegne i metodi che preferisce',
  metodi.stato === 200 && metodi.corpo?.[0]?.usa_slot === true,
  `fasce ${metodi.corpo?.[0]?.usa_fasce}, tetti ${metodi.corpo?.[0]?.usa_tetti}, slot ${metodi.corpo?.[0]?.usa_slot}, incroci ${metodi.corpo?.[0]?.usa_incroci}`,
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
const suoSlot = await scrivi(admin, 'roster_slots', 'POST', {
  list_id: listaAdmin,
  role: 'A',
  label: 'Attaccante 1',
})
const candidatoIncrociato = await scrivi(admin, 'slot_candidates', 'POST', {
  slot_id: suoSlot.corpo?.[0]?.id,
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

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Nessuna lista è trapelata. Pulisci con: node scripts/verifica-obiettivi.mjs --pulisci')
