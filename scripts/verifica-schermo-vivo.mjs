// ═══════════════════════════════════════════════════════════════════════════
// Lo schermo condiviso, aperto davvero in un browser, mentre l'asta si muove.
//
// PERCHE' QUESTA PROVA ESISTE
//
// Novanta prove verdi non hanno visto nessuno dei due difetti peggiori usciti
// finora, perche' vivevano tutti e due dentro il browser:
//
//   · le rose tagliate — gli attaccanti fuori schermo — che dipendevano
//     dall'altezza della finestra;
//   · lo schermo che si inchiodava allo scadere del countdown, per un anello
//     di render che nessuna richiesta HTTP poteva mostrare.
//
// Il secondo l'ha trovato l'utente, sulla schermata che la sera dell'asta
// guardano in otto. Questa prova esiste perche' non succeda una terza volta.
//
// COSA CONTROLLA, E PERCHE' PROPRIO QUESTE COSE
//
//   1. Che un rilancio fatto da un'altra parte **compaia** sullo schermo.
//   2. Che allo scadere del countdown le richieste di chiusura siano
//      **poche**: e' il numero che distingue «insiste» da «e' impazzita».
//   3. Che dopo l'aggiudicazione la pagina **vada avanti da sola**, senza che
//      nessuno la ricarichi.
//   4. Che l'ultimo reparto delle rose stia **dentro** lo schermo.
//   5. Che nella console non sia esplosa nessuna eccezione.
//
// Uso:  node scripts/verifica-schermo-vivo.mjs [--mostra] [--pulisci]
//       --mostra apre la finestra invece di tenerla nascosta: serve a guardare
//       con i propri occhi quando qualcosa non torna.
// ═══════════════════════════════════════════════════════════════════════════

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { CHIAVE, URL_BASE, ref, sql } from './lib/fm.mjs'
import { apriBrowser, apriScheda, serviCartella } from './lib/browser.mjs'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(radice, 'app', 'dist')
const DOMINIO = 'prova.vivo.fantasta'
const STAGIONE = 'PROVA-VIVO'
/**
 * Il percorso base **si legge dalla compilazione**, non si decide qui.
 *
 * La prova serve l'app sotto il suo percorso base, come fa il sito pubblicato.
 * Deciderlo qui vorrebbe dire che una compilazione fatta senza `VITE_BASE`
 * verrebbe servita sotto `/fantasta/` mentre dentro cerca `/assets/…`: la
 * pagina resta bianca e **tutte** le prove falliscono insieme, per un motivo
 * che non c'entra niente con quello che stanno controllando. È successo, e per
 * un minuto è sembrato che si fosse rotto tutto.
 *
 * Si guarda dove punta il foglio di stile dentro `index.html`: quello è il
 * percorso base vero, qualunque sia.
 */
function baseCompilata() {
  const indice = readFileSync(join(DIST, 'index.html'), 'utf8')
  const m = indice.match(/(?:src|href)="([^"]*\/)assets\//)
  return m ? m[1] : '/'
}

const esiti = []
const ok = (nome, buono, dettaglio) => {
  esiti.push({ nome, buono })
  console.log(`${buono ? '  OK  ' : ' FALLITA '} ${nome}\n         ${dettaglio}`)
}
const attendi = (ms) => new Promise((r) => setTimeout(r, ms))

async function pulisci() {
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@vivo.test');`)
  await sql(`delete from public.leagues where admin_user_id in
    (select id from auth.users where email like '%@${DOMINIO}');`)
  await sql(`delete from public.teams where user_id in
    (select id from auth.users where email like '%@${DOMINIO}');`)
  await sql("delete from auth.users where email like '%@vivo.test';")
  await sql(`delete from auth.users where email like '%@${DOMINIO}';`)
  await sql('delete from public.player_stats where player_id >= 909800 and player_id < 909900;')
  await sql('delete from public.players where id >= 909800 and id < 909900;')
}

if (process.argv.includes('--pulisci')) {
  await pulisci()
  console.log('Pulito.')
  process.exit(0)
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('Manca app/dist: compila prima con  cd app && npm run build')
  process.exit(1)
}

