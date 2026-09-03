import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { MarchioFantasta } from '@/components/MarchioFantasta'
import { Bottone } from '@/components/Bottone'
import { useLega } from '@/features/leghe/api'
import { totaleSlot } from '@/features/leghe/tipi'
import {
  useAsta,
  useBudgetSquadre,
  useCanaleAsta,
  useChiudiLottoScaduto,
  useLottoCorrente,
  useRose,
  useScartoOrologio,
  type AcquistoInRosa,
  type BudgetSquadra,
  type Lotto,
} from '@/features/asta/api'
import { useTimerAsta } from '@/features/asta/useTimer'
import {
  attivaAudio,
  impostaSuoniAccesi,
  impostaVolume,
  suonoAggiudicazione,
  suonoChiamata,
  suonoPartenzaCountdown,
  suonoCampanella,
  suonoRilancio,
  suonoTic,
} from '@/features/asta/suoni'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from '@/features/obiettivi/tipi'
import { Volto } from '@/components/Volto'
import { useVolti } from '@/features/listone/volti'
import type { Ruolo } from '@/domain/listone'

/**
 * Lo schermo condiviso: la pagina da proiettare sul televisore.
 *
 * Non ha comandi e non mostra **nessun dato privato**, nemmeno di chi l'ha
 * aperta: se l'amministratore proietta dal suo portatile, i suoi obiettivi non
 * devono finire sul televisore. Per questo è una pagina a sé e non la vista
 * personale con un interruttore.
 *
 * Si guarda da tre metri: la scala tipografica è sua, non quella del telefono
 * ingrandita.
 */
