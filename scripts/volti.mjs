// ═══════════════════════════════════════════════════════════════════════════
// I volti dei calciatori: dal facepack di Football Manager al listone.
//
// COSA FA, IN TRE PASSI
//
//   1. SCARICA  l'elenco dei calciatori di Serie A da un servizio di ricerca
//               pubblico, in sette richieste, e lo tiene in un file locale.
//   2. ABBINA   ogni calciatore del listone al suo identificativo di Football
//               Manager, per cognome e squadra.
//   3. CARICA   le immagini corrispondenti nell'archivio, e scrive la
//               corrispondenza nel database.
//
// PERCHE' TRE PASSI E NON UNO
// Sono lenti in modi diversi e falliscono per motivi diversi. Lo scaricamento
// dipende da un servizio di terzi che puo' sparire; l'abbinamento e' solo
// calcolo e si puo' rifare cento volte per aggiustare le regole; il
// caricamento muove qualche centinaio di file e non va rifatto per sbaglio.
// Tenendoli separati si rilancia solo quello che serve.
//
// I VINCOLI DI ADR-0011, CHE SONO PARTE DELLA DECISIONE
//   · Si scarica in blocco, mai un calciatore alla volta.
//   · Mai durante l'asta: la corrispondenza vive nel nostro database.
//   · L'indirizzo non e' documentato e puo' cambiare senza preavviso: quando
//     non risponde, questo script lo dice e si ripiega sull'abbinamento
//     manuale, che resta sempre disponibile.
//
// Uso:
//   node scripts/volti.mjs --stato          quanti volti ci sono, e quanti no
//   node scripts/volti.mjs --scarica        solo il passo 1
//   node scripts/volti.mjs --abbina         solo il passo 2, mostra cosa farebbe
//   node scripts/volti.mjs                  tutti e tre i passi
//   node scripts/volti.mjs --limite 50      carica al massimo 50 immagini
//   node scripts/volti.mjs --proponi        chi resta fuori, e a chi somiglia
//   node scripts/volti.mjs --manuale        li passa uno per uno, e decidi tu
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import {
  chiaveSquadra,
  elencoCompleto,
  normalizza,
  salvaExtra,
  scaricaSquadraPerNome,
} from './lib/fm.mjs'
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

// ─── Dove sta il facepack ───────────────────────────────────────────────────
// Si puo' spostare con FANTASTA_FACEPACK, ma il valore normale e' quello.

const FACEPACK =
  process.env.FANTASTA_FACEPACK ??
  'C:/Users/Giovanni/Documents/Sports Interactive/Football Manager 26/graphics'
const VOLTI = join(FACEPACK, 'faces')

const CACHE = join(radice, '.cache')
const ELENCO_FM = join(CACHE, 'serie-a-fm.json')

// ─── Il servizio di ricerca ─────────────────────────────────────────────────
// Parametri estratti dal codice del sito, come racconta ADR-0011.

const RICERCA = {
  host: 'https://1r3p0ghdzwktqxu9p-1.a1.typesense.net',
  chiave: 'ItfYDIz1mGDuZVXzvkYj0jYJ4avarL02',
  raccolta: 'detailed_game_items',
  // 278 e' l'identificativo della Serie A dentro quell'archivio.
  serieA: 278,
}

// ─── Attrezzi ───────────────────────────────────────────────────────────────

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

function argomento(nome, ripiego) {
  const i = process.argv.indexOf(nome)
  return i >= 0 ? process.argv[i + 1] : ripiego
}

/**
 * Toglie accenti, punteggiatura e maiuscole.
 *
 * Serve perche' i due elenchi scrivono gli stessi nomi in modi diversi:
 * «Martínez» e «Martinez», «O'Riley» e «O Riley», «Thuram-Ulien» e «Thuram
 * Ulien». Senza questo passaggio l'abbinamento fallirebbe su un nome su dieci
 * per motivi tipografici, non di identita'.
 */
