// ═══════════════════════════════════════════════════════════════════════════
// Verifica dell'esportazione delle rose.
//
// PERCHE' QUESTE PROVE ESISTONO
//
// Il file esportato e' l'ultimo passaggio di tutta la serata: se non si carica
// nell'app Fantacalcio, tre ore d'asta non hanno prodotto niente. E il modo in
// cui un CSV si rompe e' subdolo: non da' errore, sposta le colonne di uno e
// il portiere di qualcuno diventa il prezzo di qualcun altro.
//
// Le prove che contano di piu' sono quelle sui nomi che contengono il
// separatore, le virgolette o un ritorno a capo. Nessuno chiama la sua squadra
// «Bomber; il ritorno» apposta per rompere il file, ma prima o poi qualcuno lo
// fa per scherzo, e quella sera nessuno ha voglia di capire perche'.
//
// Non tocca il database: e' logica pura, e si prova come tale.
//
// Uso:  node --experimental-strip-types scripts/verifica-esportazione.mjs
// ═══════════════════════════════════════════════════════════════════════════

const { componiCsv, controlla, nomeFile, ordina, proteggi, INTESTAZIONI } = await import(
  '../app/src/domain/esportazione.ts'
)

const esiti = []
function esito(nome, ok, dettaglio) {
  esiti.push({ nome, ok })
  console.log(`${ok ? '  OK  ' : ' FALLITA '} ${nome}`)
  console.log(`         ${dettaglio}`)
}

/** Rilegge un CSV come farebbe un lettore che rispetta le regole. */
function rileggi(testo, separatore) {
  const righe = []
  let campo = ''
  let riga = []
  let dentroVirgolette = false

  for (let i = 0; i < testo.length; i++) {
    const c = testo[i]
    if (dentroVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campo += '"'
          i++
        } else dentroVirgolette = false
      } else campo += c
      continue
    }
    if (c === '"') dentroVirgolette = true
    else if (c === separatore) {
      riga.push(campo)
      campo = ''
    } else if (c === '\r') {
      // si ignora: il fine riga è \r\n
    } else if (c === '\n') {
      riga.push(campo)
      righe.push(riga)
      riga = []
      campo = ''
    } else campo += c
  }
  if (campo || riga.length) {
    riga.push(campo)
    righe.push(riga)
  }
  return righe
}

// ─── 1. Le colonne sono quelle delle istruzioni ufficiali ───────────────────

const semplici = [
  { id: 2764, calciatore: 'Martinez L.', fantasquadra: 'Real Sciacallo', prezzo: 210 },
  { id: 254, calciatore: 'Dimarco', fantasquadra: 'Real Sciacallo', prezzo: 45 },
]

const csv = componiCsv(semplici, ';')
const letto = rileggi(csv, ';')

esito(
  'Le quattro colonne sono quelle di ADR-0008, in quell ordine',
  JSON.stringify(letto[0]) === JSON.stringify([...INTESTAZIONI]),
  `intestazioni: ${letto[0].join(' | ')}`,
)

esito(
  'Ogni acquisto diventa una riga con identificativo, nome, squadra e prezzo',
  letto.length === 3 &&
    letto[1][0] === '2764' &&
    letto[1][1] === 'Martinez L.' &&
    letto[1][2] === 'Real Sciacallo' &&
    letto[1][3] === '210',
  `prima riga: ${letto[1].join(' | ')}`,
)

esito(
  'Il file finisce con un ritorno a capo',
  csv.endsWith('\r\n'),
  `ultimi caratteri: ${JSON.stringify(csv.slice(-4))}`,
)

// ─── 2. I nomi che romperebbero il file ─────────────────────────────────────

const cattivi = [
  { id: 1, calciatore: 'Rossi', fantasquadra: 'Bomber; il ritorno', prezzo: 10 },
  { id: 2, calciatore: 'Bianchi', fantasquadra: 'I "Cannonieri"', prezzo: 20 },
  { id: 3, calciatore: 'Verdi, detto il Lungo', fantasquadra: 'Normale', prezzo: 30 },
  { id: 4, calciatore: 'Gialli', fantasquadra: 'Prima riga\nSeconda riga', prezzo: 40 },
]