export function PaginaSchermoAsta() {
  const { id: idLega } = useParams()
  const { data: lega } = useLega(idLega)
  const { data: asta } = useAsta(idLega)
  const { data: lotto } = useLottoCorrente(asta?.id)
  const { data: budget } = useBudgetSquadre(idLega)
  const { data: rose } = useRose(idLega)
  const { connesso } = useCanaleAsta(idLega)
  const scarto = useScartoOrologio()
  const timer = useTimerAsta(lotto, asta, scarto)
  const chiudi = useChiudiLottoScaduto(idLega)

  const [audioPronto, setAudioPronto] = useState(false)
  const [suoni, setSuoni] = useState(true)

  // ─── Suoni, guardando cosa è cambiato ─────────────────────────────────────
  const lottoPrecedente = useRef<string | null>(null)
  const offertaPrecedente = useRef<number>(0)
  const fasePrecedente = useRef<string>('nessuno')
  const secondoPrecedente = useRef<number>(-1)
  const acquistiPrecedenti = useRef<number>(-1)
  const chiusuraChiesta = useRef<string | null>(null)

  useEffect(() => {
    if (!audioPronto) return
    if (lotto && lotto.id !== lottoPrecedente.current) {
      lottoPrecedente.current = lotto.id
      offertaPrecedente.current = lotto.current_bid
      suonoChiamata()
    } else if (lotto && lotto.current_bid > offertaPrecedente.current) {
      suonoRilancio(lotto.current_bid, lega?.credits_initial ?? 500)
      offertaPrecedente.current = lotto.current_bid
    }
    if (!lotto) lottoPrecedente.current = null
  }, [lotto, audioPronto, lega?.credits_initial])

  useEffect(() => {
    if (!audioPronto) return
    if (timer.fase === 'countdown' && fasePrecedente.current === 'attesa') suonoPartenzaCountdown()
    if (timer.fase === 'countdown' && timer.mancanti !== secondoPrecedente.current) {
      secondoPrecedente.current = timer.mancanti
      if (timer.mancanti <= 3 && timer.mancanti > 0) suonoTic(timer.mancanti === 1)
    }
    fasePrecedente.current = timer.fase
  }, [timer.fase, timer.mancanti, audioPronto])

  const fasePrecedenteRuolo = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const fase = asta?.current_role_phase ?? null
    if (
      audioPronto &&
      fasePrecedenteRuolo.current !== undefined &&
      fasePrecedenteRuolo.current !== fase
    ) {
      suonoCampanella()
    }
    fasePrecedenteRuolo.current = fase
  }, [asta?.current_role_phase, audioPronto])

  useEffect(() => {
    const quanti = rose?.length ?? 0
    if (acquistiPrecedenti.current >= 0 && quanti > acquistiPrecedenti.current && audioPronto) {
      suonoAggiudicazione()
    }
    acquistiPrecedenti.current = quanti
  }, [rose?.length, audioPronto])

  // Allo scadere si chiede al server di chiudere. Decide lui: se non è
  // davvero scaduto rifiuta, e non succede niente.
  useEffect(() => {
    if (timer.fase !== 'scaduto' || !lotto) return
    if (chiusuraChiesta.current === lotto.id) return
    chiusuraChiesta.current = lotto.id
    chiudi.mutate(lotto.id)
  }, [timer.fase, lotto, chiudi])

  if (!audioPronto) {
    return <SchermataAttivazione lega={lega?.name} onAttiva={() => setAudioPronto(true)} />
  }

  const squadre = [...(budget ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const rosaCompleta = lega ? totaleSlot(lega) : 0
  const presiTotali = rose?.length ?? 0
  const totaliDaAssegnare = rosaCompleta * squadre.length
  const spesiTotali = (rose ?? []).reduce((s, r) => s + r.price, 0)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-verde-notte">
      <BarraAlta
        reparto={asta?.current_role_phase ?? null}
        nomeLega={lega?.name}
        connesso={connesso}
        inPausa={asta?.status === 'paused'}
        chiusa={asta?.status === 'closed'}
        presi={presiTotali}
        totali={totaliDaAssegnare}
        spesi={spesiTotali}
        suoni={suoni}
        onSuoni={(v) => {
          setSuoni(v)
          impostaSuoniAccesi(v)
        }}
      />

      <div className="min-h-0 shrink-0 basis-[44%] px-6 py-3">
        {lotto ? (
          <InAsta lotto={lotto} timer={timer} squadre={squadre} />
        ) : (
          <NessunaChiamata
            asta={asta}
            squadre={squadre}
            chiusa={asta?.status === 'closed'}
            slotVuoti={squadre.reduce((n, s) => n + s.slot_rimanenti, 0)}
            iniziata={presiTotali > 0}
          />
        )}
      </div>

      <FasciaSquadre
        squadre={squadre}
        rose={rose}
        lega={lega}
        idSquadraInTesta={lotto?.current_bidder_team_id}
      />
    </div>
  )
}

// ─── Attivazione dell'audio ─────────────────────────────────────────────────

function SchermataAttivazione({ lega, onAttiva }: { lega?: string; onAttiva: () => void }) {
  const [errore, setErrore] = useState<string | null>(null)

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-verde-notte px-6 text-center">
      <img src={`${import.meta.env.BASE_URL}icona-512.png`} alt="" width={160} height={160} className="size-40" />
      <MarchioFantasta className="text-6xl" />
      {lega && <p className="text-2xl text-fumo">{lega}</p>}

      <Bottone
        misura="grande"
        onClick={() => {
          void attivaAudio().then((ok) => {
            impostaVolume(0.6)
            if (!ok) {
              setErrore(
                'Il browser non mi lascia usare l’audio. Lo schermo funziona lo stesso, ma in silenzio.',
              )
            }
            onAttiva()
          })
        }}
      >
        Tocca per attivare l&apos;audio
      </Bottone>

      <p className="max-w-lg text-base text-fumo">
        Nessun browser fa partire un suono prima di un tocco. Uno solo, adesso, e per tutta la
        serata si sentiranno chiamate, rilanci e aggiudicazioni.
      </p>
      {errore && <p className="text-base text-oro">{errore}</p>}
    </div>
  )
}

// ─── Barra alta: il riepilogo totale della serata ───────────────────────────