// La normalizzazione dei nomi e la chiave delle squadre stanno in
// `lib/fm.mjs`: le usa anche `loghi.mjs`, e due copie che divergono
// vorrebbero dire le facce di una squadra e lo stemma di un'altra.

/**
 * Le forme sotto cui un calciatore puo' comparire.
 *
 * IL LISTONE ABBREVIA
 * Quando due calciatori della stessa squadra hanno lo stesso cognome, il
 * listone del fantacalcio scrive «Gonzalez N.» e «Gonzalez A.». Football
 * Manager scrive i nomi per intero. Senza togliere l'iniziale puntata,
 * «gonzalez n» non somiglia a niente e quei calciatori restano senza faccia:
 * sono un centinaio, ed erano il grosso dei non trovati.
 *
 * Si tiene anche il cognome nudo, e l'iniziale viene restituita a parte perche'
 * serve a sciogliere le ambiguita': fra due Gonzalez, quello giusto e' quello
 * il cui nome di battesimo comincia per N.
 */
function formeDelNome(nome, alternative = []) {
  const forme = new Set()
  const pulito = normalizza(nome)

  if (pulito) {
    forme.add(pulito)
    const parole = pulito.split(' ')
    if (parole.length > 1) {
      forme.add(parole[parole.length - 1])

      // Le iniziali puntate in coda non sono cognomi: «Gonzalez N.»,
      // «Esposito Se.», «Ederson D.S.». Si tolgono tutte quelle che restano
      // di due lettere o meno dopo la normalizzazione, e resta il cognome.
      let senzaIniziali = [...parole]
      while (senzaIniziali.length > 1 && senzaIniziali[senzaIniziali.length - 1].length <= 2) {
        senzaIniziali = senzaIniziali.slice(0, -1)
      }
      if (senzaIniziali.length < parole.length) {
        forme.add(senzaIniziali.join(' '))
        forme.add(senzaIniziali[senzaIniziali.length - 1])
      }
    }
  }

  for (const a of alternative) {
    const p = normalizza(a)
    if (p) forme.add(p)
  }
  return forme
}

/** L'iniziale del nome di battesimo, se il listone l'ha messa: «Gonzalez N.» → «n». */
function inizialePuntata(nome) {
  const m = /\s([a-z])$/.exec(normalizza(nome))
  return m ? m[1] : null
}

/** L'iniziale del nome di battesimo di un calciatore scritto per intero. */
function inizialeDiBattesimo(nome) {
  const parole = normalizza(nome).split(' ')
  return parole.length > 1 ? parole[0][0] : null
}

// ═══════════════════════════════════════════════════════════════════════════
// Passo 1 · Scaricare l'elenco di Serie A
// ═══════════════════════════════════════════════════════════════════════════

async function scarica() {
  console.log('Scarico l\'elenco dei calciatori di Serie A.\n')
  const tutti = []
  let pagine = 0

  for (let pagina = 1; pagina <= 10; pagina++) {
    const indirizzo =
      `${RICERCA.host}/collections/${RICERCA.raccolta}/documents/search?` +
      new URLSearchParams({
        q: '*',
        query_by: 'name',
        filter_by: `classification_id:=player && division.id:=${RICERCA.serieA}`,
        sort_by: 'reputation:desc',
        per_page: '250',
        page: String(pagina),
      })

    let r
    try {
      r = await fetch(indirizzo, { headers: { 'X-TYPESENSE-API-KEY': RICERCA.chiave } })
    } catch (e) {
      throw new Error(
        `Il servizio di ricerca non risponde (${e.message}).\n` +
          "ADR-0011 lo prevede: l'abbinamento manuale resta disponibile.",
      )
    }
    if (!r.ok) {
      throw new Error(
        `Il servizio di ricerca ha risposto ${r.status}.\n` +
          `${(await r.text()).slice(0, 200)}\n` +
          "ADR-0011 lo prevede: l'indirizzo non è documentato e può cambiare.",
      )
    }

    const j = await r.json()
    pagine++
    for (const h of j.hits ?? []) {
      const d = h.document
      if (!d.fm_id) continue
      tutti.push({
        fm_id: Number(d.fm_id),
        nome: d.name,
        squadra: d.team?.name ?? '',
        reputazione: d.reputation ?? 0,
        alternative: d.search_terms ?? [],
      })
    }
    if (pagina * 250 >= (j.found ?? 0)) break
  }

  mkdirSync(CACHE, { recursive: true })
  writeFileSync(ELENCO_FM, JSON.stringify(tutti, null, 1))
  console.log(`${tutti.length} calciatori scaricati in ${pagine} richieste.`)
  console.log(`Salvati in ${ELENCO_FM}\n`)
  return tutti
}

