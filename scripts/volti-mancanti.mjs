// ═══════════════════════════════════════════════════════════════════════════
// Chi resta senza faccia, e per quale dei tre motivi possibili.
//
// PERCHE' TRE ELENCHI E NON UNO
//
// «Manca la foto» nasconde tre situazioni diverse, che si risolvono in tre
// modi diversi. Metterle insieme fa perdere tempo sul problema sbagliato:
//
//   NON ABBINATO      il nome non ha trovato nessuno. Si risolve cercando
//                     meglio, o a mano.
//   ABBINATO SENZA FILE  il nome ha trovato la persona giusta, ma quel volto
//                     nel facepack non c'e'. Nessuna regola di abbinamento
//                     lo fara' comparire: o si scarica un facepack piu'
//                     completo, o resta cosi'.
//   AMBIGUO           piu' di un candidato e nessun modo di distinguerli.
//                     Va guardato da una persona.
//
// Uso:  node scripts/volti-mancanti.mjs
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ELENCO_EXTRA, ELENCO_FM, VOLTI, sql } from './lib/fm.mjs'

const stagione = (await sql(
  "select season from public.players where active group by 1 order by count(*) desc limit 1;",
))[0].season

const senzaVolto = await sql(`select id, name, role, serie_a_team, fm_id, quotation
  from public.players
  where active and season = '${stagione}' and photo_path is null
  order by quotation desc, name;`)

console.log(`Listone ${stagione}: ${senzaVolto.length} calciatori senza faccia.\n`)

// L'elenco di Football Manager, per capire se l'abbinamento c'era.
function leggi(percorso) {
  try {
    return JSON.parse(readFileSync(percorso, 'utf8'))
  } catch {
    return []
  }
}
const elenco = [...leggi(ELENCO_FM), ...leggi(ELENCO_EXTRA)]
const perFm = new Map(elenco.map((g) => [String(g.fm_id), g]))

const abbinatiSenzaFile = []
const nonAbbinati = []

for (const c of senzaVolto) {
  if (c.fm_id) {
    const fm = perFm.get(String(c.fm_id))
    abbinatiSenzaFile.push({ ...c, nomeFm: fm?.nome ?? '(non nell elenco locale)' })
  } else {
    nonAbbinati.push(c)
  }
}

console.log(`── ABBINATI, ma il volto non e' nel facepack: ${abbinatiSenzaFile.length}`)
console.log('   Nessuna regola di abbinamento li fara\' comparire.\n')
for (const c of abbinatiSenzaFile) {
  const dove = join(VOLTI, `${c.fm_id}.png`)
  console.log(
    `   ${c.name.padEnd(22)} ${String(c.serie_a_team).padEnd(12)} ${c.role}  ` +
      `fm ${String(c.fm_id).padEnd(11)} → ${c.nomeFm}` +
      (existsSync(dove) ? '   ⚠ il file c\'e\' davvero!' : ''),
  )
}

console.log(`\n── NON ABBINATI: ${nonAbbinati.length}`)
console.log('   Il nome non ha trovato nessuno: e\' qui che si puo\' cercare meglio.\n')
for (const c of nonAbbinati) {
  console.log(
    `   ${c.name.padEnd(22)} ${String(c.serie_a_team).padEnd(12)} ${c.role}  ` +
      `quotazione ${c.quotation}`,
  )
}

console.log(`\nIn tutto: ${senzaVolto.length} senza faccia su ${
  (await sql(`select count(*)::int n from public.players where active and season = '${stagione}';`))[0].n
}.`)
