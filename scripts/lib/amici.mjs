// ═══════════════════════════════════════════════════════════════════════════
// I compagni di lega finti: chi sono, come entrano, come parlano al server.
//
// PERCHE' STA IN UNA LIBRERIA
//
// Lo usano in due: `amici-di-prova.mjs`, che li crea e li comanda uno per
// volta dalla riga di comando, e `bot-asta.mjs`, che li fa giocare da soli.
// Due copie di «come si chiama il dominio», «qual e' la password», «come si
// accede» divergerebbero al primo ritocco, e il modo in cui se ne
// accorgerebbe qualcuno e' il peggiore possibile: i bot che rilanciano in una
// lega e gli amici che stanno in un'altra, la sera in cui si prova l'asta.
//
// QUELLO CHE QUI NON C'E', ED E' UNA SCELTA
//
// Nessuna scorciatoia con le credenziali di servizio. Gli amici finti entrano
// dal codice di invito come tutti e parlano al server con il **loro** token:
// se il server rifiuta un rilancio a loro, lo rifiuterebbe a una persona vera.
// Un bot che scrivesse nel database con la chiave di amministrazione
// proverebbe soltanto che la chiave di amministrazione funziona.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHIAVE, URL_BASE, envRad, radice, sql } from './fm.mjs'

export { CHIAVE, URL_BASE, sql }

/**
 * La password degli amici finti.
 *
 * PERCHE' NON E' SCRITTA NEL CODICE
 * Lo era, in chiaro, con la scusa che sono account finti su un dominio che non
 * esiste. La scusa regge finche' l'app resta sul computer di casa: appena
 * viene pubblicata online, quella riga in un repository pubblico diventa la
 * password buona per entrare nella lega vera e rovinare un'asta.
 *
 * Una sola per tutti resta la scelta giusta: dieci password diverse
 * vorrebbero dire tenerne un elenco, e sarebbe un elenco di password che non
 * serve a nessuno.
 */
export function assicuraPassword() {
  if (envRad.FANTASTA_PASSWORD_AMICI) return envRad.FANTASTA_PASSWORD_AMICI

  const nuova =
    'amici-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)

  const percorso = join(radice, '.env.local')
  const testo = readFileSync(percorso, 'utf8')
  writeFileSync(
    percorso,
    testo.replace(/\s*$/, '') +
      '\n\n# Password degli amici di prova, generata da scripts/lib/amici.mjs.\n' +
      "# Sta qui e non nel codice: il codice puo' finire in un repository pubblico.\n" +
      `FANTASTA_PASSWORD_AMICI=${nuova}\n`,
  )
  console.log(`Password degli amici generata e salvata in .env.local: ${nuova}\n`)
  return nuova
}

export const PASSWORD = assicuraPassword()

// Il dominio si puo' spostare solo per provare questi script stessi: la
// verifica ha bisogno di amici finti tutti suoi, perche' --elimina porta via
// tutti quelli del dominio e non deve toccare quelli veri.
export const DOMINIO = process.env.FANTASTA_DOMINIO_AMICI ?? 'amici.fantasta'

export const NOMI = [
  { utente: 'marco', squadra: 'Real Sciacallo' },
  { utente: 'giulia', squadra: 'Atletico Divano' },
  { utente: 'sara', squadra: 'Borussia Panchina' },
  { utente: 'luca', squadra: 'Manchester Sitty' },
  { utente: 'elena', squadra: 'Inter Rotta' },
  { utente: 'davide', squadra: 'Bayern Fuorigioco' },
  { utente: 'chiara', squadra: 'Napoletanissima' },
  { utente: 'andrea', squadra: 'Juventurbo' },
  { utente: 'francesca', squadra: 'Milanesi Distratti' },
  { utente: 'paolo', squadra: 'Lazio Malissimo' },
  { utente: 'valentina', squadra: 'Roma Sparita' },
  { utente: 'stefano', squadra: 'Atalanta Bergamasca' },
  { utente: 'ilaria', squadra: 'Fiorentina Viola Sbiadito' },
  { utente: 'matteo', squadra: 'Torino Granata Pallido' },
  { utente: 'alessia', squadra: 'Bologna Ragu' },
  { utente: 'simone', squadra: 'Udinese Friulana' },
  { utente: 'martina', squadra: 'Genoa Mugugno' },
  { utente: 'riccardo', squadra: 'Sampdoria Baciccia' },
  { utente: 'noemi', squadra: 'Cagliari Quattromori' },
]

export const cita = (v) => `'${String(v).replace(/'/g, "''")}'`

export async function registra(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, data: { display_name: email.split('@')[0] } }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`registrazione di ${email} fallita: ${JSON.stringify(j)}`)
  return j.access_token
}

export async function accedi(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`accesso di ${email} fallito: ${JSON.stringify(j)}`)
  return j.access_token
}

export async function rpc(token, funzione, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: { apikey: CHIAVE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

/** Legge una tabella o vista con il token di un amico, come farebbe l'app. */
export async function leggi(token, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    headers: { apikey: CHIAVE, Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return []
  return await r.json().catch(() => [])
}

export function argomento(nome) {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : undefined
}

export async function trovaLega() {
  const codice = argomento('--lega')
  const leghe = await sql(`select l.id, l.name, l.invite_code, l.invite_active, l.max_members,
      l.status, u.email as admin,
      (select count(*) from public.teams t where t.league_id = l.id)::int as squadre
    from public.leagues l join auth.users u on u.id = l.admin_user_id
    ${codice ? `where l.invite_code = ${cita(codice.toUpperCase())}` : ''}
    order by l.created_at;`)

  if (leghe.length === 0) {
    console.error(
      codice
        ? `Nessuna lega con il codice ${codice}.`
        : "Non c'e' nessuna lega. Creane una dall'app, poi rilancia questo comando.",
    )
    process.exit(1)
  }
  if (leghe.length > 1) {
    console.error("Ci sono piu' leghe: dimmi quale, con --lega <codice>.\n")
    for (const l of leghe) console.error(`  ${l.invite_code}  ${l.name} (${l.squadre} squadre)`)
    process.exit(1)
  }
  return leghe[0]
}

/** Gli amici finti gia' dentro questa lega, in ordine di ingresso. */
export async function amiciInLega(lega) {
  return await sql(`select u.email, t.name as squadra, t.id as squadra_id,
      b.credits_remaining, b.massimo_offribile, b.slot_rimanenti
    from auth.users u
    join public.teams t on t.user_id = u.id and t.league_id = ${cita(lega)}
    left join public.team_budget b on b.team_id = t.id
    where u.email like ${cita('%@' + DOMINIO)}
    order by t.created_at;`)
}

/** Risolve «2» o «marco» o l'email intera nell'amico corrispondente. */
export async function scegliAmico(lega, quale) {
  const amici = await amiciInLega(lega)
  if (amici.length === 0) {
    console.error('Non ci sono amici di prova in questa lega. Creali prima, senza argomenti.')
    process.exit(1)
  }
  const n = Number(quale)
  if (Number.isInteger(n) && n >= 1 && n <= amici.length) return amici[n - 1]
  const trovato = amici.find(
    (a) => a.email === quale || a.email.split('@')[0] === String(quale).toLowerCase(),
  )
  if (trovato) return trovato

  console.error(`Non capisco chi sia «${quale}». Gli amici in lega sono:\n`)
  amici.forEach((a, i) => console.error(`  ${i + 1}  ${a.email.split('@')[0]}  (${a.squadra})`))
  process.exit(1)
}
