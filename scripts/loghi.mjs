// ═══════════════════════════════════════════════════════════════════════════
// Gli stemmi delle squadre: dal logopack di Football Manager al listone.
//
// COME TROVA GLI IDENTIFICATIVI, SENZA UNA RICHIESTA IN PIU'
//
// L'identificativo di un club arriva **gratis** insieme ai calciatori: ogni
// documento scaricato porta la sua squadra e l'identificativo di quella
// squadra. Quindi si riusa l'elenco che serviva ai volti, e le venti squadre
// si ricavano contando: la squadra di una riga del listone e' quella che i
// suoi calciatori hanno piu' spesso.
//
// PERCHE' PER MAGGIORANZA E NON PER NOME
//
// Abbinare «Inter» a «F.C. Internazionale Milano» per somiglianza funziona
// finche' una squadra non cambia denominazione. Contare invece quale
// identificativo hanno i calciatori gia' abbinati non dipende da come si
// chiama la squadra: dipende da chi ci gioca, che e' un dato piu' solido.
// Il nome resta come ripiego per le squadre senza nemmeno un calciatore
// abbinato.
//
// Uso:
//   node scripts/loghi.mjs --stato       quante squadre hanno lo stemma
//   node scripts/loghi.mjs --abbina      cosa farebbe, senza fare niente
//   node scripts/loghi.mjs               abbina e carica
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHIAVE,
  ELENCO_FM,
  LOGHI,
  URL_BASE,
  accessoDiServizio,
  chiaveSquadra,
  chiudiAccessoDiServizio,
  scaricaSerieA,
  sql,
} from './lib/fm.mjs'

// ─── La stagione su cui si lavora ───────────────────────────────────────────

const stagione = (await sql(
  "select season, count(*)::int n from public.players where active group by 1 order by n desc limit 1;",
))[0]

if (!stagione) {
  console.error("Non c'è nessun listone caricato: importalo prima dall'app.")
  process.exit(1)
}

if (process.argv.includes('--stato')) {
  const c = (await sql(`select
      (select count(distinct serie_a_team)::int from public.players
       where active and season = '${stagione.season}') squadre,
      (select count(*)::int from public.club_logos where season = '${stagione.season}') con_stemma,
      (select count(*)::int from public.club_logos
       where season = '${stagione.season}' and origine = 'confermata') confermati;`))[0]
  console.log(`Listone ${stagione.season}: ${c.squadre} squadre.`)
  console.log(`  con stemma:  ${c.con_stemma}`)
  console.log(`  senza:       ${c.squadre - c.con_stemma}`)
  console.log(`  confermati a mano: ${c.confermati}`)
  console.log(`\nLogopack in ${LOGHI}: ${existsSync(LOGHI) ? 'trovato' : 'NON trovato'}`)
  process.exit(0)
}

// ─── L'elenco di Football Manager ───────────────────────────────────────────

let elencoFm
const soloAbbinamento = process.argv.includes('--abbina')

if (soloAbbinamento && existsSync(ELENCO_FM)) {
  elencoFm = JSON.parse(readFileSync(ELENCO_FM, 'utf8'))
  console.log(`Riuso l'elenco già scaricato: ${elencoFm.length} calciatori.\n`)
} else {
  console.log("Scarico l'elenco dei calciatori di Serie A (serve per gli identificativi dei club).\n")
  const esito = await scaricaSerieA()
  elencoFm = esito.calciatori
  console.log(`${elencoFm.length} calciatori in ${esito.richieste} richieste.\n`)
}

// L'elenco vecchio potrebbe non avere l'identificativo della squadra: e' stato
// aggiunto dopo. Se manca, si riscarica invece di lavorare su dati a meta'.
if (!elencoFm.some((g) => g.squadra_fm_id)) {
  console.log("L'elenco salvato non ha gli identificativi delle squadre: lo riscarico.\n")
  const esito = await scaricaSerieA()
  elencoFm = esito.calciatori
}

// ─── Le squadre del listone ─────────────────────────────────────────────────

