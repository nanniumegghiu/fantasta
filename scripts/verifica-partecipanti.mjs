// ═══════════════════════════════════════════════════════════════════════════
// Verifica: riaprire un'asta chiusa, e cambiare chi guida una squadra.
//
// PERCHE' QUESTE PROVE ESISTONO
//
// La prima nasce dal difetto peggiore trovato finora: un'asta chiusa per
// sbaglio bloccava la lega senza nessun modo di rimediare. Non c'era una
// funzione da correggere, mancava proprio la funzione contraria. La prova che
// conta e' quella che chiude e riapre: se un giorno qualcuno togliesse
// `riapri_asta`, questa suite lo direbbe prima che se ne accorga una lega.
//
// La seconda riguarda una squadra che passa di mano. Il rischio non e' che non
// funzioni: e' che si porti via qualcosa che doveva restare — la rosa, i
// crediti — o che lasci qualcosa che doveva andarsene, come la lista obiettivi
// del proprietario di prima, che era sua e privata.
//
// Uso:  node scripts/verifica-partecipanti.mjs [--pulisci]
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

const STAGIONE_DI_PROVA = 'PROVA-PART'

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

// ─── Preparazione ───────────────────────────────────────────────────────────

console.log('Preparo una lega con tre persone e un listone.\n')

const capo = await registra('capo')
const amico = await registra('amico')
const nuovo = await registra('nuovo')
const estraneo = await registra('estraneo')
await sql(`insert into public.app_admins (user_id) values ('${capo.id}') on conflict do nothing;`)

const CALCIATORI = [
  { id: 905501, nome: 'Uno', ruolo: 'P', squadra: 'Prova FC', quotazione: 10 },
  { id: 905502, nome: 'Due', ruolo: 'D', squadra: 'Prova FC', quotazione: 10 },
  { id: 905503, nome: 'Tre', ruolo: 'C', squadra: 'Prova FC', quotazione: 10 },
  { id: 905504, nome: 'Quattro', ruolo: 'A', squadra: 'Prova FC', quotazione: 10 },
]
await rpc(capo, 'importa_listone', { p_stagione: STAGIONE_DI_PROVA, p_righe: CALCIATORI })

const lega = (await rpc(capo, 'crea_lega', {
  p_nome: 'Partecipanti',
  p_stagione: STAGIONE_DI_PROVA,
  p_nome_squadra: 'Squadra del Capo',
  p_crediti: 100,
  p_slot_p: 1, p_slot_d: 1, p_slot_c: 1, p_slot_a: 1,
  p_max_partecipanti: 4,
})).riga
const codice = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0].invite_code
await rpc(amico, 'entra_in_lega', { p_codice: codice, p_nome_squadra: 'Squadra dell Amico' })

const squadraAmico = (await sql(`select id from public.teams
  where league_id = '${lega}' and user_id = '${amico.id}';`))[0].id

// Una rosa e una lista obiettivi, per vedere cosa resta e cosa se ne va.
await sql(`insert into public.roster_players (league_id, team_id, player_id, price)
  values ('${lega}', '${squadraAmico}', 905502, 30);`)
await sql(`update public.teams set credits_remaining = 70 where id = '${squadraAmico}';`)
await rpc(amico, 'assicura_lista_obiettivi', { p_lega: lega })

// ─── 1. Riaprire un'asta chiusa ─────────────────────────────────────────────

await rpc(capo, 'configura_asta', {
  p_lega: lega, p_metodo: 'chiamata', p_variante: 'totale', p_conduzione: 'app',
  p_tipo_chiamata: 'libera', p_secondi_inattivita: 120, p_secondi_countdown: 60,
})
await rpc(capo, 'apri_asta', { p_lega: lega, p_sorteggia: false })
await rpc(capo, 'chiudi_asta', { p_lega: lega })

const dopoChiusura = (await sql(`select a.status asta, l.status lega
  from public.auctions a join public.leagues l on l.id = a.league_id
  where a.league_id = '${lega}';`))[0]
esito(
  'Preparazione: l asta e chiusa e la lega e ferma',
  dopoChiusura.asta === 'closed' && dopoChiusura.lega === 'done',
  `asta ${dopoChiusura.asta}, lega ${dopoChiusura.lega}`,
)