for (const sep of [';', ',']) {
  const testo = componiCsv(cattivi, sep)
  const r = rileggi(testo, sep)
  const corpo = r.slice(1)
  const tutteQuattro = corpo.every((riga) => riga.length === 4)
  const combaciano = corpo.every(
    (riga, i) =>
      riga[0] === String(cattivi[i].id) &&
      riga[1] === cattivi[i].calciatore &&
      riga[2] === cattivi[i].fantasquadra &&
      riga[3] === String(cattivi[i].prezzo),
  )
  esito(
    `Nomi con separatori, virgolette e ritorni a capo sopravvivono al giro (separatore "${sep}")`,
    corpo.length === 4 && tutteQuattro && combaciano,
    `${corpo.length} righe rilette, tutte di quattro campi: ${tutteQuattro}, identiche all originale: ${combaciano}`,
  )
}

esito(
  'Un campo innocuo non viene messo fra virgolette senza motivo',
  proteggi('Dimarco', ';') === 'Dimarco' && proteggi('Bomber; il ritorno', ';').startsWith('"'),
  `«Dimarco» resta «${proteggi('Dimarco', ';')}»`,
)

esito(
  'La virgola non e speciale quando il separatore e il punto e virgola',
  proteggi('Verdi, detto il Lungo', ';') === 'Verdi, detto il Lungo',
  `resta «${proteggi('Verdi, detto il Lungo', ';')}»`,
)

// ─── 3. L'ordine, per chi il file lo apre a controllarlo ────────────────────

const mescolate = [
  { fantasquadra: 'Zeta', ruolo: 'A', prezzo: 5, calciatore: 'Uno' },
  { fantasquadra: 'Alfa', ruolo: 'A', prezzo: 100, calciatore: 'Due' },
  { fantasquadra: 'Alfa', ruolo: 'P', prezzo: 10, calciatore: 'Tre' },
  { fantasquadra: 'Alfa', ruolo: 'A', prezzo: 200, calciatore: 'Quattro' },
]
const ordinate = ordina(mescolate)
esito(
  'Le righe escono per squadra, poi per reparto, poi dal piu caro',
  ordinate[0].calciatore === 'Tre' &&
    ordinate[1].calciatore === 'Quattro' &&
    ordinate[2].calciatore === 'Due' &&
    ordinate[3].fantasquadra === 'Zeta',
  ordinate.map((r) => `${r.fantasquadra}/${r.ruolo}/${r.prezzo}`).join(' → '),
)

// ─── 4. Gli avvertimenti ────────────────────────────────────────────────────

const vuoto = controlla([], [])
esito(
  'Un file che sarebbe vuoto viene fermato prima di scaricarlo',
  vuoto.length === 1 && vuoto[0].grave === true,
  `${vuoto[0]?.testo}`,
)

const incomplete = controlla(semplici, [
  { nome: 'Real Sciacallo', slotMancanti: 3 },
  { nome: 'Atletico Divano', slotMancanti: 0 },
])
esito(
  'Le squadre con slot vuoti si segnalano, ma non bloccano',
  incomplete.some((a) => !a.grave && a.testo.includes('Real Sciacallo')) &&
    !incomplete.some((a) => a.grave),
  `${incomplete.map((a) => a.testo).join(' · ')}`,
)

const nomiStrani = controlla(
  [{ id: 1, calciatore: 'Rossi', fantasquadra: ' Spazi ai bordi ', prezzo: 1 }],
  [{ nome: ' Spazi ai bordi ', slotMancanti: 0 }],
)
esito(
  'Un nome di squadra con spazi ai bordi viene segnalato',
  nomiStrani.some((a) => a.testo.includes('Spazi ai bordi')),
  `${nomiStrani.map((a) => a.testo).join(' · ')}`,
)

const senzaId = controlla(
  [{ id: 0, calciatore: 'Rossi', fantasquadra: 'Squadra', prezzo: 1 }],
  [{ nome: 'Squadra', slotMancanti: 0 }],
)
esito(
  'Righe senza identificativo bloccano: le omonimie andrebbero a caso',
  senzaId.some((a) => a.grave),
  `${senzaId.filter((a) => a.grave).map((a) => a.testo).join(' · ')}`,
)

// ─── 5. Il nome del file ────────────────────────────────────────────────────

const nome = nomeFile('Champions Cup', '2026/27', false)
esito(
  'Il nome del file dice lega, stagione, cosa contiene e quando',
  /^champions-cup-2026-27-tutte-le-rose-\d{4}-\d{2}-\d{2}\.csv$/.test(nome),
  nome,
)

esito(
  'Accenti e caratteri strani non finiscono nel nome del file',
  /^[a-z0-9.-]+$/.test(nomeFile('Lega dei Perdènti!!', '2026/27', true)),
  nomeFile('Lega dei Perdènti!!', '2026/27', true),
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Il file esportato regge anche i nomi scritti per scherzo.')