// ═══════════════════════════════════════════════════════════════════════════
// Passo 2 · Abbinare
// ═══════════════════════════════════════════════════════════════════════════

/**
 * L'abbinamento, e perche' e' fatto in due giri.
 *
 * PRIMO GIRO, cognome + squadra. E' quasi sempre sufficiente e quasi sempre
 * sicuro: due calciatori con lo stesso cognome nella stessa squadra sono il 2%
 * (ADR-0011). Chi resta ambiguo non viene abbinato: meglio nessuna foto che la
 * faccia di un altro, perche' una foto sbagliata sullo schermo condiviso non
 * la corregge nessuno, ci si ride sopra e resta li' tutta la serata.
 *
 * SECONDO GIRO, solo cognome, per chi il primo giro ha lasciato fuori. Serve
 * ai calciatori che hanno cambiato squadra fra la compilazione del listone e
 * quella del database di Football Manager. Si accetta **solo** se in tutta la
 * Serie A quel cognome e' unico: altrimenti si torna al caso di prima.
 */
function abbina(listone, elencoFm) {
  const perSquadraENome = new Map()
  const perNome = new Map()

  for (const g of elencoFm) {
    const squadra = chiaveSquadra(g.squadra)
    for (const forma of formeDelNome(g.nome, g.alternative)) {
      const k1 = `${squadra}|${forma}`
      if (!perSquadraENome.has(k1)) perSquadraENome.set(k1, [])
      perSquadraENome.get(k1).push(g)

      if (!perNome.has(forma)) perNome.set(forma, [])
      perNome.get(forma).push(g)
    }
  }

  const esiti = []
  for (const c of listone) {
    const squadra = chiaveSquadra(c.serie_a_team)
    const forme = [...formeDelNome(c.name)]

    let candidati = []
    let come = null

    for (const forma of forme) {
      const trovati = perSquadraENome.get(`${squadra}|${forma}`) ?? []
      if (trovati.length) {
        candidati = trovati
        come = 'scaricata'
        break
      }
    }

    if (!candidati.length) {
      for (const forma of forme) {
        const trovati = perNome.get(forma) ?? []
        // Solo se e' un cognome unico in tutta la Serie A.
        const distinti = new Set(trovati.map((t) => t.fm_id))
        if (distinti.size === 1) {
          candidati = trovati
          come = 'dedotta'
          break
        }
      }
    }

    if (!candidati.length) {
      esiti.push({ calciatore: c, esito: 'nessuno' })
      continue
    }

    let distinti = [...new Map(candidati.map((x) => [x.fm_id, x])).values()]

    // Piu' di uno: si prova con l'iniziale che il listone ha messo apposta per
    // distinguerli. E' esattamente il caso per cui il listone la scrive.
    if (distinti.length > 1) {
      const iniziale = inizialePuntata(c.name)
      if (iniziale) {
        const filtrati = distinti.filter((x) => inizialeDiBattesimo(x.nome) === iniziale)
        if (filtrati.length === 1) distinti = filtrati
      }
    }

    if (distinti.length > 1) {
      esiti.push({ calciatore: c, esito: 'ambiguo', quanti: distinti.length })
      continue
    }

    esiti.push({ calciatore: c, esito: 'ok', fm: distinti[0], origine: come })
  }

  return esiti
}

