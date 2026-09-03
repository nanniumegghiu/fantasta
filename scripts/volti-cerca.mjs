// ═══════════════════════════════════════════════════════════════════════════
// Chi non si è abbinato, cercato per nome, una grafia alla volta.
//
// PERCHE' NON BASTA LO SCARICAMENTO IN BLOCCO
//
// L'elenco della Serie A si scarica tutto insieme e poi si abbina in casa: è
// veloce, è una richiesta ogni 250 calciatori, ed è la regola di ADR-0011.
// Funziona finché i due nomi si somigliano. Non funziona quando:
//
//   · il listone scrive il cognome e il gioco il nome d'arte
//     («Robinho Junior» sta nel gioco come «Robson de Souza Junior»);
//   · il calciatore nel gioco è in un'altra squadra, o in un'altra divisione,
//     e nello scaricamento della Serie A non compare affatto;
//   · le lettere sono le stesse ma scritte in un altro alfabeto.
//
// Per questi la ricerca a testo libero del servizio trova quello che il
// confronto fra stringhe non trova, perché lei sa che «Robinho» e «Robson de
// Souza» sono la stessa persona: glielo dicono i suoi search_terms.
//
// PERCHE' NON VIOLA ADR-0011
//
// ADR-0011 vieta di interrogare il servizio **un calciatore alla volta durante
// l'asta**, per non dipendere da un indirizzo non documentato nel momento in
// cui tutto deve funzionare. Qui siamo nel caso opposto: una manciata di
// richieste, una tantum, a tavolino, su chi è rimasto fuori. Se il servizio
// non risponde non succede niente: restano le facce che ci sono già.
//
// COSA NON FA
//
// Non scrive niente. Propone, e chi guarda decide: la conferma passa da
// `node scripts/volti.mjs --manuale`, che è l'unico posto dove si può scrivere
// «confermata».
//
// Uso:  node scripts/volti-cerca.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { RICERCA, VOLTI, chiaveSquadra, normalizza, sql } from './lib/fm.mjs'

const stagione = (
  await sql(
    'select season from public.players where active group by 1 order by count(*) desc limit 1;',
  )
)[0].season

const mancanti = await sql(`select id, name, role, serie_a_team, quotation
  from public.players
  where active and season = '${stagione}' and photo_path is null
  order by quotation desc, name;`)

/**
 * Le grafie da provare, dalla più fedele alla più larga.
 *
 * L'ordine conta: la prima che restituisce qualcosa vince, e si vuole che sia
 * la più specifica. «Martinez Jo.» cercato tale e quale non trova niente;
 * «Martinez» trova quaranta Martinez. In mezzo c'è la grafia giusta.
 */
function grafie(nome) {
  const g = []
  const pulito = normalizza(nome)
  g.push(pulito)

  const parole = pulito.split(' ')
  // Senza le iniziali puntate in coda: «Martinez Jo.» → «Martinez».
  let senza = [...parole]
  while (senza.length > 1 && senza[senza.length - 1].length <= 2) senza = senza.slice(0, -1)
  if (senza.length < parole.length) g.push(senza.join(' '))

  // Solo l'ultima parola: per i nomi composti che il gioco scrive al contrario.
  if (senza.length > 1) g.push(senza[senza.length - 1])

  return [...new Set(g)].filter(Boolean)
}

async function cerca(testo) {
  const indirizzo =
    `${RICERCA.host}/collections/${RICERCA.raccolta}/documents/search?` +
    new URLSearchParams({
      q: testo,
      query_by: 'name,search_terms',
      filter_by: 'classification_id:=player',
      sort_by: '_text_match:desc,reputation:desc',
      per_page: '8',
    })
  const r = await fetch(indirizzo, { headers: { 'X-TYPESENSE-API-KEY': RICERCA.chiave } })
  if (!r.ok) return []
  const j = await r.json()
  return (j.hits ?? [])
    .map((h) => h.document)
    .filter((d) => d.fm_id)
    .map((d) => ({
      fm_id: Number(d.fm_id),
      nome: d.name,
      squadra: d.team?.name ?? '',
      divisione: d.division?.name ?? '',
      reputazione: d.reputation ?? 0,
    }))
}

const sicuri = []
const daGuardare = []
let richieste = 0

for (const c of mancanti) {
  const squadraListone = chiaveSquadra(c.serie_a_team)
  let trovati = []
  let grafiaUsata = null

  for (const g of grafie(c.name)) {
    richieste++
    const r = await cerca(g)
    if (r.length) {
      trovati = r
      grafiaUsata = g
      break
    }
  }

  const arricchiti = trovati.map((t) => ({
    ...t,
    stessaSquadra: chiaveSquadra(t.squadra) === squadraListone,
    volto: existsSync(join(VOLTI, `${t.fm_id}.png`)),
  }))

  // Uno solo, nella squadra giusta, e il volto c'è: non c'è niente da decidere.
  const netti = arricchiti.filter((t) => t.stessaSquadra && t.volto)
  if (netti.length === 1) sicuri.push({ calciatore: c, fm: netti[0], grafia: grafiaUsata })
  else daGuardare.push({ calciatore: c, candidati: arricchiti, grafia: grafiaUsata })
}

console.log(`${mancanti.length} senza volto, ${richieste} richieste al servizio.\n`)

console.log(`── UNO SOLO, SQUADRA GIUSTA, VOLTO PRESENTE: ${sicuri.length}`)
console.log('   Si confermano con: node scripts/volti.mjs --manuale\n')
for (const s of sicuri) {
  console.log(
    `   ${s.calciatore.name.padEnd(18)} ${String(s.calciatore.serie_a_team).padEnd(11)} ` +
      `${s.calciatore.role} → ${s.fm.nome} (fm ${s.fm.fm_id})`,
  )
}

console.log(`\n── DA GUARDARE: ${daGuardare.length}\n`)
for (const d of daGuardare) {
  const c = d.calciatore
  console.log(`   ${c.name} · ${c.serie_a_team} · ${c.role} · quotazione ${c.quotation}`)
  if (!d.candidati.length) {
    console.log('      nessun risultato, con nessuna grafia provata')
  }
  for (const t of d.candidati.slice(0, 5)) {
    console.log(
      `      ${t.volto ? '✔' : '·'} ${t.nome.padEnd(26)} ${t.squadra.padEnd(24)} ` +
        `${t.divisione.padEnd(18)} fm ${t.fm_id}${t.stessaSquadra ? '   ← stessa squadra' : ''}`,
    )
  }
  console.log('')
}
console.log('✔ = il volto è nel facepack.  Niente è stato scritto.')
