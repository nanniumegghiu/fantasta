// ═══════════════════════════════════════════════════════════════════════════
// Un browser vero, pilotato dal terminale.
//
// PERCHE' SERVE, DOPO NOVANTA PROVE VERDI
//
// Tutte le verifiche di questo progetto parlano al server. Sono novanta e
// passano, e non hanno potuto dire niente sui due difetti peggiori usciti
// finora, che vivevano tutti e due **dentro il browser**:
//
//   · lo schermo condiviso che si inchiodava allo scadere del countdown, per
//     un anello di render che nessuna richiesta HTTP poteva mostrare;
//   · le rose tagliate, che dipendevano dall'altezza della finestra.
//
// Un difetto che sta fra React e lo schermo non lo trova una query. Serve una
// pagina aperta davvero, che cambia da sola mentre qualcosa succede altrove.
//
// PERCHE' NIENTE PLAYWRIGHT E NIENTE PUPPETEER
//
// ADR-0006 tiene chiuso l'elenco delle dipendenze. Playwright scarica un
// browser da centocinquanta megabyte quando su questa macchina Chrome c'e'
// gia', e per quello che serve qui — apri, aspetta, guarda, conta le
// richieste — basta il protocollo che Chrome espone da solo. Node 22 ha
// WebSocket in casa: il ponte sta in sessanta righe.
//
// COSA NON E'
//
// Non e' un framework di test del browser e non deve diventarlo. E' il minimo
// per poter dire «l'ho aperta e ho guardato» invece di «compila».
// ═══════════════════════════════════════════════════════════════════════════

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const POSSIBILI = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

export function trovaChrome() {
  const scelto = process.env.FANTASTA_CHROME ?? POSSIBILI.find((p) => existsSync(p))
  if (!scelto || !existsSync(scelto)) {
    throw new Error(
      'Non trovo Chrome. Indicalo con FANTASTA_CHROME=/percorso/a/chrome.exe\n' +
        'Cercato in:\n  ' + POSSIBILI.join('\n  '),
    )
  }
  return scelto
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Apre Chrome senza finestra e si collega al suo protocollo di controllo.
 *
 * Il profilo e' una cartella temporanea nuova: senza, si aggancerebbe al
 * Chrome gia' aperto dell'utente, con le sue schede e le sue sessioni. Una
 * prova che tocca il browser di chi la lancia non e' una prova.
 */
export async function apriBrowser({ porta = 9333, mostra = false } = {}) {
  const profilo = mkdtempSync(join(tmpdir(), 'fantasta-chrome-'))
  const processo = spawn(
    trovaChrome(),
    [
      mostra ? '--new-window' : '--headless=new',
      `--remote-debugging-port=${porta}`,
      `--user-data-dir=${profilo}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1600,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  // Chrome ci mette un attimo ad aprire la porta.
  let versione = null
  for (let i = 0; i < 60; i++) {
    try {
      versione = await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json()
      break
    } catch {
      await attendi(250)
    }
  }
  if (!versione) throw new Error('Chrome non ha aperto la porta di controllo.')

  const chiudi = () => {
    try {
      processo.kill()
    } catch {
      /* gia' morto */
    }
    try {
      rmSync(profilo, { recursive: true, force: true })
    } catch {
      /* Windows a volte tiene il profilo bloccato per qualche secondo: non
         importa, e' in una cartella temporanea. */
    }
  }

  return { porta, versione, chiudi }
}

/**
 * Una scheda, con i comandi che servono qui e nessuno di piu'.
 *
 * Il protocollo di Chrome e' enorme. Questa e' la fetta che serve: vai a un
 * indirizzo, esegui una riga di JavaScript, guarda le richieste che partono,
 * ascolta la console.
 */
export async function apriScheda(porta) {
  const bersaglio = await (
    await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' })
  ).json()
  const ws = new WebSocket(bersaglio.webSocketDebuggerUrl)
  await new Promise((ok, no) => {
    ws.onopen = ok
    ws.onerror = () => no(new Error('non riesco a collegarmi alla scheda'))
  })

  let contatore = 0
  const inAttesa = new Map()
  const richieste = []
  const console_ = []

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && inAttesa.has(m.id)) {
      const { ok, no } = inAttesa.get(m.id)
      inAttesa.delete(m.id)
      if (m.error) no(new Error(JSON.stringify(m.error)))
      else ok(m.result)
      return
    }
    if (m.method === 'Network.requestWillBeSent') richieste.push(m.params.request.url)
    if (m.method === 'Runtime.consoleAPICalled') {
      console_.push({
        tipo: m.params.type,
        testo: (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '),
      })
    }
    if (m.method === 'Runtime.exceptionThrown') {
      console_.push({
        tipo: 'eccezione',
        testo: m.params.exceptionDetails?.exception?.description ?? 'eccezione',
      })
    }
  }

  const invia = (method, params) =>
    new Promise((ok, no) => {
      const id = ++contatore
      inAttesa.set(id, { ok, no })
      ws.send(JSON.stringify({ id, method, params: params ?? {} }))
      setTimeout(() => {
        if (inAttesa.has(id)) {
          inAttesa.delete(id)
          no(new Error(`${method} non ha risposto`))
        }
      }, 30000)
    })

  await invia('Network.enable')
  await invia('Runtime.enable')
  await invia('Page.enable')

  return {
    invia,
    richieste,
    console: console_,
    async vaiA(url) {
      await invia('Page.navigate', { url })
      await attendi(400)
    },
    /** Esegue una riga di JavaScript nella pagina e restituisce il valore. */
    async valuta(codice) {
      const r = await invia('Runtime.evaluate', {
        expression: codice,
        awaitPromise: true,
        returnByValue: true,
      })
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? 'errore nella pagina')
      }
      return r.result?.value
    },
    /** Aspetta che una condizione scritta in JavaScript diventi vera. */
    async aspetta(condizione, { entro = 15000, ogni = 250 } = {}) {
      const fine = Date.now() + entro
      while (Date.now() < fine) {
        if (await this.valuta(`Boolean(${condizione})`)) return true
        await attendi(ogni)
      }
      return false
    },
    chiudi() {
      try {
        ws.close()
      } catch {
        /* gia' chiusa */
      }
    },
  }
}

/**
 * Serve la cartella compilata, senza dipendenze.
 *
 * Tutto quello che non e' un file esistente torna `index.html`: e' la stessa
 * regola con cui la pagina pubblicata gestisce le rotte, e senza di essa
 * `/lega/<id>/asta/schermo` darebbe 404 prima ancora di caricare l'app.
 */
export async function serviCartella(cartella, porta = 4599) {
  const { createServer } = await import('node:http')
  const { readFile } = await import('node:fs/promises')
  const { extname, join: unisci, normalize } = await import('node:path')

  const TIPI = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.ico': 'image/x-icon',
  }

  const server = createServer(async (req, res) => {
    const percorso = decodeURIComponent((req.url ?? '/').split('?')[0])
    const dentro = normalize(unisci(cartella, percorso))
    if (!dentro.startsWith(normalize(cartella))) {
      res.writeHead(403).end()
      return
    }
    try {
      const corpo = await readFile(dentro)
      res.writeHead(200, { 'Content-Type': TIPI[extname(dentro)] ?? 'application/octet-stream' })
      res.end(corpo)
    } catch {
      const indice = await readFile(unisci(cartella, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indice)
    }
  })

  await new Promise((ok) => server.listen(porta, '127.0.0.1', ok))
  return {
    indirizzo: `http://127.0.0.1:${porta}`,
    chiudi: () => new Promise((ok) => server.close(ok)),
  }
}