// ═══════════════════════════════════════════════════════════════════════════
// A mano · Per chi l'abbinamento automatico lascia fuori
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quanto due nomi si somigliano, fra 0 e 1.
 *
 * E' la distanza di Levenshtein normalizzata sulla lunghezza. Serve a
 * **proporre**, non a decidere: la decisione resta di chi guarda, e l'ordine
 * dei candidati e' solo un modo di non far scorrere millesettecento nomi.
 *
 * Scritta a mano perche' sono quindici righe e l'elenco delle dipendenze e'
 * chiuso (ADR-0006): una libreria per questo sarebbe sproporzionata.
 */
function somiglianza(a, b) {
  if (a === b) return 1
  if (!a || !b) return 0

  const righe = Array.from({ length: b.length + 1 }, (_, i) => [i, ...Array(a.length).fill(0)])
  for (let j = 0; j <= a.length; j++) righe[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      righe[i][j] = Math.min(
        righe[i - 1][j] + 1,
        righe[i][j - 1] + 1,
        righe[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1),
      )
    }
  }
  return 1 - righe[b.length][a.length] / Math.max(a.length, b.length)
}

/**
 * I candidati piu' probabili per un calciatore che non si e' abbinato.
 *
 * Il punteggio somma tre cose: quanto si somigliano i nomi, un premio se la
 * squadra combacia, e un premio piccolo alla reputazione. La reputazione conta
 * poco ma conta: fra due sconosciuti con lo stesso cognome, quello che gioca
 * in Serie A e' piu' probabilmente quello del listone.
 */
function candidati(calciatore, elencoFm, quanti = 5) {
  const squadra = chiaveSquadra(calciatore.serie_a_team)
  const forme = [...formeDelNome(calciatore.name)]

  return elencoFm
    .map((g) => {
      const sueForme = [...formeDelNome(g.nome, g.alternative)]
      let migliore = 0
      for (const a of forme) for (const b of sueForme) migliore = Math.max(migliore, somiglianza(a, b))

      const stessaSquadra = chiaveSquadra(g.squadra) === squadra
      const punteggio = migliore + (stessaSquadra ? 0.35 : 0) + Math.min(g.reputazione, 200) / 4000
      return { ...g, somiglianza: migliore, stessaSquadra, punteggio }
    })
    .filter((g) => g.somiglianza > 0.45 || g.stessaSquadra)
    .sort((a, b) => b.punteggio - a.punteggio)
    .slice(0, quanti)
}

/** Stampa chi resta fuori e a chi somiglia, senza chiedere niente. */
function proponi(esiti, elencoFm) {
  const fuori = esiti.filter((e) => e.esito !== 'ok')
  if (fuori.length === 0) {
    console.log('\nNon resta fuori nessuno.')
    return
  }

  console.log(`\n${fuori.length} da sistemare a mano. Per ognuno, i più somiglianti:\n`)
  for (const e of fuori.slice(0, 40)) {
    const c = e.calciatore
    console.log(`${c.name} (${c.role}, ${c.serie_a_team})`)
    const prop = candidati(c, elencoFm)
    if (prop.length === 0) {
      console.log('   nessun candidato somigliante')
    } else {
      prop.forEach((g, i) => {
        const foto = existsSync(join(VOLTI, `${g.fm_id}.png`)) ? 'foto sì' : 'foto NO'
        console.log(
          `   ${i + 1}. ${g.nome} — ${g.squadra} — fm ${g.fm_id} — ` +
            `somiglianza ${Math.round(g.somiglianza * 100)}% — ${foto}`,
        )
      })
    }
    console.log('')
  }
  if (fuori.length > 40) console.log(`…e altri ${fuori.length - 40}.`)
}

