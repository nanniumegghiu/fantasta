// ═══════════════════════════════════════════════════════════════════════════
// Riporta una lega a prima dell'asta.
//
// ⚠️  CANCELLA DATI VERI. Via le rose, via i crediti spesi, via i lotti, via il
//     registro della serata. Restano la lega, le squadre, i partecipanti, il
//     codice di invito e le liste obiettivi di ciascuno.
//
// PERCHE' ESISTE
//
// Fra una prova e l'altra la lega si riempie di acquisti finti. Prima
// dell'asta vera va svuotata, e le uniche vie erano cancellare la lega intera
// — perdendo squadre, inviti e liste obiettivi che ognuno si era preparato — o
// toccare il database a mano.
//
// PERCHE' NON E' UN TASTO NELL'APP
//
// Perche' non deve essere comodo. Nell'app c'e' «riapri l'asta», che e' la
// risposta a «ho chiuso per sbaglio»; questo invece butta via una serata di
// gioco, e la risposta giusta a «ho premuto per sbaglio» non e' «pazienza». Un
// attrezzo da riga di comando, che pretende il nome della lega scritto per
// intero, non lo si preme per sbaglio.
//
// PERCHE' IL REGISTRO SE NE VA CON L'ASTA
//
// Il registro e' a sola aggiunta e nessuno lo modifica, nemmeno chi
// amministra: e' quello che rende affidabili i poteri di correzione. Ma qui
// non si sta correggendo niente — si sta buttando via **l'asta intera**, e un
// registro di eventi che non sono mai successi sarebbe piu' fuorviante che
// utile. Se ne va con la sua asta, per cascata, come quando si cancella una
// lega (migrazione 0008).
//
// Uso:
//   node scripts/azzera-asta.mjs --lega Q4C4HQ
//        dice cosa cancellerebbe, e non cancella niente
//   node scripts/azzera-asta.mjs --lega Q4C4HQ --confermo "Champions Cup"
//        lo fa
// ═══════════════════════════════════════════════════════════════════════════

import { argomento, cita, sql, trovaLega } from './lib/amici.mjs'

const lega = await trovaLega()
const conferma = argomento('--confermo')

const [conti] = await sql(`select
    (select count(*) from public.roster_players r where r.league_id = ${cita(lega.id)})::int acquisti,
    (select coalesce(sum(r.price), 0) from public.roster_players r where r.league_id = ${cita(lega.id)})::int spesi,
    (select count(*) from public.auction_lots lo
       join public.auctions a on a.id = lo.auction_id
      where a.league_id = ${cita(lega.id)})::int lotti,
    (select count(*) from public.auction_events e
       join public.auctions a on a.id = e.auction_id
      where a.league_id = ${cita(lega.id)})::int eventi,
    (select count(*) from public.teams t where t.league_id = ${cita(lega.id)})::int squadre;`)

const [stato] = await sql(`select l.status::text lega, l.credits_initial,
    coalesce(a.status::text, 'nessuna') asta
  from public.leagues l left join public.auctions a on a.league_id = l.id
  where l.id = ${cita(lega.id)};`)

console.log(`\nLega «${lega.name}», codice ${lega.invite_code}`)
console.log(`  stato: lega ${stato.lega}, asta ${stato.asta}\n`)
console.log('  Verrebbero cancellati:')
console.log(`    ${conti.acquisti} acquisti, per ${conti.spesi} crediti spesi`)
console.log(`    ${conti.lotti} lotti e ${conti.eventi} righe di registro`)
console.log('\n  Resterebbero:')
console.log(`    la lega, le ${conti.squadre} squadre con i loro partecipanti,`)
console.log(`    il codice di invito, e le liste obiettivi di ciascuno`)
console.log(`    (i crediti tornano a ${stato.credits_initial} per tutti)`)

if (conferma !== lega.name) {
  console.log(
    `\nNon ho toccato niente. Per farlo davvero:\n` +
      `  node scripts/azzera-asta.mjs --lega ${lega.invite_code} --confermo "${lega.name}"`,
  )
  process.exit(0)
}

console.log('\nAzzero.\n')

// L'ordine non e' libero: prima quello che ha riferimenti verso l'alto.
await sql(`delete from public.bids b using public.auction_lots lo, public.auctions a
  where b.lot_id = lo.id and lo.auction_id = a.id and a.league_id = ${cita(lega.id)};`)
await sql(`delete from public.lot_passes p using public.auction_lots lo, public.auctions a
  where p.lot_id = lo.id and lo.auction_id = a.id and a.league_id = ${cita(lega.id)};`)
await sql(`delete from public.roster_players where league_id = ${cita(lega.id)};`)
await sql(`delete from public.auction_lots lo using public.auctions a
  where lo.auction_id = a.id and a.league_id = ${cita(lega.id)};`)

// L'asta se ne va intera, e con lei il registro per cascata: e' l'unico modo
// in cui quelle righe possono sparire, ed e' voluto cosi'.
await sql(`delete from public.auctions where league_id = ${cita(lega.id)};`)

await sql(`update public.teams t set credits_remaining = l.credits_initial
  from public.leagues l where l.id = t.league_id and t.league_id = ${cita(lega.id)};`)
await sql(`update public.leagues set status = 'setup' where id = ${cita(lega.id)};`)

const [dopo] = await sql(`select
    (select count(*) from public.roster_players r where r.league_id = ${cita(lega.id)})::int acquisti,
    (select count(*) from public.auction_lots lo
       join public.auctions a on a.id = lo.auction_id
      where a.league_id = ${cita(lega.id)})::int lotti,
    (select count(*) from public.auctions a where a.league_id = ${cita(lega.id)})::int aste,
    (select string_agg(t.name || ' ' || t.credits_remaining, ' · ' order by t.name)
       from public.teams t where t.league_id = ${cita(lega.id)}) squadre,
    (select status::text from public.leagues where id = ${cita(lega.id)}) lega;`)

console.log(`  acquisti rimasti:  ${dopo.acquisti}`)
console.log(`  lotti rimasti:     ${dopo.lotti}`)
console.log(`  aste rimaste:      ${dopo.aste}`)
console.log(`  stato della lega:  ${dopo.lega}`)
console.log(`  squadre:           ${dopo.squadre}`)
console.log('\nFatto. L\'asta si riconfigura e si riapre dall\'app.')
