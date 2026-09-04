// ═══════════════════════════════════════════════════════════════════════════
// Amici di prova: compagni di lega finti, per poter fare un'asta da soli.
//
// Un'asta ha bisogno di almeno due squadre, e una vera ne ha otto o dieci.
// Aspettare che si radunino otto amici per scoprire se il countdown funziona
// non e' un modo di lavorare. Questi sono account veri, con la loro email e la
// loro password: entrano in lega passando dal codice di invito come tutti,
// e si puo' fare l'accesso come loro da un altro browser o da un altro
// telefono.
//
// LA DOMANDA DELLE EMAIL
// Finiscono su @amici.fantasta, un dominio che non esiste e che nessuno degli
// script di verifica tocca. Le prove automatiche cancellano @fantasta.test:
// se gli amici stessero li', la prima verifica lanciata te li porterebbe via
// nel mezzo di un'asta.
//
// Uso:
//   node scripts/amici-di-prova.mjs                 crea gli amici mancanti
//   node scripts/amici-di-prova.mjs --quanti 7      quanti compagni vuoi
//   node scripts/amici-di-prova.mjs --lega Q4C4HQ   se hai piu' di una lega
//   node scripts/amici-di-prova.mjs --elenco        chi c'e' e come si entra
//   node scripts/amici-di-prova.mjs --elimina       via tutti, con le squadre
//
// Durante l'asta, per non dover tenere aperti sei browser:
//   node scripts/amici-di-prova.mjs --rilancia 2 45   il secondo offre 45
//   node scripts/amici-di-prova.mjs --rilancia 2      il secondo fa +1
//   node scripts/amici-di-prova.mjs --passa 3         il terzo si tira fuori
//   node scripts/amici-di-prova.mjs --chiama 4 2431 10   chiama e apre a 10
//   node scripts/amici-di-prova.mjs --stato           chi e' in asta e a quanto
// ═══════════════════════════════════════════════════════════════════════════

// Chi sono gli amici, come si accede e come si parla al server sta in
// `lib/amici.mjs`: lo condivide con `bot-asta.mjs`, che li fa giocare da soli.
// Due copie di quelle regole vorrebbero dire bot in una lega e amici in
// un'altra, e ce ne si accorgerebbe la sera dell'asta.
import {
  DOMINIO,
  NOMI,
  PASSWORD,
  accedi,
  amiciInLega,
  argomento,
  cita,
  registra,
  rpc,
  scegliAmico,
  sql,
  trovaLega,
} from './lib/amici.mjs'

// ═══════════════════════════════════════════════════════════════════════════
// I comandi
// ═══════════════════════════════════════════════════════════════════════════

const lega = await trovaLega()

// ─── Elenco ─────────────────────────────────────────────────────────────────

if (process.argv.includes('--elenco')) {
  const amici = await amiciInLega(lega.id)
  console.log(`Lega «${lega.name}», codice ${lega.invite_code}, ${lega.squadre} squadre.\n`)
  if (amici.length === 0) {
    console.log('Nessun amico di prova. Creali lanciando questo comando senza argomenti.')
    process.exit(0)
  }
  console.log(`Password, uguale per tutti: ${PASSWORD}\n`)
  amici.forEach((a, i) => {
    const crediti = a.credits_remaining == null ? '' : `  ${a.credits_remaining} crediti`
    console.log(`  ${i + 1}  ${a.email}   ${a.squadra}${crediti}`)
  })
  process.exit(0)
}

// ─── Eliminazione ───────────────────────────────────────────────────────────

if (process.argv.includes('--elimina')) {
  const amici = await amiciInLega(lega.id)
  // Le squadre se ne vanno con l'utente, a cascata. L'utente pero' non se ne
  // va se amministra una lega: questi non ne amministrano nessuna, ma il
  // controllo costa poco e il messaggio e' migliore di un errore di chiave.
  const amministrano = await sql(`select count(*)::int n from public.leagues l
    join auth.users u on u.id = l.admin_user_id
    where u.email like ${cita('%@' + DOMINIO)};`)
  if (amministrano[0].n > 0) {
    console.error(`${amministrano[0].n} amici di prova amministrano una lega: cancella prima quelle.`)
    process.exit(1)
  }
  const via = await sql(`delete from auth.users
    where email like ${cita('%@' + DOMINIO)} returning email;`)
  console.log(`Amici di prova rimossi: ${via.length} (erano ${amici.length} in questa lega).`)
  console.log('Le loro squadre, rose e liste obiettivi se ne sono andate con loro.')
  process.exit(0)
}

