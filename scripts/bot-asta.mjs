// ═══════════════════════════════════════════════════════════════════════════
// I bot: gli avversari che rilanciano da soli, per provare un'asta vera senza
// radunare otto persone.
//
// PERCHE' SERVONO, E COSA DIMOSTRANO
//
// L'asta e' l'unica parte dell'applicazione che nessuna verifica lato server
// riesce a provare per intero, perche' non e' fatta di richieste: e' fatta di
// **tempo**. Il countdown che riparte, due offerte che arrivano nello stesso
// secondo, la catena che apre il lotto dopo, i crediti che scendono mentre
// guardi. Le prove automatiche verificano una richiesta alla volta; qui serve
// che le cose si accavallino.
//
// Servivano otto amici. Adesso ne servono zero.
//
// COME PARLANO AL SERVER, CHE E' TUTTO IL PUNTO
//
// I bot **non toccano il database**. Fanno l'accesso come i compagni finti,
// con la loro email e la loro password, e chiamano le stesse identiche
// funzioni che chiama l'app quando premi un tasto: `rilancia`, `passa`,
// `chiama_calciatore`. Se il server rifiuta un'offerta a loro, la
// rifiuterebbe a una persona.
//
// Un bot che scrivesse nel database con la chiave di amministrazione sarebbe
// piu' semplice da scrivere e non proverebbe niente: dimostrerebbe che la
// chiave di amministrazione funziona.
//
// Anche lo stato lo leggono dalla porta dell'app, non dal database: cosi'
// vedono quello che vede un partecipante, e se una regola di accesso cambia
// se ne accorgono come se ne accorgerebbe una persona. Il perche' esteso e'
// scritto sopra la funzione che legge.
//
// PERCHE' NON VINCONO SEMPRE
//
// Un bot che rilancia finche' ha crediti vincerebbe tutto, e non sarebbe una
// prova: sarebbe un muro. Ognuno si da' un **valore** per il calciatore in
// asta e sopra quello si ferma, come una persona. Il valore nasce dai crediti
// che gli restano e dai posti che deve ancora riempire, quindi si corregge da
// solo: chi ha speso troppo all'inizio diventa prudente, chi ha tenuto i
// crediti in tasca diventa pericoloso nel finale.
//
// PERCHE' ASPETTANO PRIMA DI RILANCIARE
//
// Un bot che risponde in cinquanta millisecondi trasforma ogni lotto in una
// raffica fra macchine, e chi gioca dal telefono non fa in tempo a premere.
// Ognuno ha il suo tempo di reazione, diverso da bot a bot, e piu' corto
// quando il prezzo e' ancora lontano dal suo limite: e' anche il modo in cui
// si scoprono i difetti veri, perche' due offerte che partono insieme sono
// esattamente il caso difficile.
//
// Uso:
//   node scripts/bot-asta.mjs                 tutti i compagni finti giocano
//   node scripts/bot-asta.mjs --senza marco   tranne uno, che comandi tu
//   node scripts/bot-asta.mjs --fame 1.3      quanto sono disposti a spendere
//   node scripts/bot-asta.mjs --lega Q4C4HQ   se hai piu' di una lega
//   node scripts/bot-asta.mjs --riepilogo     chi ha comprato cosa, e basta
//
// Si ferma con Ctrl+C, e alla fine dice come sono andate le rose.
// ═══════════════════════════════════════════════════════════════════════════

import {
  CHIAVE,
  URL_BASE,
  accedi,
  amiciInLega,
  argomento,
  cita,
  leggi,
  rpc,
  sql,
  trovaLega,
} from './lib/amici.mjs'