console.log('Preparo una lega di prova e la compilo in un browser vero.\n')
await pulisci()

// ─── Il backend ─────────────────────────────────────────────────────────────

async function registra(nome, dominio = 'vivo.test') {
  const r = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${nome}.${Date.now()}${Math.floor(Math.random() * 999)}@${dominio}`,
      password: 'password-di-prova',
      data: { display_name: nome },
    }),
  })
  return await r.json()
}

const chiama = async (token, fn, corpo) => {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: CHIAVE, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  })
  const t = await r.json().catch(() => null)
  return Array.isArray(t) ? t[0] : t
}

const capo = await registra('capo')
await sql(`insert into public.app_admins (user_id) values ('${capo.user.id}') on conflict do nothing;`)
const rpc = (fn, corpo) => chiama(capo.access_token, fn, corpo)

const CALCIATORI = []
let n = 909800
for (const ruolo of ['P', 'D', 'C', 'A']) {
  for (let i = 1; i <= 5; i++) {
    CALCIATORI.push({
      id: n++,
      nome: `Vivo ${ruolo}${i}`,
      ruolo,
      squadra: 'Prova FC',
      quotazione: [24, 18, 12, 6, 2][i - 1],
    })
  }
}
await rpc('importa_listone', { p_stagione: STAGIONE, p_righe: CALCIATORI })

const lega = await rpc('crea_lega', {
  p_nome: 'Lega dello Schermo',
  p_stagione: STAGIONE,
  p_nome_squadra: 'La Capolista',
  p_crediti: 100,
  // Il regolamento vero: e' con venticinque righe per squadra che le rose si
  // tagliavano, e con tre righe non si sarebbe visto niente.
  p_slot_p: 3,
  p_slot_d: 8,
  p_slot_c: 8,
  p_slot_a: 6,
  p_max_partecipanti: 8,
})
const codiceLega = (await sql(`select invite_code from public.leagues where id = '${lega}';`))[0]
  .invite_code

execFileSync(process.execPath, [join(radice, 'scripts', 'amici-di-prova.mjs'), '--lega', codiceLega, '--quanti', '5'], {
  encoding: 'utf8',
  env: { ...process.env, FANTASTA_DOMINIO_AMICI: DOMINIO },
})

await rpc('configura_asta', {
  p_lega: lega,
  p_metodo: 'random',
  p_variante: 'per_ruolo',
  p_conduzione: 'app',
  p_tipo_chiamata: 'libera',
  p_secondi_inattivita: 3,
  p_secondi_countdown: 3,
})
await rpc('apri_asta', { p_lega: lega, p_sorteggia: false })
await rpc('apri_prossimo_lotto', { p_lega: lega })

// ─── Il browser ─────────────────────────────────────────────────────────────

const BASE = baseCompilata()
if (BASE === '/') {
  console.log("⚠ compilata senza percorso base: la prova sul link d'invito non distinguerebbe")
  console.log('  un indirizzo giusto da uno sbagliato. Ricompila con:')
  console.log('  cd app && VITE_BASE=/fantasta/ npm run build\n')
}
const sito = await serviCartella(DIST, 4599, BASE)
const browser = await apriBrowser({ mostra: process.argv.includes('--mostra') })
const scheda = await apriScheda(browser.porta)

const chiudiTutto = async () => {
  scheda.chiudi()
  browser.chiudi()
  await sito.chiudi()
}
process.on('uncaughtException', async (e) => {
  console.error(e)
  await chiudiTutto()
  process.exit(1)
})

try {
  // La sessione si scrive dove la scrive l'app: e' l'unico modo di entrare
  // senza compilare un modulo, ed e' esattamente la sessione di una persona
  // vera, non un permesso speciale.
  await scheda.vaiA(sito.indirizzo)
  await scheda.valuta(`localStorage.setItem(${JSON.stringify(`sb-${ref}-auth-token`)}, ${JSON.stringify(
    JSON.stringify({
      access_token: capo.access_token,
      refresh_token: capo.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + 3000,
      expires_in: 3000,
      token_type: 'bearer',
      user: capo.user,
    }),
  )})`)

  await scheda.vaiA(`${sito.indirizzo}/lega/${lega}/asta/schermo`)

  const arrivata = await scheda.aspetta("document.body.innerText.includes('audio')", { entro: 20000 })
  ok(
    'Lo schermo condiviso si apre e chiede il tocco per l audio',
    arrivata,
    arrivata ? 'la schermata di attivazione c e' : `non e arrivata: «${await scheda.valuta('document.body.innerText.slice(0,180)')}»`,
  )

  // Il tocco che nessun browser fa partire da solo.
  await scheda.valuta(`[...document.querySelectorAll('button')].find(b => /audio/i.test(b.innerText))?.click()`)
  // Attenzione: `innerText` restituisce il testo **come lo si vede**, quindi
  // un `uppercase` nel CSS lo rende maiuscolo. La prima versione di questa
  // prova cercava «Offerta» dove sullo schermo c'è scritto «OFFERTA», e dava
  // per rotta una schermata che funzionava benissimo. Da qui in avanti si
  // confronta senza maiuscole.
  const testo = 'document.body.innerText.toLowerCase()'
  const inAsta = await scheda.aspetta(`${testo}.includes('offerta')`, { entro: 20000 })
  ok(
    'Dopo il tocco compare il calciatore in asta',
    inAsta,
    inAsta
      ? 'la fascia dell asta e sullo schermo'
      : `non compare: «${(await scheda.valuta('document.body.innerText')).slice(0, 200)}»`,
  )

  // ─── 1. Un rilancio fatto altrove deve comparire ─────────────────────────
  const amici = await sql(`select u.email, t.id from auth.users u
    join public.teams t on t.user_id = u.id and t.league_id = '${lega}'
    where u.email like '%@${DOMINIO}' order by t.created_at limit 1;`)
  const password = (
    await import('node:fs')
  ).readFileSync(join(radice, '.env.local'), 'utf8').match(/FANTASTA_PASSWORD_AMICI=(.*)/)[1].trim()
  const amico = await (
    await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: amici[0].email, password }),
    })
  ).json()

  const [lottoAperto] = await sql(`select lo.id from public.auction_lots lo
    join public.auctions a on a.id = lo.auction_id
    where a.league_id = '${lega}' and lo.status = 'open' limit 1;`)
  await chiama(amico.access_token, 'rilancia', { p_lotto: lottoAperto.id, p_importo: 7 })

  // Non basta cercare «7»: una cifra sola compare in mezzo schermo, e la prova
  // passerebbe anche con la pagina ferma. Si guarda il numero grande
  // dell'offerta, che è l'unico posto dove quel 7 deve comparire.
  //
  // E non basta nemmeno che compaia: **quanto ci mette** è tutta la
  // differenza. Su un televisore che otto persone guardano insieme, un rilancio
  // che arriva dopo otto secondi non è un ritardo, è un'informazione
  // sbagliata: qualcuno rilancia contro un prezzo che non esiste più. La prima
  // versione di questa prova aspettava dodici secondi e diceva OK, cioè
  // certificava come funzionante esattamente il difetto che l'utente vedeva.
  const primaDelRilancio = Date.now()
  const rilancioVisto = await scheda.aspetta(
    "[...document.querySelectorAll('p')].some(p => p.innerText.trim() === '7' && parseFloat(getComputedStyle(p).fontSize) > 60)",
    { entro: 12000, ogni: 100 },
  )
  const ritardo = Date.now() - primaDelRilancio
  ok(
    'Un rilancio fatto da un altro dispositivo compare **subito**',
    rilancioVisto && ritardo < 3000,
    rilancioVisto
      ? `l offerta 7 e apparsa dopo ${(ritardo / 1000).toFixed(1)}s ` +
        '(sopra i 3 s sul televisore si rilancia contro un prezzo che non esiste piu)'
      : 'l offerta non e mai arrivata: lo schermo non si aggiorna',
  )

  const collegato = await scheda.valuta(
    "Boolean(document.querySelector('[aria-label=\"Collegato\"]'))",
  )
  ok(
    'Lo schermo dichiara di essere collegato al canale in tempo reale',
    collegato,
    collegato ? 'il pallino e verde' : 'il pallino e rosso: il canale non e collegato',
  )

  // ─── 2. Allo scadere: poche richieste, non una raffica ────────────────────
  const primaDelloScadere = scheda.richieste.filter((u) => u.includes('chiudi_lotto_se_scaduto')).length
  // inattivita 3 + countdown 3, piu' un margine.
  await attendi(11000)
  const richiesteChiusura =
    scheda.richieste.filter((u) => u.includes('chiudi_lotto_se_scaduto')).length - primaDelloScadere

  ok(
    'Allo scadere lo schermo insiste, ma non impazzisce',
    richiesteChiusura > 0 && richiesteChiusura < 12,
    `${richiesteChiusura} richieste di chiusura in undici secondi ` +
      '(zero vorrebbe dire che non chiude mai, decine che e in anello)',
  )

  // ─── 3. Dopo l'aggiudicazione la pagina va avanti da sola ────────────────
  const [statoLotto] = await sql(`select count(*)::int n from public.roster_players
    where league_id = '${lega}';`)
  const vivaDopo = await scheda.aspetta(
    `${testo}.includes('offerta') || ${testo}.includes('finito')`,
    { entro: 15000 },
  )
  ok(
    'Dopo l aggiudicazione la pagina va avanti da sola',
    statoLotto.n > 0 && vivaDopo,
    `${statoLotto.n} calciatori assegnati, e lo schermo ` +
      (vivaDopo ? 'mostra gia il momento successivo' : 'e rimasto fermo'),
  )

  // ─── 4. Le rose non si tagliano ──────────────────────────────────────────
  const rose = await scheda.valuta(`(() => {
    const colonne = [...document.querySelectorAll('footer > div')]
    if (!colonne.length) return { colonne: 0 }
    const prima = colonne[0]
    const contenitore = prima.lastElementChild
    const righe = [...contenitore.querySelectorAll(':scope > div > div')]
    if (!righe.length) return { colonne: colonne.length, righe: 0 }
    const ultima = righe[righe.length - 1]
    const c = contenitore.getBoundingClientRect()
    const u = ultima.getBoundingClientRect()
    return {
      colonne: colonne.length,
      righe: righe.length,
      altezzaRiga: getComputedStyle(ultima).height,
      altezzaContenitore: Math.round(c.height),
      debordo: Math.round(u.bottom - c.bottom),
      ultimoReparto: contenitore.innerText.trim().split('\\n').filter(Boolean).slice(-1)[0] ?? '',
    }
  })()`)
  ok(
    'L ultimo reparto delle rose sta dentro lo schermo',
    rose.colonne === 6 && rose.righe > 20 && rose.debordo <= 2,
    `${rose.colonne} colonne, ${rose.righe} righe da ${rose.altezzaRiga} in ` +
      `${rose.altezzaContenitore}px: l ultima deborda di ${rose.debordo}px ` +
      '(sopra i 2 px vuol dire tagliato)',
  )

  // ─── 5. Il listone aperto dall'asta ──────────────────────────────────────
  //
  // Da qui dentro deve rispondere a due domande urgenti: chi è ancora libero
  // in questo reparto, e quali dei miei obiettivi sono ancora in ballo. Se
  // mostra tutti i calciatori, comprati compresi, non risponde a nessuna delle
  // due mentre il countdown scorre.
  const lista = await rpc('assicura_lista_obiettivi', { p_lega: lega })
  await sql(`insert into public.tiers (list_id, name, position, role)
    values ('${lista}', 'Prova', 1, 'P') on conflict do nothing;`)
  const [fascia] = await sql(`select id from public.tiers where list_id = '${lista}' limit 1;`)
  // Due portieri fra gli obiettivi: uno resterà libero.
  await sql(`insert into public.targets (list_id, player_id, tier_id, priority)
    values ('${lista}', 909800, '${fascia.id}', 1), ('${lista}', 909801, '${fascia.id}', 2)
    on conflict do nothing;`)

  await scheda.vaiA(`${sito.indirizzo}/listone?lega=${lega}&ruolo=P`)
  // Si aspetta il **sottotitolo**, non la pastiglia dei filtri: quella compare
  // subito, il listone ci mette un attimo ad arrivare. La prima versione
  // guardava troppo presto e leggeva zero obiettivi su zero calciatori, cioè
  // misurava una pagina ancora vuota e la dava per rotta.
  const listoneCaricato = await scheda.aspetta(
    '/\\d+ di \\d+ calciatori/.test(document.body.innerText)',
    { entro: 25000 },
  )
  await scheda.aspetta('/[1-9]\\d* tuoi? obiettiv/i.test(document.body.innerText)', { entro: 15000 })

  const dati = await scheda.valuta(`(() => {
    const t = document.body.innerText
    const conteggio = (t.match(/(\\d+)\\s+tuoi? obiettiv/i) ?? [])[1] ?? null
    const sottotitolo = (t.match(/(\\d+) di (\\d+) calciatori/) ?? []).slice(1)
    const accesi = document.querySelectorAll('.border-verde-acceso').length
    return { conteggio, sottotitolo, accesi }
  })()`)

  ok(
    'Il listone aperto dall asta mostra solo il reparto in corso',
    listoneCaricato && dati.sottotitolo.length === 2 && Number(dati.sottotitolo[0]) < Number(dati.sottotitolo[1]),
    listoneCaricato
      ? `${dati.sottotitolo[0]} visibili su ${dati.sottotitolo[1]} in listone`
      : 'la schermata non e arrivata',
  )

  ok(
    'E dice quanti dei miei obiettivi sono ancora liberi, accendendoli',
    dati.conteggio !== null && Number(dati.conteggio) >= 1 && dati.accesi >= 1,
    `il conteggio dice ${dati.conteggio}, e ci sono ${dati.accesi} righe accese`,
  )

  // ─── 6. In pausa i comandi che servono ci sono ───────────────────────────
  //
  // La pausa la si mette **perché c'è qualcosa da sistemare**, e i due tasti
  // per sistemarlo sparivano appena la si metteva. Questo si vede solo
  // aprendo la pagina: il server li avrebbe pure accettati, era
  // l'interfaccia a non offrirli.
  await rpc('pausa_asta', { p_lega: lega, p_in_pausa: true })
  const [daChiudere] = await sql(`select lo.id, lo.current_bidder_team_id chi
    from public.auction_lots lo join public.auctions a on a.id = lo.auction_id
    where a.league_id = '${lega}' and lo.status = 'open' limit 1;`)
  if (daChiudere) {
    await rpc(daChiudere.chi ? 'aggiudica_ora' : 'passa_lotto', { p_lotto: daChiudere.id })
  }

  await scheda.vaiA(`${sito.indirizzo}/lega/${lega}/asta`)
  await scheda.aspetta(`${testo}.includes('pausa')`, { entro: 20000 })

  const comandi = await scheda.valuta(`(() => {
    const tasti = [...document.querySelectorAll('button')].map((b) => ({
      testo: b.innerText.trim(),
      spento: b.disabled,
    }))
    const trova = (r) => tasti.find((t) => r.test(t.testo)) ?? null
    return {
      nome: trova(/all.asta un nome/i),
      assegna: trova(/assegna senza asta/i),
      riprendi: trova(/comincia|riprendi/i),
    }
  })()`)

  ok(
    'Con l asta in pausa restano il nome da chiamare e l assegnazione diretta',
    Boolean(comandi.nome) && !comandi.nome.spento &&
      Boolean(comandi.assegna) && !comandi.assegna.spento,
    `«${comandi.nome?.testo ?? 'assente'}» e «${comandi.assegna?.testo ?? 'assente'}»` +
      ` · per ripartire: «${comandi.riprendi?.testo ?? 'assente'}»`,
  )

  // ─── 7. «È tuo!» sul dispositivo personale ───────────────────────────────
  //
  // Vincere un'asta è il motivo per cui si gioca, e sul telefono non succedeva
  // niente: il calciatore spariva dalla fascia in alto e ricompariva in fondo,
  // nella propria rosa, dove nessuno stava guardando. Si capiva di aver vinto
  // dal fatto che i crediti erano scesi.
  //
  // La pagina è già aperta dal controllo qui sopra: si assegna un calciatore
  // alla squadra di chi guarda e si controlla che il riquadro arrivi.
  const [miaSquadra] = await sql(
    `select id from public.teams where league_id = '${lega}' and user_id = '${capo.user.id}';`,
  )
  const [daRegalare] = await sql(`select p.id, p.name from public.players p
    where p.season = '${STAGIONE}' and p.role = 'P' and p.active
      and not exists (select 1 from public.roster_players r
                      where r.league_id = '${lega}' and r.player_id = p.id)
    limit 1;`)
  await rpc('assegna_rapido', {
    p_lega: lega,
    p_player_id: daRegalare.id,
    p_squadra: miaSquadra.id,
    p_prezzo: 9,
  })

  const festeggiato = await scheda.aspetta(`${testo}.includes('è tuo')`, { entro: 12000 })
  const cosaDice = await scheda.valuta(`(() => {
    const n = [...document.querySelectorAll('div')].find((d) => /è tuo!/i.test(d.innerText))
    return n ? n.innerText.replace(/\\n/g, ' · ').slice(0, 90) : null
  })()`)
  ok(
    'Quando ti aggiudichi un calciatore il telefono te lo dice',
    festeggiato,
    festeggiato ? `«${cosaDice}»` : `${daRegalare.name} assegnato, ma il riquadro non e comparso`,
  )

  // E se ne va da solo: un avviso che resta coprirebbe il calciatore dopo, che
  // nei metodi a estrazione arriva subito.
  const sparito = await scheda.aspetta(`!${testo}.includes('è tuo')`, { entro: 8000 })
  ok(
    'E se ne va da solo, senza coprire il calciatore successivo',
    sparito,
    sparito ? 'sparito entro otto secondi' : 'e rimasto li: coprirebbe la chiamata dopo',
  )

  // ─── 8. Il link d'invito porta davvero da qualche parte ──────────────────
  //
  // È il link che finisce su WhatsApp, ed è l'unico che **non si può provare
  // da soli**: si scopre che è rotto sul telefono di qualcun altro, dopo
  // averlo mandato. Costruito dalla sola origine mancava del percorso base e
  // dava «404 not found».
  //
  // La prova non guarda la stringa: **apre l'indirizzo** e controlla di
  // arrivare sulla schermata d'ingresso con il codice già dentro.
  await scheda.vaiA(`${sito.indirizzo}/lega/${lega}`)
  await scheda.aspetta(`${testo}.includes('invito')`, { entro: 20000 })

  // Il link non è scritto nella pagina: vive dentro il tasto «Manda su
  // WhatsApp» e negli appunti. È esattamente la stringa che parte, quindi è
  // quella che va guardata — non una scritta che le somiglia.
  const linkInvito = await scheda.valuta(`(() => {
    const a = document.querySelector('a[href^="https://wa.me/"]')
    if (!a) return null
    const testo = decodeURIComponent(a.getAttribute('href').split('text=')[1] ?? '')
    const m = testo.match(/https?:\\/\\/[^\\s]+invito\\/[A-Z0-9]{6}/)
    return m ? m[0] : null
  })()`)

  const base = await scheda.valuta("document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? '/'")
  const radiceApp = base.replace(/manifest\.webmanifest$/, '')

  ok(
    'Il link d invito contiene il percorso base dell applicazione',
    Boolean(linkInvito) && new URL(linkInvito).pathname.startsWith(`${radiceApp}invito/`),
    linkInvito
      ? `${linkInvito} (l app sta sotto ${radiceApp})`
      : 'nessun link d invito nella pagina della lega',
  )

  if (linkInvito) {
    await scheda.vaiA(linkInvito)
    const atterrato = await scheda.aspetta(
      `${testo}.includes('entra') || ${testo}.includes('codice')`,
      { entro: 20000 },
    )
    ok(
      'E aprendolo si arriva sulla schermata d ingresso, non su un 404',
      atterrato,
      atterrato
        ? 'la pagina d ingresso si e aperta'
        : `pagina sbagliata: «${(await scheda.valuta('document.body.innerText')).slice(0, 120)}»`,
    )
  }

  // ─── 9. Una sessione da ospite non è un accesso ──────────────────────────
  //
  // Per il televisore è acceso l'accesso anonimo, e quella sessione resta nel
  // browser insieme a tutte le altre. Chi aveva aperto una volta il link della
  // TV risultava «dentro» per sempre, e aprendo un invito entrava in lega
  // creando una squadra senza account. È successo nella lega vera.
  const ospite = await (
    await fetch(`${URL_BASE}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  ).json()

  await scheda.vaiA(sito.indirizzo)
  await scheda.valuta(`localStorage.setItem(${JSON.stringify(`sb-${ref}-auth-token`)}, ${JSON.stringify(
    JSON.stringify({
      access_token: '@@GETTONE@@',
      refresh_token: '@@RINFRESCO@@',
      expires_at: Math.floor(Date.now() / 1000) + 3000,
      expires_in: 3000,
      token_type: 'bearer',
      user: { id: '@@ID@@', is_anonymous: true },
    }),
  )
    .replace('@@GETTONE@@', ospite.access_token)
    .replace('@@RINFRESCO@@', ospite.refresh_token)
    .replace('@@ID@@', ospite.user.id)})`)

  await scheda.vaiA(`${sito.indirizzo}/invito/${codiceLega}`)
  const respinto = await scheda.aspetta(
    `${testo}.includes('accedi') || ${testo}.includes('registrati') || ${testo}.includes('password')`,
    { entro: 20000 },
  )
  ok(
    'Con una sessione da ospite l invito porta all accesso, non dentro la lega',
    respinto,
    respinto
      ? 'la schermata di accesso'
      : `e entrato lo stesso: «${(await scheda.valuta('document.body.innerText')).slice(0, 140)}»`,
  )

  // E il server dice di no comunque, che è la difesa che conta.
  const provaOspite = await (
    await fetch(`${URL_BASE}/rest/v1/rpc/entra_in_lega`, {
      method: 'POST',
      headers: {
        apikey: CHIAVE,
        Authorization: `Bearer ${ospite.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_codice: codiceLega, p_nome_squadra: 'Intruso' }),
    })
  ).json()
  const rispostaOspite = Array.isArray(provaOspite) ? provaOspite[0] : provaOspite
  ok(
    'E il server lo rifiuta comunque, anche saltando l interfaccia',
    rispostaOspite?.esito === 'non_autenticato',
    `«${rispostaOspite?.esito}: ${rispostaOspite?.messaggio}»`,
  )
  await sql(`delete from auth.users where id = '${ospite.user.id}';`)

  // ─── 10. Niente eccezioni ────────────────────────────────────────────────
  const esplosioni = scheda.console.filter((c) => c.tipo === 'eccezione' || c.tipo === 'error')
  ok(
    'Nessuna eccezione nella console del browser',
    esplosioni.length === 0,
    esplosioni.length === 0
      ? 'console pulita'
      : esplosioni.map((e) => e.testo.slice(0, 120)).join(' · '),
  )
} finally {
  await chiudiTutto()
}

const passate = esiti.filter((e) => e.buono).length
console.log(`\n${passate} superate su ${esiti.length}.`)
if (passate < esiti.length) {
  console.log('\nFallite:')
  for (const e of esiti.filter((x) => !x.buono)) console.log(`  · ${e.nome}`)
}
console.log('Pulisci con: node scripts/verifica-schermo-vivo.mjs --pulisci')
process.exit(passate === esiti.length ? 0 : 1)