// ─── Stato dell'asta ────────────────────────────────────────────────────────

if (process.argv.includes('--stato')) {
  const asta = (await sql(`select id, status, method, variant, current_role_phase,
      current_turn_index, nomination_order
    from public.auctions where league_id = ${cita(lega.id)};`))[0]
  if (!asta) {
    console.log('Questa lega non ha ancora un\'asta.')
    process.exit(0)
  }
  console.log(`Asta ${asta.status}, metodo ${asta.method}${asta.variant ? ` (${asta.variant})` : ''}.`)

  if (asta.nomination_order && asta.status === 'open') {
    const turno = asta.nomination_order[asta.current_turn_index]
    const chi = (await sql(`select name from public.teams where id = ${cita(turno)};`))[0]
    console.log(`Tocca chiamare a: ${chi?.name ?? '—'}`)
  }

  const lotto = (await sql(`select l.id, p.id as calciatore, p.name, p.role, p.serie_a_team,
      l.current_bid, t.name as offerente, l.last_bid_at,
      extract(epoch from (now() - l.last_bid_at))::int as secondi_dall_ultima
    from public.auction_lots l
    join public.players p on p.id = l.player_id
    left join public.teams t on t.id = l.current_bidder_team_id
    where l.auction_id = ${cita(asta.id)} and l.status = 'open';`))[0]

  if (!lotto) {
    console.log('Nessun calciatore in asta in questo momento.')
  } else {
    console.log(`\nIn asta: ${lotto.name} (${lotto.role}, ${lotto.serie_a_team}), identificativo ${lotto.calciatore}`)
    console.log(`Offerta: ${lotto.current_bid} di ${lotto.offerente ?? 'nessuno'}, ${lotto.secondi_dall_ultima}s fa`)
  }

  console.log('\nSquadre:')
  const squadre = await sql(`select t.name, u.email, b.credits_remaining, b.massimo_offribile,
      b.slot_rimanenti
    from public.teams t join auth.users u on u.id = t.user_id
    left join public.team_budget b on b.team_id = t.id
    where t.league_id = ${cita(lega.id)} order by t.created_at;`)
  for (const s of squadre) {
    const finto = s.email.endsWith('@' + DOMINIO) ? '  (di prova)' : ''
    console.log(`  ${s.name}: ${s.credits_remaining} crediti, max ${s.massimo_offribile}, ${s.slot_rimanenti} slot${finto}`)
  }
  process.exit(0)
}

// ─── Azioni d'asta per conto di un amico ────────────────────────────────────

async function lottoAperto() {
  const l = (await sql(`select l.id, l.current_bid, p.name
    from public.auction_lots l
    join public.auctions a on a.id = l.auction_id
    join public.players p on p.id = l.player_id
    where a.league_id = ${cita(lega.id)} and l.status = 'open';`))[0]
  if (!l) {
    console.error('Non c\'e\' nessun calciatore in asta adesso.')
    process.exit(1)
  }
  return l
}

if (process.argv.includes('--rilancia')) {
  const i = process.argv.indexOf('--rilancia')
  const amico = await scegliAmico(lega.id, process.argv[i + 1])
  const lotto = await lottoAperto()
  const importo = Number(process.argv[i + 2] ?? lotto.current_bid + 1)

  const token = await accedi(amico.email)
  const r = await rpc(token, 'rilancia', { p_lotto: lotto.id, p_importo: importo })
  const esito = r.corpo?.[0]
  console.log(`${amico.squadra} su ${lotto.name}: ${esito?.esito} — ${esito?.messaggio}`)
  if (esito?.esito === 'ok') console.log(`Offerta ora a ${esito.offerta}.`)
  process.exit(esito?.esito === 'ok' ? 0 : 1)
}

if (process.argv.includes('--passa')) {
  const i = process.argv.indexOf('--passa')
  const amico = await scegliAmico(lega.id, process.argv[i + 1])
  const lotto = await lottoAperto()

  const token = await accedi(amico.email)
  const r = await rpc(token, 'passa', { p_lotto: lotto.id })
  const esito = r.corpo?.[0]
  console.log(`${amico.squadra} passa su ${lotto.name}: ${esito?.esito} — ${esito?.messaggio}`)
  process.exit(esito?.esito === 'ok' ? 0 : 1)
}