/**
 * Li passa uno per uno e chiede.
 *
 * PERCHE' DA TERMINALE E NON DALLA SCHERMATA
 * Le immagini stanno nel facepack, sul disco: il browser non lo puo' leggere.
 * La schermata `/volti` serve a caricare un file scelto a mano e a dire «e'
 * lui» o «non e' lui»; questo serve a passare in rassegna novanta nomi
 * pescando dal facepack, che e' un lavoro diverso.
 */
async function aMano(esiti, elencoFm, stagione) {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  const fuori = esiti.filter((e) => e.esito !== 'ok')
  console.log(`\n${fuori.length} da sistemare. Per ognuno: un numero per scegliere,`)
  console.log('invio per saltare, «f» per finire.\n')

  const scelte = []
  for (const e of fuori) {
    const c = e.calciatore
    const prop = candidati(c, elencoFm)
    if (prop.length === 0) continue

    console.log(`\n${c.name} (${c.role}, ${c.serie_a_team})`)
    prop.forEach((g, i) => {
      const foto = existsSync(join(VOLTI, `${g.fm_id}.png`))
      console.log(
        `   ${i + 1}. ${g.nome} — ${g.squadra} — ${Math.round(g.somiglianza * 100)}%` +
          (foto ? '' : '  (senza foto nel facepack)'),
      )
    })

    const risposta = (await rl.question('   scelta: ')).trim().toLowerCase()
    if (risposta === 'f') break
    const n = Number(risposta)
    if (!Number.isInteger(n) || n < 1 || n > prop.length) continue

    const scelto = prop[n - 1]
    if (!existsSync(join(VOLTI, `${scelto.fm_id}.png`))) {
      console.log('   quello non ha la foto nel facepack: salto')
      continue
    }
    scelte.push({ calciatore: c, fm: scelto })
    console.log(`   → ${scelto.nome}`)
  }
  rl.close()

  if (scelte.length === 0) {
    console.log('\nNiente da caricare.')
    return
  }

  console.log(`\nCarico ${scelte.length} immagini scelte a mano.`)
  // Origine «confermata»: le ha decise una persona guardando, e nessun giro
  // automatico deve poterle sovrascrivere.
  const esito = await carica(
    scelte.map((x) => ({ esito: 'ok', calciatore: x.calciatore, fm: x.fm, origine: 'confermata' })),
    stagione,
    scelte.length,
  )
  console.log(`${esito.caricate} caricate.`)
  if (esito.conto) console.log(`Corrispondenze scritte: ${esito.conto.aggiornati}.`)
}

// ═══════════════════════════════════════════════════════════════════════════
// Passo 3 · Caricare le immagini
// ═══════════════════════════════════════════════════════════════════════════

/**
 * L'accesso con cui si caricano le immagini.
 *
 * PERCHE' UN ACCOUNT DI SERVIZIO E NON LA PASSWORD DEL FONDATORE
 * Caricare nell'archivio richiede un utente che amministri l'applicazione.
 * Chiedere la password personale del proprietario per farla scrivere in un
 * file sarebbe la strada corta e la peggiore: quella password apre il suo
 * account, non solo questo archivio.
 *
 * Invece lo script si crea un account suo, gli da' i permessi di
 * amministrazione con la chiave di gestione che gia' usa per le migrazioni, e
 * **lo toglie appena finito**. Nessun segreto nuovo entra nel progetto e
 * nessuna password personale gira.
 */
async function accessoDiServizio() {
  const email = 'caricatore.volti@fantasta.servizio'
  const password = `volti-${Math.random().toString(36).slice(2)}-${Date.now()}`

  // Se c'era da una volta precedente, si toglie: la password non la sappiamo
  // piu' e non serve conservarla.
  await sql(`delete from auth.users where email = '${email}';`)

  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { display_name: 'Caricatore volti' } }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error(`Non riesco a creare l'accesso di servizio: ${JSON.stringify(j)}`)

  await sql(`insert into public.app_admins (user_id) values ('${j.user.id}')
             on conflict do nothing;`)

  return { token: j.access_token, email }
}