const lega = await trovaLega()
const FAME = Number(argomento('--fame') ?? 1)
const esclusi = (argomento('--senza') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// ═══════════════════════════════════════════════════════════════════════════
// Il riepilogo, che serve anche da solo
// ═══════════════════════════════════════════════════════════════════════════

async function riepilogo() {
  const squadre = await sql(`select t.name, b.credits_remaining crediti,
      b.presi_p, b.presi_d, b.presi_c, b.presi_a, b.slot_rimanenti
    from public.teams t join public.team_budget b on b.team_id = t.id
    where t.league_id = ${cita(lega.id)} order by t.name;`)

  console.log(`\nLega «${lega.name}»\n`)
  console.log('  squadra                crediti   P  D  C  A   mancano')
  for (const s of squadre) {
    console.log(
      `  ${s.name.padEnd(22)} ${String(s.crediti).padStart(6)}   ` +
        `${s.presi_p}  ${s.presi_d}  ${s.presi_c}  ${s.presi_a}   ` +
        `${s.slot_rimanenti}`,
    )
  }

  const spesi = await sql(`select p.name, p.role, r.price, t.name squadra
    from public.roster_players r
    join public.players p on p.id = r.player_id
    join public.teams t on t.id = r.team_id
    where t.league_id = ${cita(lega.id)}
    order by r.price desc limit 10;`)
  if (spesi.length) {
    console.log('\n  I dieci pagati di piu\':')
    for (const s of spesi) {
      console.log(`    ${String(s.price).padStart(4)}  ${s.name.padEnd(22)} ${s.role}  ${s.squadra}`)
    }
  }
}

if (process.argv.includes('--riepilogo')) {
  await riepilogo()
  process.exit(0)
}

// ═══════════════════════════════════════════════════════════════════════════
// Chi gioca
// ═══════════════════════════════════════════════════════════════════════════

const amici = (await amiciInLega(lega.id)).filter(
  (a) => !esclusi.includes(a.email.split('@')[0]),
)

if (amici.length === 0) {
  console.error(
    'Non ci sono compagni finti in questa lega.\n' +
      'Creali prima:  node scripts/amici-di-prova.mjs',
  )
  process.exit(1)
}

/**
 * Il carattere di un bot, sempre lo stesso per la stessa persona.
 *
 * Nasce dall'email invece che dal caso: se cambiasse a ogni riavvio, due
 * partite non sarebbero confrontabili e un difetto visto una volta non si
 * riprodurrebbe piu'. Cosi' invece «Marco strapaga i portieri» resta vero
 * anche domani.
 */
function carattere(email) {
  let n = 0
  for (const c of email) n = (n * 31 + c.charCodeAt(0)) >>> 0
  const q = (k, min, max) => min + (((n >>> (k * 5)) % 1000) / 1000) * (max - min)
  return {
    // Quanto e' disposto a pagare rispetto al valore di mercato.
    generosita: q(0, 0.78, 1.35),
    // Quanto ci mette a rispondere.
    reazione: Math.round(q(1, 900, 3000)),
    // Il reparto per cui perde la testa.
    debole: ['P', 'D', 'C', 'A'][(n >>> 11) % 4],
  }
}

const bot = []
for (const a of amici) {
  const c = carattere(a.email)
  bot.push({
    nome: a.email.split('@')[0],
    email: a.email,
    squadra: a.squadra,
    idSquadra: a.squadra_id,
    token: await accedi(a.email),
    ...c,
    // Il momento in cui questo bot ha guardato il lotto per l'ultima volta.
    passato: new Set(),
  })
}

console.log(`\n${bot.length} avversari in campo nella lega «${lega.name}».\n`)
for (const b of bot) {
  console.log(
    `  ${b.squadra.padEnd(22)} ${b.nome.padEnd(10)} ` +
      `paga ${Math.round(b.generosita * 100)}% del valore · risponde in ${(b.reazione / 1000).toFixed(1)}s · ` +
      `debole per i ${{ P: 'portieri', D: 'difensori', C: 'centrocampisti', A: 'attaccanti' }[b.debole]}`,
  )
}
console.log('\nCtrl+C per fermarli.\n')

// ═══════════════════════════════════════════════════════════════════════════
// Lo stato, letto dalla stessa porta da cui legge l'app
// ═══════════════════════════════════════════════════════════════════════════

// PERCHE' NON CON LA CONNESSIONE DI SERVIZIO
//
// La prima versione leggeva lo stato con la connessione di amministrazione:
// una query sola, comoda. Due conti dicono che era sbagliata.
//
// Il primo e' aritmetico: quell'interfaccia consente sessanta richieste al
// minuto, e un giro ogni secondo con quattro letture ne fa duecentoquaranta.
// Un'asta vera dura quaranta minuti. Si sarebbe fermata da sola, nel mezzo,
// con un errore che non parla di aste.
//
// Il secondo conta di piu': i bot devono vedere **quello che vede un
// partecipante**, non quello che vede il padrone del database. Leggendo dalla
// porta dell'app, se una regola di accesso nasconde qualcosa a una persona lo
// nasconde anche a loro — e se domani qualcuno stringe una policy per sbaglio,
// i bot smettono di funzionare invece di continuare a girare su dati che
// nessun giocatore vedrebbe.

/**
 * Gli occhi con cui si legge lo stato: il token di uno qualsiasi dei bot.
 *
 * Non è una costante perché **i token scadono**. Un'asta vera dura ore, un
 * token di Supabase un'ora: alla scadenza tutte le letture avrebbero
 * cominciato a rispondere 401, e i bot sarebbero rimasti fermi a guardare
 * senza che nessuno capisse perché. Si rifà l'accesso e si continua.
 */
let occhi = bot[0].token

/** Rifà l'accesso per tutti, e restituisce quanti ne ha rinnovati. */
async function rinnovaAccessi() {
  let quanti = 0
  for (const b of bot) {
    try {
      b.token = await accedi(b.email)
      quanti++
    } catch {
      // Se proprio non si riesce, si riprova al giro dopo: meglio un bot
      // fermo per un minuto che tutti spenti per sempre.
    }
  }
  if (quanti) occhi = bot[0].token
  return quanti
}

/**
 * Lo scarto fra l'orologio di questo computer e quello del server.
 *
 * I bot decidono se e' ora di rilanciare guardando da quanti secondi nessuno
 * offre. Se i due orologi non sono d'accordo di tre secondi, o rilanciano
 * tutti subito o non rilancia nessuno, e non si capisce perche'. Si misura una
 * volta sola all'avvio, dall'intestazione della prima risposta.
 */
let scarto = 0
{
  const r = await fetch(`${URL_BASE}/rest/v1/leagues?id=eq.${lega.id}&select=min_bid,season`, {
    headers: { apikey: CHIAVE, Authorization: `Bearer ${occhi}` },
  })
  const quando = r.headers.get('date')
  if (quando) scarto = new Date(quando).getTime() - Date.now()
  const [l] = await r.json()
  if (!l) {
    console.error('Non riesco a leggere la lega con il token di un compagno.')
    process.exit(1)
  }
  lega.min_bid = l.min_bid
  lega.season = l.season
  if (Math.abs(scarto) > 1500) {
    console.log(`  (l'orologio di questo computer e' avanti/indietro di ${Math.round(scarto / 1000)}s: ne tengo conto)\n`)
  }
}
const adesso = () => Date.now() + scarto

async function stato() {
  const [aste, budget] = await Promise.all([
    leggi(occhi, `auctions?league_id=eq.${lega.id}&select=*`),
    leggi(occhi, `team_budget?league_id=eq.${lega.id}&select=*`),
  ])
  const a = aste[0]
  if (!a) return null

  const lotti = await leggi(
    occhi,
    `auction_lots?auction_id=eq.${a.id}&status=eq.open&select=*,players(id,name,role,serie_a_team,quotation)`,
  )
  const l = lotti[0]
  const passi = l ? await leggi(occhi, `lot_passes?lot_id=eq.${l.id}&select=team_id`) : []

  return {
    asta: {
      id: a.id,
      status: a.status,
      method: a.method,
      variant: a.variant,
      bid_type: a.bid_type,
      fase: a.current_role_phase,
      turno: a.current_turn_index,
      ordine: a.nomination_order,
      min_bid: lega.min_bid,
      season: lega.season,
    },
    lotto: l && {
      id: l.id,
      player_id: l.player_id,
      current_bid: l.current_bid,
      chi: l.current_bidder_team_id,
      da_quanto: (adesso() - new Date(l.last_bid_at).getTime()) / 1000,
      name: l.players?.name ?? '?',
      ruolo: l.players?.role ?? '?',
      quotation: l.players?.quotation ?? 1,
      serie_a_team: l.players?.serie_a_team ?? '',
    },
    budget: new Map(
      budget.map((x) => [
        x.team_id,
        {
          crediti: x.credits_remaining,
          massimo: x.massimo_offribile,
          slot_rimanenti: x.slot_rimanenti,
          presi_p: x.presi_p,
          presi_d: x.presi_d,
          presi_c: x.presi_c,
          presi_a: x.presi_a,
        },
      ]),
    ),
    passi: new Set(passi.map((p) => p.team_id)),
  }
}

/**
 * Il mercato che resta: quanto costa, in media, un posto ancora da riempire.
 *
 * Serve a dare un prezzo ai calciatori senza inventare una tabella di valori.
 * Si guarda quanti posti restano in tutta la lega, si prendono i calciatori
 * ancora liberi migliori in quel numero, e la media delle loro quotazioni e'
 * il «prezzo di un posto»: un calciatore da quotazione doppia rispetto a
 * quella media vale due posti.
 *
 * E' questa media che fa correggere i bot da soli. Se qualcuno strapaga, i
 * calciatori buoni finiscono e la media di quelli rimasti scende: da quel
 * momento tutti valutano meno, e nessuno resta a fine asta con venti crediti
 * e sei posti vuoti.
 *
 * Si aggiorna ogni trenta secondi. Cambia lentamente, e ricalcolarla a ogni
 * offerta sarebbe solo lavoro per il database.
 */
let listone = null
let mercato = { quando: 0, media: {} }

async function prezzoDiUnPosto(stagione) {
  if (Date.now() - mercato.quando < 30000) return mercato.media
  if (!listone) {
    listone = await leggi(
      occhi,
      `players?season=eq.${encodeURIComponent(stagione)}&active=is.true&select=id,role,quotation`,
    )
  }
  const presi = new Set(
    (await leggi(occhi, `roster_players?league_id=eq.${lega.id}&select=player_id`)).map(
      (r) => r.player_id,
    ),
  )
  const postiLiberi = { P: 0, D: 0, C: 0, A: 0 }
  const b = await leggi(occhi, `team_budget?league_id=eq.${lega.id}&select=*`)
  const regolamento = (
    await leggi(occhi, `leagues?id=eq.${lega.id}&select=slots_p,slots_d,slots_c,slots_a`)
  )[0] ?? { slots_p: 0, slots_d: 0, slots_c: 0, slots_a: 0 }
  for (const x of b) {
    postiLiberi.P += Math.max(0, regolamento.slots_p - x.presi_p)
    postiLiberi.D += Math.max(0, regolamento.slots_d - x.presi_d)
    postiLiberi.C += Math.max(0, regolamento.slots_c - x.presi_c)
    postiLiberi.A += Math.max(0, regolamento.slots_a - x.presi_a)
  }

  const media = {}
  for (const ruolo of ['P', 'D', 'C', 'A']) {
    const liberi = listone
      .filter((p) => p.role === ruolo && !presi.has(p.id))
      .sort((x, y) => y.quotation - x.quotation)
      .slice(0, Math.max(1, postiLiberi[ruolo]))
    media[ruolo] = liberi.length
      ? liberi.reduce((s, p) => s + p.quotation, 0) / liberi.length
      : 1
  }
  mercato = { quando: Date.now(), media }
  return media
}

/**
 * Di quanto rilancia, che non e' «uno piu' dell'altro».
 *
 * PERCHE' NON BASTA +1
 *
 * La prima versione offriva sempre il minimo sindacale. Sembra prudente ed e'
 * il contrario: se un bot e' disposto ad arrivare a duecento e l'offerta e' a
 * tre, ci mette duecento rilanci — e ogni rilancio azzera il tempo di
 * inattivita', quindi il lotto **non si chiude mai**. La prima prova l'ha
 * mostrato senza possibilita' di equivoco: novanta secondi, un calciatore
 * solo assegnato, ventidue offerte tutte sullo stesso.
 *
 * Nessuno gioca cosi'. Chi ci tiene salta, e il salto e' grande quando c'e'
 * molto spazio e diventa un'unghia quando si e' vicini al proprio limite: e'
 * il modo in cui si dice «io ci sono» senza scoprirsi del tutto. Cosi' un
 * lotto si risolve in tre o quattro rilanci, e l'asta cammina.
 */
function quantoOffre(offertaAttuale, tetto, minimo, massimo) {
  const spazio = tetto - offertaAttuale
  const salto =
    spazio > 12 ? Math.max(1, Math.round(spazio * (0.12 + Math.random() * 0.2))) : 1
  return Math.min(tetto, massimo, Math.max(offertaAttuale + salto, minimo))
}

/** Quanto vale, per questo bot, il calciatore in asta. */
function valore(b, budget, lotto, mediaRuolo) {
  const media = mediaRuolo[lotto.ruolo] || lotto.quotation || 1
  // I crediti che gli restano, spalmati sui posti che gli restano, moltiplicati
  // per quanto questo calciatore vale rispetto a un posto medio.
  const perPosto = budget.crediti / Math.max(1, budget.slot_rimanenti)
  const quanteVolte = lotto.quotation / media
  const debolezza = lotto.ruolo === b.debole ? 1.25 : 1
  const capriccio = 0.9 + Math.random() * 0.2
  const v = perPosto * quanteVolte * b.generosita * debolezza * capriccio * FAME
  return Math.max(1, Math.min(Math.round(v), budget.massimo))
}

const ORA = () => new Date().toLocaleTimeString('it-IT')

// ═══════════════════════════════════════════════════════════════════════════
// Il giro
// ═══════════════════════════════════════════════════════════════════════════

let ultimoLotto = null
let ultimoStato = null
let senzaAsta = false
let fermati = false
process.on('SIGINT', () => {
  fermati = true
})

while (!fermati) {
  let s
  try {
    s = await stato()
  } catch (e) {
    // Un 401 vuol dire token scaduto, non asta finita: si rifà l'accesso.
    if (e.stato === 401) {
      const quanti = await rinnovaAccessi()
      console.log(`${ORA()}  accessi rinnovati (${quanti} su ${bot.length})`)
    } else {
      console.log(`${ORA()}  il server non risponde: ${e.message.slice(0, 90)}`)
    }
    await new Promise((r) => setTimeout(r, 3000))
    continue
  }

  // Nessuna asta: si aspetta, **non si esce**.
  //
  // Prima qui si usciva, e la frase era «questa lega non ha ancora un'asta».
  // Detta in mezzo a un'asta vera era falsa due volte: l'asta c'era, e i bot
  // se ne sono andati lasciando la partita a metà. Un attrezzo che si spegne
  // da solo mentre serve è peggio di uno che non parte.
  if (!s) {
    if (!senzaAsta) {
      console.log(`${ORA()}  questa lega non ha ancora un'asta: aspetto che venga aperta`)
      senzaAsta = true
    }
    await new Promise((r) => setTimeout(r, 3000))
    continue
  }
  senzaAsta = false

  if (s.asta.status !== ultimoStato) {
    ultimoStato = s.asta.status
    const parole = {
      draft: 'non ancora aperta: aprila dall\'app',
      open: 'aperta, si gioca',
      paused: 'in pausa',
      closed: 'chiusa',
    }
    console.log(`${ORA()}  asta ${parole[s.asta.status] ?? s.asta.status}`)
    if (s.asta.status === 'closed') break
  }

  if (s.asta.status !== 'open') {
    await new Promise((r) => setTimeout(r, 2000))
    continue
  }

  // ─── Nessun lotto aperto: se tocca a un bot, chiama ───────────────────────
  if (!s.lotto) {
    if (s.asta.method === 'chiamata' && Array.isArray(s.asta.ordine)) {
      const diTurno = s.asta.ordine[s.asta.turno ?? 0]
      const chi = bot.find((b) => b.idSquadra === diTurno)
      if (chi) await chiama(chi, s)
    }
    await new Promise((r) => setTimeout(r, 1200))
    continue
  }

  // ─── Un lotto nuovo: si riparte da zero con i passi ───────────────────────
  if (s.lotto.id !== ultimoLotto) {
    ultimoLotto = s.lotto.id
    for (const b of bot) b.passato.delete(s.lotto.id)
    console.log(
      `\n${ORA()}  ── in asta: ${s.lotto.name} (${s.lotto.ruolo}, ${s.lotto.serie_a_team}), ` +
        `quotazione ${s.lotto.quotation}, base ${s.lotto.current_bid}`,
    )
  }

  // Anche questa legge dal server, e anche questa può andare storta: fuori dal
  // riparo un errore qui farebbe cadere l'intero processo nel mezzo di un
  // lotto. Se non si riesce a rileggere il mercato si usa quello di prima —
  // cambia lentamente, e un giro con i prezzi di trenta secondi fa è
  // infinitamente meglio di cinque bot che spariscono.
  let mediaRuolo
  try {
    mediaRuolo = await prezzoDiUnPosto(s.asta.season)
  } catch {
    mediaRuolo = mercato.media
    if (!Object.keys(mediaRuolo).length) {
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
  }

  // Chi ha aspettato abbastanza rilancia. Uno per giro: appena uno rilancia,
  // il tempo riparte per tutti, ed e' esattamente quello che succede fra
  // persone.
  const candidati = []
  for (const b of bot) {
    if (s.lotto.chi === b.idSquadra) continue
    if (s.passi.has(b.idSquadra)) continue
    const budget = s.budget.get(b.idSquadra)
    if (!budget || budget.slot_rimanenti <= 0) continue

    const v = valore(b, budget, s.lotto, mediaRuolo)
    const offerta = quantoOffre(s.lotto.current_bid, v, s.asta.min_bid, budget.massimo)
    if (offerta > v || offerta > budget.massimo) {
      // Non lo vuole. Se l'asta e' con passo, lo dice: e' l'unico modo di
      // chiudere il lotto prima che scada il tempo.
      if (s.asta.bid_type === 'con_passo' && !b.passato.has(s.lotto.id)) {
        b.passato.add(s.lotto.id)
        const r = await rpc(b.token, 'passa', { p_lotto: s.lotto.id })
        if (r.corpo?.esito === 'ok') console.log(`${ORA()}  ${b.squadra} passa`)
      }
      continue
    }
    // Quanto ci mette a decidersi: poco se il prezzo e' ancora lontano dal
    // suo limite, molto quando ci si avvicina. E' il gesto che si vede a un
    // tavolo vero — la mano che parte subito, o che resta a mezz'aria — ed e'
    // anche quello che tiene l'asta in movimento: senza, ogni rilancio costava
    // tre secondi buoni a chiunque, e un lotto solo si mangiava mezzo minuto.
    const vicinanza = Math.min(1, s.lotto.current_bid / Math.max(1, v))
    const esita = b.reazione * (0.3 + 0.7 * vicinanza)
    if ((s.lotto.da_quanto ?? 99) * 1000 < esita) continue
    candidati.push({ b, offerta, v })
  }

  if (candidati.length) {
    // Se piu' d'uno e' pronto, tocca a chi ci tiene di piu'.
    candidati.sort((x, y) => y.v - x.v)
    const { b, offerta, v } = candidati[0]
    const r = await rpc(b.token, 'rilancia', { p_lotto: s.lotto.id, p_importo: offerta })
    const esito = r.corpo?.esito ?? `http ${r.stato}`
    if (esito === 'ok') {
      console.log(`${ORA()}  ${b.squadra.padEnd(22)} offre ${String(offerta).padStart(4)}   (fin dove arriva: ${v})`)
    } else if (esito !== 'offerta_troppo_bassa' && esito !== 'lotto_chiuso') {
      console.log(`${ORA()}  ${b.squadra}: il server dice «${esito}»`)
      if (esito === 'ruolo_pieno' || esito === 'reparto_chiuso' || esito === 'rosa_completa') {
        b.passato.add(s.lotto.id)
      }
    }
  }

  await new Promise((r) => setTimeout(r, 700))
}

/** Tocca a un bot chiamare: sceglie chi vuole e apre. */
async function chiama(b, s) {
  const ruolo =
    s.asta.variant === 'totale' ? null : s.asta.fase
  const righe = await sql(`select p.id, p.name, p.quotation, p.role::text ruolo
    from public.players p
    where p.active and p.season = ${cita(s.asta.season)}
      ${ruolo ? `and p.role = ${cita(ruolo)}` : ''}
      and not exists (
        select 1 from public.roster_players r
        join public.teams t on t.id = r.team_id and t.league_id = ${cita(lega.id)}
        where r.player_id = p.id)
    order by p.quotation desc limit 25;`)
  if (!righe.length) return

  // Non sempre il migliore: fra i primi venticinque, uno a caso pesato verso
  // l'alto. Chiamare sempre il piu' caro non e' come si comporta nessuno.
  const scelto = righe[Math.floor(Math.random() ** 2 * righe.length)]
  const r = await rpc(b.token, 'chiama_calciatore', {
    p_lega: lega.id,
    p_player_id: scelto.id,
    p_importo: s.asta.min_bid,
  })
  const esito = r.corpo?.esito ?? `http ${r.stato}`
  if (esito === 'ok') {
    console.log(`\n${ORA()}  ${b.squadra} chiama ${scelto.name} (${scelto.ruolo})`)
  } else if (esito !== 'non_e_il_tuo_turno') {
    console.log(`${ORA()}  ${b.squadra} non riesce a chiamare: «${esito}»`)
  }
}

console.log('\nBot fermati.')
await riepilogo()
