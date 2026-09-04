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
import { existsSync } from 'node:fs'
import { CHIAVE, URL_BASE, ref, sql } from './lib/fm.mjs'
import { apriBrowser, apriScheda, serviCartella } from './lib/browser.mjs'

const radice = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(radice, 'app', 'dist')
const DOMINIO = 'prova.vivo.fantasta'
const STAGIONE = 'PROVA-VIVO'

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

const sito = await serviCartella(DIST)
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
  const rilancioVisto = await scheda.aspetta(
    "[...document.querySelectorAll('p')].some(p => p.innerText.trim() === '7' && parseFloat(getComputedStyle(p).fontSize) > 60)",
    { entro: 12000 },
  )
  ok(
    'Un rilancio fatto da un altro dispositivo compare sullo schermo',
    rilancioVisto,
    rilancioVisto ? 'l offerta 7 e apparsa' : 'l offerta non e mai arrivata: lo schermo non si aggiorna',
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

  // ─── 5. Niente eccezioni ─────────────────────────────────────────────────
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