/** Chiude la parentesi: l'account di servizio non deve sopravvivere allo script. */
async function chiudiAccessoDiServizio(email) {
  await sql(`delete from auth.users where email = '${email}';`)
}

async function carica(esiti, stagione, limite) {
  const { token, email } = await accessoDiServizio()
  const daFare = esiti.filter((e) => e.esito === 'ok').slice(0, limite)

  let caricate = 0
  let senzaFile = 0
  const righe = []

  for (const e of daFare) {
    const sorgente = join(VOLTI, `${e.fm.fm_id}.png`)
    if (!existsSync(sorgente)) {
      senzaFile++
      continue
    }

    // Le immagini del facepack stanno fra i 10 e i 30 KB: si caricano come
    // sono. Ridimensionarle vorrebbe dire una libreria grafica, e ADR-0006
    // tiene l'elenco delle dipendenze chiuso per ragioni che valgono piu' di
    // qualche kilobyte.
    const percorso = `${stagione}/${e.calciatore.id}.png`
    const r = await fetch(`${URL_BASE}/storage/v1/object/volti/${percorso}`, {
      method: 'POST',
      headers: {
        apikey: CHIAVE,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: readFileSync(sorgente),
    })
    if (!r.ok) {
      console.log(`  ✗ ${e.calciatore.name}: ${r.status} ${(await r.text()).slice(0, 120)}`)
      continue
    }

    // ─── La guardia ─────────────────────────────────────────────────────────
    // «confermata» vuol dire che una persona ha guardato quella faccia e ha
    // detto che e' quella giusta. Vale come promessa: nessun giro automatico
    // la tocca piu'. Proprio per questo un automatismo non puo' metterla, o
    // sarebbe una promessa fatta a nome di nessuno.
    //
    // E' successo davvero: venti righe si sono trovate marcate confermate
    // senza che nessuno le avesse confermate, e sarebbero rimaste fuori da
    // ogni correzione futura e da ogni revisione. Non ho ricostruito come, e
    // per questo la difesa sta qui, dove il dato viene scritto.
    if (e.origine === 'confermata' && !process.argv.includes('--manuale')) {
      throw new Error(
        `${e.calciatore.name}: il giro automatico stava per scrivere «confermata». ` +
          "Solo --manuale, dove una persona sceglie, puo' farlo.",
      )
    }

    righe.push({
      calciatore: e.calciatore.id,
      fm_id: e.fm.fm_id,
      percorso,
      origine: e.origine,
    })
    caricate++
    if (caricate % 50 === 0) console.log(`  ${caricate} immagini caricate…`)
  }

  // Una chiamata sola invece di seicento.
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/imposta_volti`, {
    method: 'POST',
    headers: {
      apikey: CHIAVE,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_righe: righe }),
  })
  const conto = await r.json().catch(() => null)

  await chiudiAccessoDiServizio(email)

  return { caricate, senzaFile, conto: Array.isArray(conto) ? conto[0] : conto }
}

// ═══════════════════════════════════════════════════════════════════════════
// I comandi
// ═══════════════════════════════════════════════════════════════════════════

const stagione = (await sql(
  "select season, count(*)::int n from public.players where active group by 1 order by n desc limit 1;",
))[0]

if (!stagione) {
  console.error('Non c\'è nessun listone caricato: importalo prima dall\'app.')
  process.exit(1)
}

if (process.argv.includes('--stato')) {
  const c = (await sql(`select
      count(*)::int totale,
      count(photo_path)::int con_volto,
      count(*) filter (where fm_origine = 'confermata')::int confermati,
      count(*) filter (where fm_origine = 'dedotta')::int dedotti
    from public.players where active and season = '${stagione.season}';`))[0]
  console.log(`Listone ${stagione.season}: ${c.totale} calciatori.`)
  console.log(`  con volto:   ${c.con_volto} (${Math.round((c.con_volto / c.totale) * 100)}%)`)
  console.log(`  senza:       ${c.totale - c.con_volto}`)
  console.log(`  confermati a mano: ${c.confermati} · dedotti dal solo cognome: ${c.dedotti}`)
  const cartella = existsSync(VOLTI)
  console.log(`\nFacepack in ${VOLTI}: ${cartella ? 'trovato' : 'NON trovato'}`)
  process.exit(0)
}

// ─── Passo 1 ────────────────────────────────────────────────────────────────

let elencoFm
const riusaElenco =
  process.argv.includes('--abbina') ||
  process.argv.includes('--proponi') ||
  process.argv.includes('--manuale')

if (riusaElenco && existsSync(ELENCO_FM)) {
  elencoFm = elencoCompleto(JSON.parse(readFileSync(ELENCO_FM, 'utf8')))
  console.log(`Riuso l'elenco già scaricato: ${elencoFm.length} calciatori.\n`)
} else {
  elencoFm = await scarica()
}

if (process.argv.includes('--scarica')) process.exit(0)

// ─── Passo 2 ────────────────────────────────────────────────────────────────

const listone = await sql(`select id, name, role, serie_a_team from public.players
  where active and season = '${stagione.season}' order by name;`)

console.log(`Abbino ${listone.length} calciatori del listone ${stagione.season}.\n`)
let esiti = abbina(listone, elencoFm)

// ─── Chi resta fuori, e perche' ─────────────────────────────────────────────
//
// Non tutte le mancanze sono uguali, e confonderle porta a inseguire il
// problema sbagliato. Un calciatore singolo che non si trova e' un nome
// scritto in modo strano: si sistema a mano in dieci secondi. Una **squadra
// intera** che non si trova e' un'altra cosa: vuol dire che quella squadra in
// Football Manager non gioca in Serie A, e nessuna regola di abbinamento la
// fara' comparire.
//
// Succede quando il listone caricato e' di un'altra annata rispetto al
// database del gioco. Non e' un difetto da correggere qui: e' un dato da
// dire a chi guarda, perche' la decisione — caricare il listone giusto, o
// abbinare a mano — e' sua.

// ─── Le squadre che in Serie A non ci sono ──────────────────────────────────
//
// Una squadra appena promossa e' in Serie A nel listone e in Serie B nel
// database del gioco: lo scaricamento filtrato sulla Serie A non la vede, e i
// suoi calciatori restano tutti senza faccia. Erano tre squadre e ottantuno
// calciatori, la meta' esatta di quello che restava scoperto.
//
// La soglia e' il tasso e non lo zero: una squadra fuori Serie A qualche
// abbinamento lo ottiene lo stesso, per i cognomi unici in tutto il
// campionato. Sotto un terzo, pero', il motivo non e' che mancano dei nomi:
// e' che manca la squadra.

{
  const conteggio = new Map()
  for (const e of esiti) {
    const sq = e.calciatore.serie_a_team
    if (!conteggio.has(sq)) conteggio.set(sq, { trovati: 0, totale: 0 })
    const c = conteggio.get(sq)
    c.totale++
    if (e.esito === 'ok') c.trovati++
  }

  const daCercare = [...conteggio.entries()]
    .filter(([, c]) => c.totale >= 5 && c.trovati / c.totale < 0.34)
    .map(([sq]) => sq)

  if (daCercare.length) {
    console.log(`\nSquadre quasi tutte scoperte: ${daCercare.join(', ')}.`)
    console.log('Le cerco per nome: in Football Manager non sono in Serie A.\n')

    let aggiunti = 0
    for (const sq of daCercare) {
      const trovata = await scaricaSquadraPerNome(sq)
      if (!trovata.squadra) {
        console.log(`  ✗ ${sq}: non trovata`)
        continue
      }
      console.log(
        `  → ${sq}: ${trovata.squadra.nome} (${trovata.squadra.divisione}), ` +
          `${trovata.calciatori.length} calciatori`,
      )
      elencoFm = elencoFm.concat(trovata.calciatori)
      salvaExtra(trovata.calciatori)
      aggiunti += trovata.calciatori.length
    }

    if (aggiunti) {
      esiti = abbina(listone, elencoFm)
      console.log('')
    }
  }
}

const perSquadra = new Map()
for (const e of esiti) {
  const sq = e.calciatore.serie_a_team
  if (!perSquadra.has(sq)) perSquadra.set(sq, { trovati: 0, totale: 0 })
  const c = perSquadra.get(sq)
  c.totale++
  if (e.esito === 'ok') c.trovati++
}
const squadreFuori = [...perSquadra.entries()]
  .filter(([, c]) => c.totale >= 5 && c.trovati / c.totale < 0.34)
  .map(([sq, c]) => ({ sq, ...c }))

const ok = esiti.filter((e) => e.esito === 'ok')
const ambigui = esiti.filter((e) => e.esito === 'ambiguo')
const nessuno = esiti.filter((e) => e.esito === 'nessuno')
const conFile = ok.filter((e) => existsSync(join(VOLTI, `${e.fm.fm_id}.png`)))

console.log(`  abbinati:            ${ok.length} su ${listone.length}`)
console.log(`    di cui con la foto: ${conFile.length}`)
console.log(`    dedotti dal solo cognome: ${ok.filter((e) => e.origine === 'dedotta').length}`)
console.log(`  ambigui, lasciati stare: ${ambigui.length}`)
console.log(`  non trovati:         ${nessuno.length}`)

if (squadreFuori.length) {
  const quanti = squadreFuori.reduce((n, x) => n + (x.totale - x.trovati), 0)
  console.log(
    `\n${squadreFuori.map((x) => x.sq).join(', ')}: quasi nessun abbinamento, ` +
      `${quanti} calciatori in tutto.`,
  )
  console.log('In Football Manager quelle squadre non sono in Serie A: succede quando')
  console.log('il listone caricato è di un\'annata diversa da quella del gioco.')
}

const sparsi = nessuno.filter((e) => !squadreFuori.some((x) => x.sq === e.calciatore.serie_a_team))
if (sparsi.length) {
  console.log(`\n${sparsi.length} non trovati sparsi fra le altre squadre. I primi dieci:`)
  for (const e of sparsi.slice(0, 10)) {
    console.log(`  · ${e.calciatore.name} (${e.calciatore.serie_a_team})`)
  }
}

if (process.argv.includes('--proponi')) {
  proponi(esiti, elencoFm)
  console.log('\nNiente è stato caricato. Per decidere uno per uno: --manuale')
  process.exit(0)
}

if (process.argv.includes('--manuale')) {
  await aMano(esiti, elencoFm, stagione.season)
  process.exit(0)
}

if (process.argv.includes('--abbina')) {
  console.log('\nNiente è stato caricato: era solo una prova. Rilancia senza --abbina.')
  process.exit(0)
}

// ─── Passo 3 ────────────────────────────────────────────────────────────────

const limite = Number(argomento('--limite', String(conFile.length)))
console.log(`\nCarico le immagini (al massimo ${limite}).`)
const esito = await carica(esiti, stagione.season, limite)

console.log(`\n${esito.caricate} immagini caricate.`)
if (esito.senzaFile) console.log(`${esito.senzaFile} abbinati ma senza file nel facepack.`)
if (esito.conto) {
  console.log(
    `Corrispondenze scritte: ${esito.conto.aggiornati}` +
      (esito.conto.saltati ? `, saltate ${esito.conto.saltati} perché confermate a mano.` : '.'),
  )
}
console.log('\nStato aggiornato: node scripts/volti.mjs --stato')