const riapreUnAltro = await rpc(amico, 'riapri_asta', { p_lega: lega, p_motivo: 'ci provo' })
esito(
  'Riapre l asta solo l amministratore',
  riapreUnAltro.riga?.esito === 'non_autorizzato',
  `${riapreUnAltro.riga?.messaggio}`,
)

const senzaMotivo = await rpc(capo, 'riapri_asta', { p_lega: lega, p_motivo: '' })
esito(
  'Senza motivo non si riapre',
  senzaMotivo.riga?.esito === 'non_autorizzato',
  `${senzaMotivo.riga?.messaggio}`,
)

const riapertura = await rpc(capo, 'riapri_asta', {
  p_lega: lega, p_motivo: 'chiusa per sbaglio',
})
const dopoRiapertura = (await sql(`select a.status asta, a.closed_at, l.status lega
  from public.auctions a join public.leagues l on l.id = a.league_id
  where a.league_id = '${lega}';`))[0]
esito(
  'L asta chiusa per sbaglio si riapre, e la lega riparte',
  riapertura.riga?.esito === 'ok' &&
    dopoRiapertura.asta === 'open' &&
    dopoRiapertura.lega === 'auction' &&
    dopoRiapertura.closed_at === null,
  `${riapertura.riga?.messaggio} · asta ${dopoRiapertura.asta}, lega ${dopoRiapertura.lega}`,
)

const rosaIntatta = (await sql(`select count(*)::int n from public.roster_players
  where league_id = '${lega}';`))[0].n
esito(
  'Riaprire non cancella niente: la rosa e i crediti restano',
  rosaIntatta === 1,
  `calciatori in rosa: ${rosaIntatta}`,
)

const giaAperta = await rpc(capo, 'riapri_asta', { p_lega: lega, p_motivo: 'e adesso?' })
esito(
  'Un asta gia aperta non si riapre due volte',
  giaAperta.riga?.esito === 'asta_non_aperta',
  `${giaAperta.riga?.messaggio}`,
)

const registro = await leggi(
  amico,
  `registro_asta?select=type,manuale,motivo&league_id=eq.${lega}&type=eq.riapertura`,
)
esito(
  'La riapertura finisce nel registro come intervento, col suo motivo',
  registro.corpo?.[0]?.manuale === true &&
    registro.corpo?.[0]?.motivo === 'chiusa per sbaglio',
  `motivo registrato: «${registro.corpo?.[0]?.motivo}»`,
)

// ─── 2. La persona se ne va, la squadra resta ───────────────────────────────

const liberaDaAltri = await rpc(amico, 'libera_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_motivo: 'me ne vado da solo',
})
esito(
  'Un partecipante non toglie nessuno dalla lega',
  liberaDaAltri.riga?.esito === 'non_autorizzato',
  `${liberaDaAltri.riga?.messaggio}`,
)

const squadraCapo = (await sql(`select id from public.teams
  where league_id = '${lega}' and user_id = '${capo.id}';`))[0].id
const seStesso = await rpc(capo, 'libera_squadra', {
  p_lega: lega, p_squadra: squadraCapo, p_motivo: 'mi tolgo io',
})
esito(
  'L amministratore non puo togliere se stesso: la lega resterebbe senza nessuno che rimedia',
  seStesso.riga?.esito === 'non_autorizzato',
  `${seStesso.riga?.messaggio}`,
)

const liberata = await rpc(capo, 'libera_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_motivo: 'ha lasciato il gruppo',
})
const dopoLibera = (await sql(`select t.user_id, t.name, t.credits_remaining,
  (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa,
  (select count(*)::int from public.league_members m
   where m.league_id = t.league_id and m.user_id = '${amico.id}') ancora_membro,
  (select count(*)::int from public.target_lists l
   where l.league_id = t.league_id and l.user_id = '${amico.id}') lista
  from public.teams t where t.id = '${squadraAmico}';`))[0]

esito(
  'La persona esce e la squadra resta: rosa, crediti e nome intatti',
  liberata.riga?.esito === 'ok' &&
    dopoLibera.user_id === null &&
    dopoLibera.rosa === 1 &&
    dopoLibera.credits_remaining === 70 &&
    dopoLibera.ancora_membro === 0,
  `${liberata.riga?.messaggio} · rosa ${dopoLibera.rosa}, crediti ${dopoLibera.credits_remaining}`,
)

esito(
  'La lista obiettivi se ne va con lei: era sua e privata',
  dopoLibera.lista === 0,
  `liste rimaste di chi se n è andato: ${dopoLibera.lista}`,
)

