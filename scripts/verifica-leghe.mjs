// ═══════════════════════════════════════════════════════════════════════════
// Verifica funzionale e di sicurezza della Fetta 1: leghe, inviti, squadre.
//
// Crea tre utenti veri (amministratore, amico, estraneo), costruisce una lega
// e poi prova a fare cose che non dovrebbero riuscire.
//
// Uso:  node scripts/verifica-leghe.mjs [--pulisci]
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
  // Le leghe vanno tolte per prime: `leagues.admin_user_id` ha vincolo
  // RESTRICT, cioe' impedisce di cancellare un utente che amministra una lega.
  // E' voluto: nessuna lega deve restare senza amministratore.
  const leghe = await sql(`delete from public.leagues
    where admin_user_id in (select id from auth.users where email like '%@fantasta.test')
    returning name;`)
  const via = await sql("delete from auth.users where email like '%@fantasta.test' returning email;")
  console.log(`Leghe di prova rimosse: ${leghe.length} · utenti rimossi: ${via.length}`)
  process.exit(0)
}

// ─── Utilita' ───────────────────────────────────────────────────────────────

const esiti = []
function esito(nome, ok, dettaglio) {
  esiti.push({ nome, ok })
  console.log(`${ok ? '  OK  ' : ' FALLITA ' } ${nome}`)
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

function intestazioni(u, extra = {}) {
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
    headers: intestazioni(u),
    body: JSON.stringify(corpo ?? {}),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

// entra_in_lega restituisce una tabella: la REST la consegna come elenco.
function esitoIngresso(r) {
  return (Array.isArray(r.corpo) ? r.corpo[0] : r.corpo) ?? {}
}

async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, { headers: intestazioni(u) })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

async function scrivi(u, percorso, metodo, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    method: metodo,
    headers: intestazioni(u, { Prefer: 'return=representation' }),
    body: JSON.stringify(corpo),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Creo tre utenti di prova: amministratore, amico, estraneo.\n')
const admin = await registra('admin')
const amico = await registra('amico')
const estraneo = await registra('estraneo')

// ─── 1. Creazione della lega ────────────────────────────────────────────────

const creazione = await rpc(admin, 'crea_lega', {
  p_nome: 'Lega di Prova',
  p_stagione: '2026/27',
  p_nome_squadra: 'Real Madrink',
  p_crediti: 500,
  p_max_partecipanti: 3,
})
const legaId = creazione.corpo
esito(
  'L amministratore crea la lega',
  creazione.stato === 200 && typeof legaId === 'string',
  `HTTP ${creazione.stato}, id lega: ${legaId}`,
)

const riga = (await sql(`select name, invite_code, invite_active, status, credits_initial
                         from public.leagues where id = '${legaId}';`))[0]
esito(
  'Il codice di invito ha il formato giusto',
  /^[A-HJ-NP-Z2-9]{6}$/.test(riga.invite_code),
  `codice: ${riga.invite_code}, attivo: ${riga.invite_active}, stato: ${riga.status}`,
)

const squadraAdmin = (await sql(`select name, credits_remaining from public.teams
                                 where league_id = '${legaId}';`))[0]
esito(
  'La squadra dell amministratore nasce con tutti i crediti',
  squadraAdmin.name === 'Real Madrink' && squadraAdmin.credits_remaining === 500,
  `squadra "${squadraAdmin.name}", crediti ${squadraAdmin.credits_remaining}`,
)

// ─── 2. Regole assurde rifiutate ────────────────────────────────────────────

const impossibile = await rpc(admin, 'crea_lega', {
  p_nome: 'Lega Impossibile',
  p_stagione: '2026/27',
  p_nome_squadra: 'Squadra X',
  p_crediti: 10,
  p_slot_p: 3, p_slot_d: 8, p_slot_c: 8, p_slot_a: 6,
})
esito(
  'Una lega con crediti insufficienti viene rifiutata',
  impossibile.stato >= 400,
  `HTTP ${impossibile.stato}: ${impossibile.corpo?.message ?? ''}`,
)

// ─── 3. Anteprima e ingresso con il codice ──────────────────────────────────

const anteprima = await rpc(amico, 'anteprima_invito', { p_codice: riga.invite_code.toLowerCase() })
esito(
  'Chi non e ancora dentro vede il nome della lega dal codice',
  anteprima.stato === 200 && anteprima.corpo?.[0]?.nome === 'Lega di Prova',
  `HTTP ${anteprima.stato}: ${JSON.stringify(anteprima.corpo)}`,
)

const ingresso = await rpc(amico, 'entra_in_lega', {
  p_codice: riga.invite_code.toLowerCase(),
  p_nome_squadra: 'F.C. Pirlo',
})
esito(
  'L amico entra con il codice, anche scritto minuscolo',
  esitoIngresso(ingresso).esito === 'ok' && esitoIngresso(ingresso).lega === legaId,
  `esito: ${esitoIngresso(ingresso).esito} · ${esitoIngresso(ingresso).messaggio}`,
)

const doppione = await rpc(amico, 'entra_in_lega', {
  p_codice: riga.invite_code,
  p_nome_squadra: 'Un Altro Nome',
})
esito(
  'Chi e gia dentro non entra due volte',
  esitoIngresso(doppione).esito === 'gia_dentro' && esitoIngresso(doppione).lega === legaId,
  `esito: ${esitoIngresso(doppione).esito} · riporta alla stessa lega senza creare doppioni`,
)

const nomeOccupato = await rpc(estraneo, 'entra_in_lega', {
  p_codice: riga.invite_code,
  p_nome_squadra: 'f.c. pirlo',
})
esito(
  'Due squadre non possono chiamarsi uguale',
  esitoIngresso(nomeOccupato).esito === 'nome_occupato',
  `esito: ${esitoIngresso(nomeOccupato).esito} · ${esitoIngresso(nomeOccupato).messaggio}`,
)

// ─── 4. Le violazioni ───────────────────────────────────────────────────────

const legaEstraneo = await leggi(estraneo, `leagues?select=id,name&id=eq.${legaId}`)
esito(
  'Un estraneo NON vede la lega',
  Array.isArray(legaEstraneo.corpo) && legaEstraneo.corpo.length === 0,
  `HTTP ${legaEstraneo.stato}, righe: ${JSON.stringify(legaEstraneo.corpo)}`,
)

const squadreEstraneo = await leggi(estraneo, `teams?select=name&league_id=eq.${legaId}`)
esito(
  'Un estraneo NON vede le squadre',
  Array.isArray(squadreEstraneo.corpo) && squadreEstraneo.corpo.length === 0,
  `HTTP ${squadreEstraneo.stato}, righe: ${JSON.stringify(squadreEstraneo.corpo)}`,
)

const membriEstraneo = await leggi(estraneo, `league_members?select=user_id&league_id=eq.${legaId}`)
esito(
  'Un estraneo NON vede i partecipanti',
  Array.isArray(membriEstraneo.corpo) && membriEstraneo.corpo.length === 0,
  `HTTP ${membriEstraneo.stato}, righe: ${JSON.stringify(membriEstraneo.corpo)}`,
)

const squadreAmico = await leggi(amico, `teams?select=name,credits_remaining&league_id=eq.${legaId}`)
esito(
  'Un partecipante vede le squadre degli avversari con i crediti',
  Array.isArray(squadreAmico.corpo) && squadreAmico.corpo.length === 2,
  `HTTP ${squadreAmico.stato}, squadre viste: ${JSON.stringify(squadreAmico.corpo)}`,
)

const profiloCompagno = await leggi(amico, `profiles?select=display_name&id=eq.${admin.id}`)
esito(
  'Un partecipante vede il nome dei compagni di lega',
  Array.isArray(profiloCompagno.corpo) && profiloCompagno.corpo.length === 1,
  `HTTP ${profiloCompagno.stato}, righe: ${JSON.stringify(profiloCompagno.corpo)}`,
)

const profiloEstraneo = await leggi(estraneo, `profiles?select=display_name&id=eq.${admin.id}`)
esito(
  'Un estraneo NON vede il profilo di chi non conosce',
  Array.isArray(profiloEstraneo.corpo) && profiloEstraneo.corpo.length === 0,
  `HTTP ${profiloEstraneo.stato}, righe: ${JSON.stringify(profiloEstraneo.corpo)}`,
)

const idSquadraAmico = (await sql(
  `select id from public.teams where league_id = '${legaId}' and user_id = '${amico.id}';`,
))[0].id

const crediti = await scrivi(amico, `teams?id=eq.${idSquadraAmico}`, 'PATCH', {
  credits_remaining: 99999,
})
const creditiDopo = (await sql(
  `select credits_remaining from public.teams where id = '${idSquadraAmico}';`,
))[0].credits_remaining
esito(
  'Un partecipante NON puo darsi crediti da solo',
  crediti.stato >= 400 && creditiDopo === 500,
  `HTTP ${crediti.stato}: ${crediti.corpo?.message ?? ''} | crediti reali: ${creditiDopo}`,
)

const rinomina = await scrivi(amico, `teams?id=eq.${idSquadraAmico}`, 'PATCH', {
  name: 'Fanta Pirlo',
})
esito(
  'Il proprietario puo rinominare la propria squadra',
  rinomina.stato === 200 && rinomina.corpo?.[0]?.name === 'Fanta Pirlo',
  `HTTP ${rinomina.stato}, nome ora: ${rinomina.corpo?.[0]?.name}`,
)

const idSquadraAdmin = (await sql(
  `select id from public.teams where league_id = '${legaId}' and user_id = '${admin.id}';`,
))[0].id
const rinominaAltrui = await scrivi(amico, `teams?id=eq.${idSquadraAdmin}`, 'PATCH', {
  name: 'Rubata',
})
const nomeAdminDopo = (await sql(
  `select name from public.teams where id = '${idSquadraAdmin}';`,
))[0].name
esito(
  'Nessuno rinomina la squadra di un altro',
  nomeAdminDopo === 'Real Madrink',
  `HTTP ${rinominaAltrui.stato}, righe toccate: ${JSON.stringify(rinominaAltrui.corpo)}, nome reale: ${nomeAdminDopo}`,
)

const regoleAltrui = await scrivi(amico, `leagues?id=eq.${legaId}`, 'PATCH', {
  credits_initial: 9999,
})
const creditiLegaDopo = (await sql(
  `select credits_initial from public.leagues where id = '${legaId}';`,
))[0].credits_initial
esito(
  'Un partecipante NON cambia le regole della lega',
  creditiLegaDopo === 500,
  `HTTP ${regoleAltrui.stato}, crediti iniziali reali: ${creditiLegaDopo}`,
)

const codiceAltrui = await rpc(amico, 'rigenera_codice_invito', { p_lega: legaId })
esito(
  'Un partecipante NON rigenera il codice di invito',
  codiceAltrui.stato >= 400,
  `HTTP ${codiceAltrui.stato}: ${codiceAltrui.corpo?.message ?? ''}`,
)

const codiceAdmin = await rpc(admin, 'rigenera_codice_invito', { p_lega: legaId })
esito(
  'L amministratore rigenera il codice',
  codiceAdmin.stato === 200 && /^[A-HJ-NP-Z2-9]{6}$/.test(codiceAdmin.corpo),
  `nuovo codice: ${codiceAdmin.corpo}, il vecchio ${riga.invite_code} non vale più`,
)

const vecchioCodice = await rpc(estraneo, 'entra_in_lega', {
  p_codice: riga.invite_code,
  p_nome_squadra: 'Tardivi',
})
esito(
  'Il vecchio codice non funziona piu',
  esitoIngresso(vecchioCodice).esito === 'codice_non_valido',
  `esito: ${esitoIngresso(vecchioCodice).esito} · ${esitoIngresso(vecchioCodice).messaggio}`,
)

// ─── 5. Lega al completo ────────────────────────────────────────────────────

const terzo = await rpc(estraneo, 'entra_in_lega', {
  p_codice: codiceAdmin.corpo,
  p_nome_squadra: 'Terzo Incomodo',
})
esito(
  'Il terzo entra e riempie la lega',
  esitoIngresso(terzo).esito === 'ok',
  `esito: ${esitoIngresso(terzo).esito} · partecipanti ora 3 su 3`,
)

const quarto = await registra('quarto')
const troppi = await rpc(quarto, 'entra_in_lega', {
  p_codice: codiceAdmin.corpo,
  p_nome_squadra: 'Quarto Escluso',
})
esito(
  'A lega piena non si entra piu',
  esitoIngresso(troppi).esito === 'lega_piena',
  `esito: ${esitoIngresso(troppi).esito} · ${esitoIngresso(troppi).messaggio}`,
)

// ─── 6. Asta iniziata: inviti chiusi ────────────────────────────────────────

await sql(`update public.leagues set status = 'auction' where id = '${legaId}';`)
const quinto = await registra('quinto')
const adAstaAperta = await rpc(quinto, 'entra_in_lega', {
  p_codice: codiceAdmin.corpo,
  p_nome_squadra: 'Ritardatario',
})
esito(
  'Ad asta iniziata gli inviti sono chiusi',
  esitoIngresso(adAstaAperta).esito === 'asta_iniziata',
  `esito: ${esitoIngresso(adAstaAperta).esito} · ${esitoIngresso(adAstaAperta).messaggio}`,
)
await sql(`update public.leagues set status = 'setup' where id = '${legaId}';`)

// ─── 7. Limite ai tentativi ─────────────────────────────────────────────────

const bruteforce = await registra('curioso')
let ultimo = null
for (let i = 0; i < 12; i++) {
  ultimo = await rpc(bruteforce, 'entra_in_lega', { p_codice: 'ZZZZZZ', p_nome_squadra: 'X' })
}
esito(
  'Chi prova codici a caso viene fermato',
  esitoIngresso(ultimo).esito === 'troppi_tentativi',
  `dopo 12 tentativi: ${esitoIngresso(ultimo).messaggio}`,
)

// ─── 8. Il regolamento in PDF ───────────────────────────────────────────────

// Un PDF minimo ma valido, costruito qui: niente file di prova da versionare.
const pdfFinto = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
)

async function caricaPdf(u, percorso) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/regolamenti/${percorso}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${u.token}`,
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    },
    body: pdfFinto,
  })
  return { stato: r.status, corpo: await r.text() }
}

const percorsoPdf = `${legaId}/regolamento.pdf`

const caricaAmico = await caricaPdf(amico, percorsoPdf)
esito(
  'Un partecipante NON carica il regolamento',
  caricaAmico.stato >= 400,
  `HTTP ${caricaAmico.stato}: ${caricaAmico.corpo.slice(0, 90)}`,
)

const caricaAdmin = await caricaPdf(admin, percorsoPdf)
esito(
  'L amministratore carica il regolamento',
  caricaAdmin.stato < 400,
  `HTTP ${caricaAdmin.stato}: ${caricaAdmin.corpo.slice(0, 90)}`,
)

async function firmaPdf(u) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/sign/regolamenti/${percorsoPdf}`, {
    method: 'POST',
    headers: intestazioni(u),
    body: JSON.stringify({ expiresIn: 60 }),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

const firmaAmico = await firmaPdf(amico)
esito(
  'Un partecipante puo aprire il regolamento',
  firmaAmico.stato === 200 && typeof firmaAmico.corpo?.signedURL === 'string',
  `HTTP ${firmaAmico.stato}, indirizzo firmato: ${firmaAmico.corpo?.signedURL ? 'ricevuto' : 'assente'}`,
)

const firmaQuarto = await firmaPdf(quarto)
esito(
  'Chi non e nella lega NON apre il regolamento',
  firmaQuarto.stato >= 400,
  `HTTP ${firmaQuarto.stato}: ${JSON.stringify(firmaQuarto.corpo)?.slice(0, 90)}`,
)

const pdfPubblico = await fetch(`${URL_BASE}/storage/v1/object/public/regolamenti/${percorsoPdf}`)
esito(
  'Il regolamento NON e raggiungibile senza autenticazione',
  pdfPubblico.status >= 400,
  `HTTP ${pdfPubblico.status} sull indirizzo pubblico`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Tutto come previsto. Pulisci con: node scripts/verifica-leghe.mjs --pulisci')