const squadreListone = (await sql(`select serie_a_team, count(*)::int n
  from public.players where active and season = '${stagione.season}'
  group by 1 order by 1;`))

console.log(`${squadreListone.length} squadre nel listone ${stagione.season}.\n`)

/**
 * L'identificativo del club, per maggioranza fra i suoi calciatori.
 *
 * Si contano gli identificativi di squadra che compaiono nei calciatori di
 * Football Manager la cui squadra si riduce alla stessa chiave. Vince il piu'
 * frequente: qualche calciatore appena ceduto non sposta il conto.
 */
function clubDi(nomeListone) {
  const chiave = chiaveSquadra(nomeListone)
  const conta = new Map()
  const nomi = new Map()

  for (const g of elencoFm) {
    if (!g.squadra_fm_id) continue
    if (chiaveSquadra(g.squadra) !== chiave) continue
    conta.set(g.squadra_fm_id, (conta.get(g.squadra_fm_id) ?? 0) + 1)
    nomi.set(g.squadra_fm_id, g.squadra)
  }

  if (conta.size === 0) return null
  const [fmId, quanti] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0]
  return { fmId, quanti, nomeFm: nomi.get(fmId) }
}

const esiti = squadreListone.map((s) => {
  const club = clubDi(s.serie_a_team)
  const file = club ? join(LOGHI, `${club.fmId}.png`) : null
  return {
    squadra: s.serie_a_team,
    calciatori: s.n,
    club,
    haFile: Boolean(file && existsSync(file)),
    file,
  }
})

for (const e of esiti) {
  if (!e.club) {
    console.log(`  ✗ ${e.squadra}: nessuna squadra corrispondente in Football Manager`)
  } else if (!e.haFile) {
    console.log(`  ✗ ${e.squadra} → ${e.club.nomeFm} (fm ${e.club.fmId}): stemma non nel logopack`)
  } else {
    console.log(`  ✓ ${e.squadra} → ${e.club.nomeFm} (fm ${e.club.fmId}, ${e.club.quanti} calciatori)`)
  }
}

const pronti = esiti.filter((e) => e.haFile)
console.log(`\n${pronti.length} stemmi su ${esiti.length} squadre.`)

if (soloAbbinamento) {
  console.log('\nNiente è stato caricato: era solo una prova. Rilancia senza --abbina.')
  process.exit(0)
}

// ─── Il caricamento ─────────────────────────────────────────────────────────

const { token, email } = await accessoDiServizio('caricatore.loghi')
const righe = []
let caricati = 0

for (const e of pronti) {
  // Il nome del file è la squadra normalizzata, non il suo nome com'è scritto:
  // «Hellas Verona» e «F.C. Internazionale Milano» contengono spazi e punti, e
  // un percorso d'archivio con quelli dentro è una fonte di guai gratuita.
  const percorso = `${stagione.season}/${chiaveSquadra(e.squadra).replace(/ /g, '-')}.png`

  const r = await fetch(`${URL_BASE}/storage/v1/object/loghi/${percorso}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: readFileSync(e.file),
  })
  if (!r.ok) {
    console.log(`  ✗ ${e.squadra}: ${r.status} ${(await r.text()).slice(0, 120)}`)
    continue
  }

  righe.push({
    stagione: stagione.season,
    squadra: e.squadra,
    fm_id: e.club.fmId,
    percorso,
    origine: 'scaricata',
  })
  caricati++
}

const r = await fetch(`${URL_BASE}/rest/v1/rpc/imposta_loghi`, {
  method: 'POST',
  headers: {
    apikey: CHIAVE,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_righe: righe }),
})
const conto = await r.json().catch(() => null)
const riga = Array.isArray(conto) ? conto[0] : conto

await chiudiAccessoDiServizio(email)

console.log(`\n${caricati} stemmi caricati.`)
if (riga) {
  console.log(
    `Corrispondenze scritte: ${riga.aggiornati}` +
      (riga.saltati ? `, saltate ${riga.saltati} perché confermate a mano.` : '.'),
  )
}
console.log('\nStato aggiornato: node scripts/loghi.mjs --stato')