const laVede = await leggi(amico, `teams?select=id&id=eq.${squadraAmico}`)
esito(
  'Chi e uscito non vede piu la lega',
  (laVede.corpo?.length ?? 0) === 0,
  `righe viste da chi è uscito: ${laVede.corpo?.length ?? 0}`,
)

const libereViste = await leggi(capo, `squadre_libere?select=name,calciatori&league_id=eq.${lega}`)
esito(
  'La squadra senza nessuno compare fra quelle che aspettano',
  libereViste.corpo?.length === 1 && libereViste.corpo[0].calciatori === 1,
  `«${libereViste.corpo?.[0]?.name}» con ${libereViste.corpo?.[0]?.calciatori} calciatori`,
)

// ─── 3. Affidarla a qualcun altro ───────────────────────────────────────────

const affidaDaAltri = await rpc(estraneo, 'affida_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_email: estraneo.email,
})
esito(
  'Una squadra libera non se la prende chi vuole',
  affidaDaAltri.riga?.esito === 'non_autorizzato',
  `${affidaDaAltri.riga?.messaggio}`,
)

const senzaAccount = await rpc(capo, 'affida_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_email: 'nessuno@fantasta.test',
})
esito(
  'Non si affida a un indirizzo senza account, e lo si dice',
  senzaAccount.riga?.esito === 'non_trovato' && /registrarsi/.test(senzaAccount.riga?.messaggio ?? ''),
  `${senzaAccount.riga?.messaggio}`,
)

const affidata = await rpc(capo, 'affida_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_email: nuovo.email,
})
const dopoAffido = (await sql(`select t.user_id, t.name, t.credits_remaining,
  (select count(*)::int from public.roster_players r where r.team_id = t.id) rosa,
  (select count(*)::int from public.league_members m
   where m.league_id = t.league_id and m.user_id = '${nuovo.id}') membro
  from public.teams t where t.id = '${squadraAmico}';`))[0]
esito(
  'La squadra passa a chi la prende, con rosa e crediti',
  affidata.riga?.esito === 'ok' &&
    dopoAffido.user_id === nuovo.id &&
    dopoAffido.rosa === 1 &&
    dopoAffido.credits_remaining === 70 &&
    dopoAffido.membro === 1,
  `${affidata.riga?.messaggio}`,
)

esito(
  'Il nome della squadra non cambia: quella rosa la conoscono tutti cosi',
  dopoAffido.name === 'Squadra dell Amico',
  `si chiama ancora «${dopoAffido.name}»`,
)

const oraLaVede = await leggi(nuovo, `teams?select=id,name&id=eq.${squadraAmico}`)
esito(
  'Chi l ha presa adesso la vede',
  oraLaVede.corpo?.length === 1,
  `«${oraLaVede.corpo?.[0]?.name}»`,
)

const giaAssegnata = await rpc(capo, 'affida_squadra', {
  p_lega: lega, p_squadra: squadraAmico, p_email: estraneo.email,
})
esito(
  'Una squadra che ha gia un proprietario non si affida a un altro',
  giaAssegnata.riga?.esito === 'gia_assegnata',
  `${giaAssegnata.riga?.messaggio}`,
)

// ─── 4. Il turno non si ferma su una squadra senza nessuno ──────────────────
//
// E' il rischio che il cambio di proprietario introduce: il motore aspetta
// una chiamata da una persona che non c'e', e l'asta si blocca di nuovo.

{
  await rpc(capo, 'libera_squadra', {
    p_lega: lega, p_squadra: squadraAmico, p_motivo: 'prova sul turno',
  })
  const a = (await sql(`select nomination_order, current_turn_index
    from public.auctions where league_id = '${lega}';`))[0]
  const diTurno = a.nomination_order[a.current_turn_index]
  const proprietario = (await sql(`select user_id from public.teams
    where id = '${diTurno}';`))[0].user_id
  esito(
    'Il turno non resta su una squadra senza nessuno',
    proprietario !== null,
    `tocca a una squadra che ha un proprietario: ${proprietario !== null}`,
  )
  // Si rimette com'era, per non lasciare la lega a metà.
  await rpc(capo, 'affida_squadra', {
    p_lega: lega, p_squadra: squadraAmico, p_email: nuovo.email,
  })
}

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node scripts/verifica-partecipanti.mjs --pulisci')
