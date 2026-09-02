// ═══════════════════════════════════════════════════════════════════════════
// Verifica della Fetta 2: lettura dei file e importazione del listone.
//
// Costruisce da zero un .xlsx e un .csv che imitano i file ufficiali, compresa
// la riga di titolo sopra le intestazioni e i numeri con la virgola. Poi li fa
// leggere all'importatore e controlla che abbia capito, che scarti cio' che
// deve scartare, e che l'importazione nel database sia ripetibile.
//
// Uso:  node --experimental-strip-types scripts/verifica-listone.mjs [--pulisci]
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const { leggiCsv, leggiXlsx } = await import('../app/src/domain/fogli.ts')
const { interpretaListone, interpretaStatistiche } = await import('../app/src/domain/listone.ts')

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
  await sql('delete from public.player_stats;')
  await sql('delete from public.players;')
  await sql("delete from public.app_admin_emails where email like '%@fantasta.test';")
  await sql("delete from auth.users where email like '%@fantasta.test';")
  console.log('Listone, statistiche e utenti di prova rimossi.')
  process.exit(0)
}

const esiti = []
function esito(nome, ok, dettaglio) {
  esiti.push({ nome, ok })
  console.log(`${ok ? '  OK  ' : ' FALLITA '} ${nome}`)
  console.log(`         ${dettaglio}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// Costruzione di un vero .xlsx, senza librerie
// ═══════════════════════════════════════════════════════════════════════════

const tabellaCrc = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (b) => {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = tabellaCrc[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function creaZip(file) {
  const voci = []
  const pezzi = []
  let offset = 0

  for (const [nome, testo] of Object.entries(file)) {
    const dati = Buffer.from(testo, 'utf8')
    // Compresso davvero: cosi' si prova anche il ramo con `deflate-raw`.
    const compressi = zlib.deflateRawSync(dati, { level: 6 })
    const nomeBuf = Buffer.from(nome, 'utf8')
    const testa = Buffer.alloc(30)
    testa.writeUInt32LE(0x04034b50, 0)
    testa.writeUInt16LE(20, 4)
    testa.writeUInt16LE(8, 8) // metodo deflate
    testa.writeUInt32LE(crc32(dati), 14)
    testa.writeUInt32LE(compressi.length, 18)
    testa.writeUInt32LE(dati.length, 22)
    testa.writeUInt16LE(nomeBuf.length, 26)
    pezzi.push(testa, nomeBuf, compressi)
    voci.push({ nome: nomeBuf, crc: crc32(dati), compressi: compressi.length, originali: dati.length, offset })
    offset += testa.length + nomeBuf.length + compressi.length
  }

  const inizioIndice = offset
  for (const v of voci) {
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(20, 4)
    c.writeUInt16LE(20, 6)
    c.writeUInt16LE(8, 10)
    c.writeUInt32LE(v.crc, 16)
    c.writeUInt32LE(v.compressi, 20)
    c.writeUInt32LE(v.originali, 24)
    c.writeUInt16LE(v.nome.length, 28)
    c.writeUInt32LE(v.offset, 42)
    pezzi.push(c, v.nome)
    offset += 46 + v.nome.length
  }

  const fine = Buffer.alloc(22)
  fine.writeUInt32LE(0x06054b50, 0)
  fine.writeUInt16LE(voci.length, 8)
  fine.writeUInt16LE(voci.length, 10)
  fine.writeUInt32LE(offset - inizioIndice, 12)
  fine.writeUInt32LE(inizioIndice, 16)
  pezzi.push(fine)

  return Buffer.concat(pezzi)
}

const scappa = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function creaXlsx(righe) {
  // Le stringhe vanno nel magazzino condiviso, come fa Excel davvero.
  const magazzino = []
  const indiceDi = (s) => {
    let i = magazzino.indexOf(s)
    if (i < 0) {
      magazzino.push(s)
      i = magazzino.length - 1
    }
    return i
  }

  const lettera = (n) => {
    let s = ''
    n++
    while (n > 0) {
      const r = (n - 1) % 26
      s = String.fromCharCode(65 + r) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  }

  const xmlRighe = righe
    .map((riga, y) => {
      const celle = riga
        .map((valore, x) => {
          const rif = `${lettera(x)}${y + 1}`
          if (valore === '' || valore == null) return ''
          if (typeof valore === 'number') return `<c r="${rif}"><v>${valore}</v></c>`
          return `<c r="${rif}" t="s"><v>${indiceDi(String(valore))}</v></c>`
        })
        .join('')
      return `<row r="${y + 1}">${celle}</row>`
    })
    .join('')

  const sheet =
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${xmlRighe}</sheetData></worksheet>`
  const shared =
    `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${magazzino.length}" uniqueCount="${magazzino.length}">` +
    magazzino.map((s) => `<si><t>${scappa(s)}</t></si>`).join('') +
    '</sst>'

  return creaZip({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tutti" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
    'xl/sharedStrings.xml': shared,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// I dati di prova: sporchi come quelli veri
// ═══════════════════════════════════════════════════════════════════════════

const RIGHE_LISTONE = [
  ['Quotazioni Fantacalcio Stagione 2026 27', '', '', '', '', '', ''],
  ['Id', 'R', 'RM', 'Nome', 'Squadra', 'Qt.A', 'Qt.A M'],
  [2764, 'A', 'Pc', 'Lautaro Martinez', 'Inter', 35, 34],
  [571, 'P', 'Por', 'Di Gregorio', 'Juventus', 15, 14],
  [4220, 'd', 'Dc', "Dell'Orco", 'Lecce', 6, 6],
  [138, 'C', 'M;C', 'Çalhanoğlu', 'Inter', 22, 21],
  [999, 'C', 'C', '', 'Como', 5, 5],
  [2764, 'A', 'Pc', 'Doppione da scartare', 'Inter', 35, 34],
  ['', 'A', 'Pc', 'Senza identificativo', 'Roma', 12, 12],
  [777, 'Z', '?', 'Ruolo strano', 'Pisa', 4, 4],
  [321, 'A', 'Pc', 'Kean', 'Fiorentina', 28, 27],
  ['', '', '', '', '', '', ''],
]

const RIGHE_STATISTICHE = [
  ['Statistiche Fantacalcio Stagione 2026 27', '', '', '', '', '', '', '', '', ''],
  ['Id', 'R', 'Nome', 'Squadra', 'Pv', 'Mv', 'Fm', 'Gf', 'Ass', 'Amm', 'Esp'],
  [2764, 'A', 'Lautaro Martinez', 'Inter', '12', '6,58', '8,25', '7', '3', '2', '0'],
  [571, 'P', 'Di Gregorio', 'Juventus', '13', '6,15', '5,92', '0', '0', '1', '0'],
  [138, 'C', 'Çalhanoğlu', 'Inter', '11', '6,45', '7,10', '4', '2', '3', '1'],
  [321, 'A', 'Kean', 'Fiorentina', '13', '6,73', '8,90', '9', '1', '2', '0'],
  [88888, 'A', 'Non nel listone', 'Ignota', '1', '6,00', '6,00', '0', '0', '0', '0'],
]

// ═══════════════════════════════════════════════════════════════════════════
// 1. Lettura dei file
// ═══════════════════════════════════════════════════════════════════════════

const xlsx = creaXlsx(RIGHE_LISTONE)
const cartellaProva = join(radice, 'dati-privati')
try {
  writeFileSync(join(cartellaProva, 'prova-listone.xlsx'), xlsx)
} catch {
  // La cartella potrebbe non esistere: non è un problema, serviva solo per
  // poter aprire il file a mano in caso di dubbio.
}

const daXlsx = await leggiXlsx(new Uint8Array(xlsx))
esito(
  'Legge un vero .xlsx compresso',
  daXlsx.length === RIGHE_LISTONE.length && daXlsx[1][3] === 'Nome',
  `${daXlsx.length} righe lette, intestazione riconosciuta: "${daXlsx[1]?.join(' | ')}"`,
)

esito(
  'Regge accenti e apostrofi',
  daXlsx.some((r) => r[3] === 'Çalhanoğlu') && daXlsx.some((r) => r[3] === "Dell'Orco"),
  `trovati: ${daXlsx.filter((r) => /Çal|Orco/.test(r[3] ?? '')).map((r) => r[3]).join(', ')}`,
)

const csvTesto = RIGHE_LISTONE.map((r) => r.map((c) => `"${String(c)}"`).join(';')).join('\r\n')
const daCsv = leggiCsv(csvTesto)
esito(
  'Legge un CSV con punto e virgola e virgolette',
  daCsv.length === RIGHE_LISTONE.length && daCsv[2][3] === 'Lautaro Martinez',
  `${daCsv.length} righe, terza riga: ${daCsv[2]?.slice(0, 5).join(' | ')}`,
)

// ═══════════════════════════════════════════════════════════════════════════
// 2. Interpretazione
// ═══════════════════════════════════════════════════════════════════════════

const listone = interpretaListone(daXlsx)

esito(
  'Salta la riga di titolo e trova le intestazioni',
  listone.rigaIntestazione === 2,
  `intestazioni alla riga ${listone.rigaIntestazione}, colonne usate: ${JSON.stringify(listone.colonne)}`,
)

esito(
  'Prende la quotazione del Classic, non quella del Mantra',
  listone.righe.find((r) => r.id === 2764)?.quotazione === 35,
  `Lautaro: Qt.A ${listone.righe.find((r) => r.id === 2764)?.quotazione} (nel file Qt.A M vale 34)`,
)

esito(
  'Riconosce il ruolo anche scritto minuscolo',
  listone.righe.find((r) => r.id === 4220)?.ruolo === 'D',
  `Dell'Orco, nel file "d", interpretato "${listone.righe.find((r) => r.id === 4220)?.ruolo}"`,
)

const motivi = listone.scartate.map((s) => s.motivo).sort()
esito(
  'Scarta le righe rotte e dice perche',
  listone.righe.length === 5 &&
    motivi.join(', ') ===
      'identificativo mancante, identificativo ripetuto, nome mancante, ruolo non riconosciuto',
  `${listone.righe.length} righe buone, ${listone.scartate.length} scartate: ${motivi.join(', ')}`,
)

const statistiche = interpretaStatistiche(leggiCsv(
  RIGHE_STATISTICHE.map((r) => r.join(';')).join('\n'),
))

esito(
  'Legge le medie con la virgola decimale',
  statistiche.righe.find((r) => r.id === 2764)?.media === 6.58,
  `Lautaro: nel file "6,58", interpretato ${statistiche.righe.find((r) => r.id === 2764)?.media}`,
)

esito(
  'Dichiara le colonne che nel file non ci sono',
  statistiche.mancanti.includes('minuti'),
  `mancanti: ${statistiche.mancanti.join(', ') || 'nessuna'} — i minuti giocati non sono nel file ufficiale delle statistiche`,
)

// ═══════════════════════════════════════════════════════════════════════════
// 3. Importazione nel database
// ═══════════════════════════════════════════════════════════════════════════

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

async function rpc(u, funzione, corpo) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${funzione}`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      ...(u ? { Authorization: `Bearer ${u.token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo ?? {}),
  })
  const corpoRisposta = await r.json().catch(() => null)
  return { stato: r.status, riga: Array.isArray(corpoRisposta) ? corpoRisposta[0] : corpoRisposta }
}

async function leggi(u, percorso) {
  const r = await fetch(`${URL_BASE}/rest/v1/${percorso}`, {
    headers: { apikey: CHIAVE, ...(u ? { Authorization: `Bearer ${u.token}` } : {}) },
  })
  return { stato: r.status, corpo: await r.json().catch(() => null) }
}

const normale = await registra('normale')
const amministratore = await registra('amm')
await sql(`insert into public.app_admins (user_id) values ('${amministratore.id}')
           on conflict do nothing;`)

const daNonAdmin = await rpc(normale, 'importa_listone', {
  p_stagione: '2026/27',
  p_righe: listone.righe,
})
esito(
  'Un utente qualunque NON puo caricare il listone',
  daNonAdmin.riga?.esito === 'non_autorizzato',
  `esito: ${daNonAdmin.riga?.esito} · ${daNonAdmin.riga?.messaggio}`,
)

const primaImportazione = await rpc(amministratore, 'importa_listone', {
  p_stagione: '2026/27',
  p_righe: listone.righe,
})
esito(
  'L amministratore carica il listone',
  primaImportazione.riga?.esito === 'ok' && primaImportazione.riga?.inseriti === 5,
  `inseriti ${primaImportazione.riga?.inseriti}, aggiornati ${primaImportazione.riga?.aggiornati}, ritirati ${primaImportazione.riga?.ritirati}`,
)

const seconda = await rpc(amministratore, 'importa_listone', {
  p_stagione: '2026/27',
  p_righe: listone.righe,
})
const quanti = (await sql('select count(*)::int as n from public.players;'))[0].n
esito(
  'Ricaricare lo stesso file non crea doppioni',
  seconda.riga?.inseriti === 0 && quanti === 5,
  `seconda importazione: 0 nuovi, ${seconda.riga?.aggiornati} aggiornati, in tabella ${quanti} calciatori`,
)

const ridotto = listone.righe.filter((r) => r.id !== 321)
const terza = await rpc(amministratore, 'importa_listone', {
  p_stagione: '2026/27',
  p_righe: ridotto,
})
const kean = (await sql("select active from public.players where id = 321;"))[0]
esito(
  'Chi sparisce dal listone non viene cancellato, solo ritirato',
  terza.riga?.ritirati === 1 && kean.active === false,
  `ritirati ${terza.riga?.ritirati}; Kean è ancora nel database con active = ${kean.active}`,
)

const stat = await rpc(amministratore, 'importa_statistiche', {
  p_stagione: '2026/27',
  p_giornata: 13,
  p_righe: statistiche.righe,
})
esito(
  'Le statistiche entrano e quelle senza calciatore vengono ignorate',
  stat.riga?.esito === 'ok' && stat.riga?.aggiornati === 4 && stat.riga?.ignorati === 1,
  `aggiornate ${stat.riga?.aggiornati}, ignorate ${stat.riga?.ignorati} · ${stat.riga?.messaggio}`,
)

const vista = await leggi(normale, 'listone?select=name,role,quotation,avg_vote,goals,matchday&id=eq.2764')
esito(
  'Chiunque abbia fatto l accesso legge il listone con le statistiche unite',
  vista.corpo?.[0]?.name === 'Lautaro Martinez' && Number(vista.corpo?.[0]?.avg_vote) === 6.58,
  `HTTP ${vista.stato}: ${JSON.stringify(vista.corpo?.[0])}`,
)

const senzaAccesso = await leggi(null, 'listone?select=name&limit=1')
esito(
  'Senza accesso il listone non si legge',
  !Array.isArray(senzaAccesso.corpo) || senzaAccesso.corpo.length === 0,
  `HTTP ${senzaAccesso.stato}, righe: ${JSON.stringify(senzaAccesso.corpo)?.slice(0, 80)}`,
)

const scrivaDiretta = await fetch(`${URL_BASE}/rest/v1/players`, {
  method: 'POST',
  headers: {
    apikey: CHIAVE,
    Authorization: `Bearer ${normale.token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ id: 1, season: '2026/27', name: 'Abusivo', role: 'A', serie_a_team: 'X' }),
})
esito(
  'Nessuno scrive nel listone passando dalla tabella',
  scrivaDiretta.status >= 400,
  `HTTP ${scrivaDiretta.status}: ${(await scrivaDiretta.text()).slice(0, 90)}`,
)

// ─── Riepilogo ──────────────────────────────────────────────────────────────

const fallite = esiti.filter((e) => !e.ok)
console.log(`\n${esiti.length - fallite.length} superate su ${esiti.length}.`)
if (fallite.length) {
  console.error('PROVE FALLITE:')
  for (const f of fallite) console.error(`  - ${f.nome}`)
  process.exit(1)
}
console.log('Pulisci con: node --experimental-strip-types scripts/verifica-listone.mjs --pulisci')