function BarraAlta({
  reparto,
  nomeLega,
  connesso,
  inPausa,
  chiusa,
  presi,
  totali,
  spesi,
  suoni,
  onSuoni,
}: {
  reparto: Ruolo | null
  nomeLega?: string
  connesso: boolean
  inPausa: boolean
  chiusa: boolean
  presi: number
  totali: number
  spesi: number
  suoni: boolean
  onSuoni: (v: boolean) => void
}) {
  const quota = totali > 0 ? presi / totali : 0

  return (
    <header className="border-b border-verde-campo px-6 py-3">
      <div className="flex items-center gap-6">
        <MarchioFantasta className="text-3xl" />
        <p className="min-w-0 flex-1 truncate text-2xl font-bold text-nebbia">{nomeLega}</p>

        {reparto && (
          <span
            className={`rounded-full px-4 py-1 text-xl font-bold ${CLASSE_RUOLO[reparto]}`}
          >
            {NOME_RUOLO[reparto]}
          </span>
        )}

        {inPausa && (
          <span className="rounded-full bg-oro/20 px-4 py-1 text-xl font-bold text-oro">
            IN PAUSA
          </span>
        )}
        {chiusa && (
          <span className="rounded-full bg-verde-acceso/20 px-4 py-1 text-xl font-bold text-verde-acceso">
            ASTA CONCLUSA
          </span>
        )}

        <div className="cifre-fisse flex items-baseline gap-2 text-xl">
          <span className="text-fumo">assegnati</span>
          <span className="font-bold text-nebbia">
            {presi}
            <span className="text-fumo">/{totali}</span>
          </span>
        </div>
        <div className="cifre-fisse flex items-baseline gap-2 text-xl">
          <span className="text-fumo">spesi</span>
          <span className="font-bold text-oro">{spesi}</span>
        </div>

        <button
          type="button"
          onClick={() => onSuoni(!suoni)}
          aria-label={suoni ? 'Spegni i suoni' : 'Accendi i suoni'}
          className="flex size-11 items-center justify-center rounded-xl text-2xl text-fumo hover:text-nebbia"
        >
          {suoni ? '🔊' : '🔇'}
        </button>

        <span
          aria-label={connesso ? 'Collegato' : 'Non collegato'}
          title={connesso ? 'Collegato' : 'Non collegato'}
          className={`size-3 shrink-0 rounded-full ${connesso ? 'bg-verde-acceso' : 'bg-errore'}`}
        />
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-verde-campo">
        <div
          className="h-full rounded-full bg-verde-acceso transition-[width] duration-500"
          style={{ width: `${quota * 100}%` }}
        />
      </div>
    </header>
  )
}

// ─── Fascia superiore: il momento presente ──────────────────────────────────