if (process.argv.includes('--chiama')) {
  const i = process.argv.indexOf('--chiama')
  const amico = await scegliAmico(lega.id, process.argv[i + 1])
  const calciatore = Number(process.argv[i + 2])
  const importo = Number(process.argv[i + 3] ?? 1)
  if (!Number.isInteger(calciatore)) {
    console.error('Serve l\'identificativo del calciatore: --chiama 2 2431 10')
    process.exit(1)
  }

  const token = await accedi(amico.email)
  const r = await rpc(token, 'chiama_calciatore', {
    p_lega: lega.id,
    p_player_id: calciatore,
    p_importo: importo,
  })
  const esito = r.corpo?.[0]
  console.log(`${amico.squadra} chiama: ${esito?.esito} — ${esito?.messaggio}`)
  process.exit(esito?.esito === 'ok' ? 0 : 1)
}

// ─── Creazione ──────────────────────────────────────────────────────────────

const quanti = Number(argomento('--quanti') ?? 5)
if (!Number.isInteger(quanti) || quanti < 1 || quanti > NOMI.length) {
  console.error(`--quanti vuole un numero fra 1 e ${NOMI.length}.`)
  process.exit(1)
}

const asta = (await sql(`select status from public.auctions
  where league_id = ${cita(lega.id)};`))[0]
if (asta && asta.status !== 'draft') {
  // L'ordine di chiamata viene fissato all'apertura: chi arriva dopo non ci
  // sarebbe dentro, e si troverebbe a guardare un'asta senza mai poter
  // chiamare. Meglio dirlo prima che scoprirlo a meta' serata.
  console.error(`L'asta di questa lega e' gia' ${asta.status}: l'ordine di chiamata e' fissato.`)
  console.error('Chi entrasse adesso non chiamerebbe mai. Annulla l\'asta dall\'app, poi rilancia.')
  process.exit(1)
}

if (!lega.invite_active) {
  console.error(`La lega «${lega.name}» ha il codice di invito disattivato: riattivalo dall'app.`)
  process.exit(1)
}

const giaDentro = await amiciInLega(lega.id)
const posti = lega.max_members - lega.squadre
const daFare = Math.min(quanti - giaDentro.length, posti)

if (daFare <= 0) {
  console.log(
    giaDentro.length >= quanti
      ? `Ci sono gia' ${giaDentro.length} amici di prova in «${lega.name}». Vedili con --elenco.`
      : `«${lega.name}» e' piena: ${lega.squadre} squadre su ${lega.max_members}.`,
  )
  process.exit(0)
}

console.log(`Lega «${lega.name}», codice ${lega.invite_code}. Aggiungo ${daFare} compagni.\n`)

const usati = new Set(giaDentro.map((a) => a.email.split('@')[0].replace(/\d+$/, '')))
const scelti = NOMI.filter((n) => !usati.has(n.utente)).slice(0, daFare)
const creati = []

for (const n of scelti) {
  const email = `${n.utente}@${DOMINIO}`
  let token
  try {
    token = await registra(email)
  } catch {
    // Esiste gia' come account ma non e' in questa lega: si fa l'accesso e
    // lo si fa entrare, invece di lasciarlo fuori per un nome occupato.
    token = await accedi(email)
  }

  const r = await rpc(token, 'entra_in_lega', {
    p_codice: lega.invite_code,
    p_nome_squadra: n.squadra,
  })
  const esito = r.corpo?.[0]
  if (esito?.esito !== 'ok') {
    console.log(`  ✗ ${email}: ${esito?.messaggio ?? JSON.stringify(r.corpo)}`)
    continue
  }
  creati.push({ email, squadra: n.squadra })
  console.log(`  ✓ ${email}   ${n.squadra}`)
}

const totale = (await sql(`select count(*)::int n from public.teams
  where league_id = ${cita(lega.id)};`))[0].n

console.log(`\n«${lega.name}» ha adesso ${totale} squadre.`)
console.log(`Per entrare come uno di loro: la sua email qui sopra, password ${PASSWORD}.`)
if (totale >= 2) {
  console.log('\nBastano per aprire l\'asta: apri le impostazioni della lega e falla partire.')
}