function InAsta({
  lotto,
  timer,
  squadre,
}: {
  lotto: Lotto
  timer: { fase: string; mancanti: number; quota: number }
  squadre: BudgetSquadra[]
}) {
  const volto = useVolti()
  const offerente = squadre.find((s) => s.team_id === lotto.current_bidder_team_id)
  const stat = lotto.players.player_stats
  const inCountdown = timer.fase === 'countdown' || timer.fase === 'scaduto'

  return (
    <div className="grid h-full grid-cols-[1.2fr_auto_1fr] items-center gap-6">
      {/* Sinistra: chi è in asta, a quanto, e chi ha offerto */}
      <motion.div
        key={lotto.id}
        initial={{ opacity: 0, y: 24, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
        className="min-w-0"
      >
        <div className="flex items-center gap-4">
          {/* Da tre metri la faccia arriva prima del nome. */}
          <Volto
            nome={lotto.players.name}
            indirizzo={volto(lotto.players.photo_path)}
            classeRuolo={CLASSE_RUOLO[lotto.players.role]}
            misura={112}
          />
          <span
            className={`flex size-10 items-center justify-center rounded-xl text-xl font-extrabold ${CLASSE_RUOLO[lotto.players.role]}`}
          >
            {lotto.players.role}
          </span>
          <div className="min-w-0">
            <p className="truncate text-6xl font-extrabold leading-tight text-nebbia">
              {lotto.players.name}
            </p>
            <p className="truncate text-3xl text-fumo">
              {lotto.players.serie_a_team}
              <span className="cifre-fisse"> · quotazione {lotto.players.quotation}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-end gap-6">
          <div>
            <p className="text-2xl uppercase tracking-wide text-fumo">Offerta</p>
            <motion.p
              key={lotto.current_bid}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
              className="cifre-fisse text-[9rem] font-extrabold leading-none text-oro"
            >
              {lotto.current_bid}
            </motion.p>
          </div>
          <div className="min-w-0 pb-6">
            <p className="text-2xl text-fumo">di</p>
            <p className="truncate text-5xl font-bold text-nebbia">
              {offerente?.name ?? 'nessuno'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Centro: il countdown */}
      <div className="flex w-56 flex-col items-center justify-center">
        {inCountdown ? (
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex flex-col items-center"
          >
            <p
              className={`cifre-fisse text-[11rem] font-extrabold leading-none ${
                timer.mancanti <= 3 ? 'text-errore' : 'text-oro'
              }`}
            >
              {Math.max(0, timer.mancanti)}
            </p>
            <p className="text-2xl uppercase tracking-wide text-fumo">
              {timer.fase === 'scaduto' ? 'aggiudicato' : 'e chiudo'}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <p className="cifre-fisse text-8xl font-extrabold text-verde-acceso">
              {timer.mancanti}
            </p>
            <p className="text-2xl text-fumo">si può rilanciare</p>
          </div>
        )}
      </div>

      {/* Destra: le statistiche */}
      <div className="min-w-0">
        <p className="mb-3 text-2xl uppercase tracking-wide text-fumo">
          {stat?.matchday != null ? `Statistiche alla giornata ${stat.matchday}` : 'Statistiche'}
        </p>
        {stat ? (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            <Statistica etichetta="Partite" valore={stat.games_played} />
            <Statistica etichetta="Minuti" valore={stat.minutes} />
            <Statistica etichetta="Media voto" valore={stat.avg_vote} decimale />
            <Statistica etichetta="Fantamedia" valore={stat.fanta_avg} decimale />
            <Statistica etichetta="Gol" valore={stat.goals} />
            <Statistica etichetta="Assist" valore={stat.assists} />
            <Statistica etichetta="Ammonizioni" valore={stat.yellow_cards} />
            <Statistica etichetta="Espulsioni" valore={stat.red_cards} />
          </dl>
        ) : (
          <p className="text-2xl text-oro">
            Statistiche non ancora caricate per questo calciatore.
          </p>
        )}
      </div>
    </div>
  )
}

function Statistica({
  etichetta,
  valore,
  decimale,
}: {
  etichetta: string
  valore: number | null
  decimale?: boolean
}) {
  const mostrato =
    valore == null
      ? '–'
      : decimale
        ? valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(valore)

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-verde-campo pb-1">
      <dt className="text-2xl text-fumo">{etichetta}</dt>
      <dd className="cifre-fisse text-4xl font-bold text-nebbia">{mostrato}</dd>
    </div>
  )
}

// ─── Quando non c'è nessuno all'asta ────────────────────────────────────────

function NessunaChiamata({
  asta,
  squadre,
  chiusa,
  slotVuoti,
  iniziata,
}: {
  asta:
    | { nomination_order: string[]; current_turn_index: number; status: string; method: string }
    | null
    | undefined
  squadre: BudgetSquadra[]
  chiusa: boolean
  slotVuoti: number
  /** Vero appena e' stato assegnato il primo calciatore. */
  iniziata: boolean
}) {
  if (chiusa) {
    const ordinate = [...squadre].sort((a, b) => a.credits_remaining - b.credits_remaining)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <p className="text-7xl font-extrabold text-verde-acceso">Asta conclusa</p>
        <p className="text-3xl text-fumo">
          {slotVuoti === 0
            ? 'Tutte le rose sono complete.'
            : `Chiusa con ${slotVuoti} slot rimasti vuoti.`}
        </p>
        <ul className="cifre-fisse mt-4 flex flex-wrap justify-center gap-x-10 gap-y-2 text-2xl">
          {ordinate.map((s) => (
            <li key={s.team_id} className="text-nebbia">
              {s.name} <span className="text-fumo">· {s.credits_remaining} avanzati</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const diTurno = asta ? squadre.find((s) => s.team_id === asta.nomination_order[asta.current_turn_index]) : null

  // Nei metodi a estrazione il calciatore successivo si apre da solo. Se qui
  // non c'è nessuno vuol dire una di due cose, e vanno dette in due modi
  // diversi: o la catena non è ancora partita, o il listone si è esaurito
  // prima delle rose. Il turno non distingue niente, perché avanza anche
  // quando a scegliere è il server: quello che distingue è se qualcosa è già
  // stato assegnato.
  if (asta?.status === 'open' && asta.method !== 'chiamata') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        {iniziata ? (
          <>
            <p className="text-6xl font-extrabold text-oro">Il listone è finito</p>
            <p className="cifre-fisse text-3xl text-fumo">Restano {slotVuoti} slot da riempire.</p>
            <p className="text-2xl text-fumo">
              L&apos;amministratore rimette all&apos;asta i nomi che servono.
            </p>
          </>
        ) : (
          <>
            <p className="text-6xl font-extrabold text-nebbia">Si comincia</p>
            <p className="text-3xl text-fumo">
              L&apos;amministratore fa partire la prima estrazione.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      {asta?.status === 'open' ? (
        <>
          <p className="text-3xl text-fumo">Tocca a</p>
          <motion.p
            key={diTurno?.team_id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-8xl font-extrabold text-arancio"
          >
            {diTurno?.name ?? '—'}
          </motion.p>
          <p className="cifre-fisse text-3xl text-fumo">
            può arrivare a {diTurno?.massimo_offribile ?? 0} crediti
          </p>
        </>
      ) : (
        <>
          <p className="text-6xl font-extrabold text-nebbia">L&apos;asta non è ancora aperta</p>
          <p className="text-3xl text-fumo">
            L&apos;amministratore la apre dalla sua schermata.
          </p>
        </>
      )}
    </div>
  )
}
// ─── Fascia inferiore: le rose, per intero ──────────────────────────────────

/**
 * Tutte le squadre affiancate, con la **rosa completa** e il prezzo pagato per
 * ogni calciatore.
 *
 * PERCHE' LE ROSE PER INTERO
 * Prima qui c'erano solo dei contatori: «D 5/8». Dicono quanto manca, non
 * cosa c'è. Durante un'asta la domanda vera è un'altra: chi ha già preso il
 * portiere del Milan, e a quanto. Senza quel dato non si capisce se
 * l'avversario che rilancia sta completando un reparto o si sta togliendo uno
 * sfizio, e si offre alla cieca.
 *
 * PERCHE' ANCHE GLI SLOT VUOTI
 * Le righe mancanti si vedono, tratteggiate. Sono la cosa che alla fine della
 * serata conta di più: chi deve ancora riempire e in che reparto. E tenendo
 * il numero di righe **costante** — sempre quante ne prevede il regolamento —
 * la fascia non cambia altezza mano a mano che le rose si riempiono, che su un
 * televisore vorrebbe dire un layout che balla tutta la sera.
 *
 * PERCHE' I CREDITI STANNO IN CIMA A OGNI COLONNA
 * Sono il dato che si guarda più spesso e da più lontano. Restano fermi
 * mentre la rosa sotto cresce, e non vanno mai cercati.
 */
function FasciaSquadre({
  squadre,
  rose,
  lega,
  idSquadraInTesta,
}: {
  squadre: BudgetSquadra[]
  rose: AcquistoInRosa[] | undefined
  lega: { slots_p: number; slots_d: number; slots_c: number; slots_a: number } | null | undefined
  idSquadraInTesta: string | null | undefined
}) {
  const previsti: Record<Ruolo, number> = {
    P: lega?.slots_p ?? 3,
    D: lega?.slots_d ?? 8,
    C: lega?.slots_c ?? 8,
    A: lega?.slots_a ?? 6,
  }

  // Una passata sola su tutti gli acquisti, invece di filtrare l'elenco intero
  // dentro ogni riga di ogni colonna.
  const perSquadra = new Map<string, Record<Ruolo, AcquistoInRosa[]>>()
  for (const s of squadre) perSquadra.set(s.team_id, { P: [], D: [], C: [], A: [] })
  for (const r of rose ?? []) {
    perSquadra.get(r.team_id)?.[r.players.role].push(r)
  }
  for (const gruppi of perSquadra.values()) {
    for (const ruolo of ORDINE_RUOLI) {
      gruppi[ruolo].sort((a, b) => b.price - a.price || a.players.name.localeCompare(b.players.name, 'it'))
    }
  }

  return (
    <footer className="flex min-h-0 flex-1 gap-3 border-t border-verde-campo px-4 py-3">
      {squadre.map((s) => {
        const gruppi = perSquadra.get(s.team_id) ?? { P: [], D: [], C: [], A: [] }
        const inTesta = s.team_id === idSquadraInTesta
        const spesi = ORDINE_RUOLI.reduce(
          (n, r) => n + gruppi[r].reduce((m, x) => m + x.price, 0),
          0,
        )

        return (
          <div
            key={s.team_id}
            className={[
              'flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border transition-colors',
              inTesta ? 'border-oro bg-oro/10' : 'border-verde-campo bg-verde-campo/25',
            ].join(' ')}
          >
            {/* I crediti, sempre in cima e sempre fermi. */}
            <div className="shrink-0 border-b border-verde-campo/70 px-3 py-2">
              <p className="truncate text-[clamp(1rem,1.7vh,1.5rem)] font-bold leading-tight text-nebbia">
                {s.name}
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="cifre-fisse text-[clamp(1.6rem,3.4vh,2.75rem)] font-extrabold leading-none text-oro">
                  {s.credits_remaining}
                </span>
                <span className="cifre-fisse text-right text-[clamp(0.6rem,1.15vh,0.9rem)] leading-tight text-fumo">
                  max {s.massimo_offribile}
                  <br />
                  spesi {spesi}
                </span>
              </div>
            </div>

            {/* La rosa: una riga per ogni posto previsto, piena o vuota. */}
            <div className="min-h-0 flex-1 overflow-hidden px-2 py-1.5">
              {ORDINE_RUOLI.map((ruolo) => {
                const presi = gruppi[ruolo]
                const vuoti = Math.max(0, previsti[ruolo] - presi.length)
                return (
                  <div key={ruolo} className="mb-1 last:mb-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex size-[clamp(0.9rem,1.7vh,1.3rem)] items-center justify-center rounded text-[clamp(0.55rem,1vh,0.8rem)] font-bold ${CLASSE_RUOLO[ruolo]}`}
                      >
                        {ruolo}
                      </span>
                      <span className="cifre-fisse text-[clamp(0.55rem,1vh,0.8rem)] text-fumo">
                        {presi.length}/{previsti[ruolo]}
                      </span>
                      <span className="h-px flex-1 bg-verde-campo/60" />
                    </div>

                    {presi.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-baseline justify-between gap-2 leading-tight"
                      >
                        <span className="min-w-0 flex-1 truncate text-[clamp(0.7rem,1.35vh,1.05rem)] text-nebbia">
                          {r.players.name}
                        </span>
                        <span className="cifre-fisse shrink-0 text-[clamp(0.7rem,1.35vh,1.05rem)] font-bold text-oro">
                          {r.price}
                        </span>
                      </div>
                    ))}

                    {Array.from({ length: vuoti }, (_, i) => (
                      <div
                        key={`vuoto-${ruolo}-${i}`}
                        aria-hidden
                        className="flex items-center leading-tight"
                      >
                        <span className="w-full border-b border-dashed border-fumo/25 text-[clamp(0.7rem,1.35vh,1.05rem)]">
                          &nbsp;
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </footer>
  )
}
