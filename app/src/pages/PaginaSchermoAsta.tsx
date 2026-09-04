import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MarchioFantasta } from '@/components/MarchioFantasta'
import { Coriandoli } from '@/components/Coriandoli'
import { useMovimentoRidotto } from '@/lib/movimento'
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
  type Asta,
  type BudgetSquadra,
  type Lotto,
} from '@/features/asta/api'
import { useTimerAsta } from '@/features/asta/useTimer'
import { useChiusuraInsistente } from '@/features/asta/useChiusura'
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
import { Stemma } from '@/components/Stemma'
import { Volto } from '@/components/Volto'
import { useLoghi } from '@/features/listone/loghi'
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
/**
 * Lo schermo, separato da dove arrivano i dati.
 *
 * Esistono due modi di riempirlo: la sessione di un partecipante, che ascolta
 * il canale in tempo reale, e il **codice della TV**, che interroga a
 * intervalli senza nessun accesso. Il disegno però è lo stesso, e deve
 * restare uno: due copie della stessa schermata divergono al primo ritocco, e
 * si scopre la sera dell'asta guardando due televisori diversi.
 */
export function SchermoAsta({
  lega,
  asta,
  lotto,
  budget,
  rose,
  connesso,
  scarto,
  onChiudiScaduto,
}: {
  lega:
    | {
        name?: string
        slots_p: number
        slots_d: number
        slots_c: number
        slots_a: number
        /** Serve al suono del rilancio: piu' l'offerta si avvicina al budget, piu' sale. */
        credits_initial?: number
      }
    | null
    | undefined
  asta: Asta | null | undefined
  lotto: Lotto | null | undefined
  budget: BudgetSquadra[] | undefined
  rose: AcquistoInRosa[] | undefined
  connesso: boolean
  scarto: number
  /**
   * Chi guarda da una sessione vera chiede al server di chiudere il lotto
   * scaduto: è la prima gamba del meccanismo di ADR-0005. Dalla TV no — quel
   * visitatore non ha il permesso e non deve averlo — e il compito pianificato
   * chiude comunque entro dieci secondi.
   */
  onChiudiScaduto?: (idLotto: string) => void
}) {
  const timer = useTimerAsta(lotto, asta, scarto)

  const [audioPronto, setAudioPronto] = useState(false)
  const [suoni, setSuoni] = useState(true)

  // ─── Suoni, guardando cosa è cambiato ─────────────────────────────────────
  const lottoPrecedente = useRef<string | null>(null)
  const offertaPrecedente = useRef<number>(0)
  const fasePrecedente = useRef<string>('nessuno')
  const secondoPrecedente = useRef<number>(-1)
  const acquistiPrecedenti = useRef<number>(-1)
  const [festa, setFesta] = useState<Festeggiato | null>(null)

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

  // Allo scadere si chiede al server di chiudere, e si insiste finché non è
  // chiuso davvero. Decide lui: se non è scaduto rifiuta, e non succede niente.
  // Il perché delle precauzioni sta scritto dentro il gancio.
  useChiusuraInsistente(timer.fase, lotto?.id, onChiudiScaduto)

  // ─── L'aggiudicazione, che è il momento della serata ──────────────────────
  //
  // Aveva il suono e non aveva l'immagine: la scheda del calciatore venduto
  // spariva e ne compariva un'altra, come una diapositiva. Otto persone
  // guardano il televisore nel momento che aspettavano, e lo schermo non se ne
  // accorgeva.
  //
  // COME SI CAPISCE CHI HA VINTO
  // Non dal lotto: quando si chiude, sparisce. Si guarda invece quale
  // calciatore è **comparso** nelle rose rispetto al giro prima. È l'unico
  // segnale che arriva sempre, anche al televisore che interroga ogni secondo
  // e mezzo senza canale in tempo reale.
  const idsInRosa = useRef<Set<number> | null>(null)
  useEffect(() => {
    if (!rose) return
    const adesso = new Set(rose.map((r) => r.player_id))
    const prima = idsInRosa.current
    idsInRosa.current = adesso
    if (!prima) return
    const nuovo = rose.find((r) => !prima.has(r.player_id))
    if (!nuovo) return
    setFesta({
      nome: nuovo.players.name,
      ruolo: nuovo.players.role,
      foto: nuovo.players.photo_path,
      squadra: (budget ?? []).find((b) => b.team_id === nuovo.team_id)?.name ?? '',
      idSquadra: nuovo.team_id,
      prezzo: nuovo.price,
    })
  }, [rose, budget])

  useEffect(() => {
    if (!festa) return
    const finisce = setTimeout(() => setFesta(null), 1600)
    return () => clearTimeout(finisce)
  }, [festa])

  if (!audioPronto) {
    return <SchermataAttivazione lega={lega?.name} onAttiva={() => setAudioPronto(true)} />
  }

  const squadre = [...(budget ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'it'))
  const rosaCompleta = lega ? totaleSlot(lega) : 0
  const presiTotali = rose?.length ?? 0
  const totaliDaAssegnare = rosaCompleta * squadre.length
  const spesiTotali = (rose ?? []).reduce((s, r) => s + r.price, 0)

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-verde-notte">
      <AnimatePresence>
        {festa && (
          <Festa
            key={`${festa.idSquadra}-${festa.nome}`}
            chi={festa}
            quante={squadre.length}
            indice={Math.max(0, squadre.findIndex((s) => s.team_id === festa.idSquadra))}
          />
        )}
      </AnimatePresence>

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

      {/* AnimatePresence: senza, niente esce mai di scena e ogni cambiamento e'
          uno scatto. Era la ragione tecnica per cui l'app sembrava spenta. */}
      <div className="min-h-0 shrink-0 basis-[44%] px-6 py-3">
        <AnimatePresence mode="wait">
        {lotto ? (
          <InAsta key={lotto.id} lotto={lotto} timer={timer} squadre={squadre} />
        ) : (
          <NessunaChiamata
            key="nessuno"
            asta={asta}
            squadre={squadre}
            chiusa={asta?.status === 'closed'}
            slotVuoti={squadre.reduce((n, s) => n + s.slot_rimanenti, 0)}
            iniziata={presiTotali > 0}
          />
        )}
        </AnimatePresence>
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

/**
 * Lo schermo condiviso aperto da chi ha una sessione: ascolta il canale in
 * tempo reale, e segnala al server i lotti scaduti.
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
  const chiudi = useChiudiLottoScaduto(idLega)

  const chiudiScaduto = useCallback((id: string) => chiudi.mutate(id), [chiudi])

  return (
    <SchermoAsta
      lega={lega}
      asta={asta}
      lotto={lotto}
      budget={budget}
      rose={rose}
      connesso={connesso}
      scarto={scarto}
      onChiudiScaduto={chiudiScaduto}
    />
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

type Festeggiato = {
  nome: string
  ruolo: Ruolo
  foto: string | null
  squadra: string
  idSquadra: string
  prezzo: number
}

/**
 * La festa dell'aggiudicazione.
 *
 * Novecento millisecondi in cui lo schermo dice una cosa sola: **chi ha preso
 * chi, e a quanto**. Il nome della squadra entra grande, il prezzo con lui, e
 * i coriandoli cadono nei colori del logo.
 *
 * PERCHE' LA SCHEDA SI SPOSTA VERSO LA SUA COLONNA
 * Perché il racconto non è «è stato venduto», è «è finito **lì**». Le colonne
 * delle rose sono larghe uguali, quindi la colonna giusta si sa senza misurare
 * niente: è la sua posizione nell'elenco. Chi guarda segue il movimento e sa
 * dove cercare la riga nuova, che è esattamente quello che nessuno faceva
 * quando la riga compariva di nascosto.
 */
function Festa({
  chi,
  quante,
  indice,
}: {
  chi: Festeggiato
  quante: number
  indice: number
}) {
  const ridotto = useMovimentoRidotto()
  // Il centro della sua colonna, in frazione di schermo: -0.5 è tutto a
  // sinistra, +0.5 tutto a destra.
  const versoDove = quante > 0 ? (indice + 0.5) / quante - 0.5 : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-verde-notte/85"
    >
      <Coriandoli />
      <motion.div
        initial={ridotto ? { opacity: 0 } : { scale: 0.7, opacity: 0, y: 0, x: 0 }}
        animate={
          ridotto
            ? { opacity: 1 }
            : { scale: [0.7, 1.08, 1, 0.55], opacity: [0, 1, 1, 0], y: [0, 0, 0, 220], x: [0, 0, 0, versoDove * 900] }
        }
        transition={{ duration: ridotto ? 0.2 : 1.5, times: [0, 0.18, 0.6, 1] }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <Volto
          nome={chi.nome}
          indirizzo={null}
          classeRuolo={CLASSE_RUOLO[chi.ruolo]}
          misura={128}
        />
        <p className="text-5xl font-extrabold text-nebbia">{chi.nome}</p>
        <p className="text-7xl font-extrabold text-oro">{chi.squadra}</p>
        <p className="cifre-fisse text-6xl font-extrabold text-nebbia">{chi.prezzo}</p>
      </motion.div>
    </motion.div>
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
  const stemma = useLoghi()
  const offerente = squadre.find((s) => s.team_id === lotto.current_bidder_team_id)
  const stat = lotto.players.player_stats
  const inCountdown = timer.fase === 'countdown' || timer.fase === 'scaduto'
  // La pulsazione infinita e' la piu' fastidiosa di tutte per chi soffre di
  // emicrania vestibolare, e la regola CSS non la fermava: e' pilotata da
  // JavaScript. Qui il numero resta fermo e il colore dice lo stesso tutto.
  const ridotto = useMovimentoRidotto()

  return (
    <motion.div
      exit={{ opacity: 0, y: -26, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="grid h-full grid-cols-[1.2fr_auto_1fr] items-center gap-6"
    >
      {/* Sinistra: chi è in asta, a quanto, e chi ha offerto */}
      <motion.div
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
              <Stemma
                squadra={lotto.players.serie_a_team}
                indirizzo={stemma(lotto.players.serie_a_team)}
                misura={40}
              />
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
            animate={ridotto ? { scale: 1 } : { scale: [1, 1.06, 1] }}
            transition={ridotto ? { duration: 0 } : { duration: 1, repeat: Infinity }}
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
    </motion.div>
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
 *
 * PERCHE' L'ALTEZZA DELLE RIGHE SI MISURA INVECE DI SCEGLIERLA
 *
 * Prima le righe erano dimensionate in `vh`, cioè in frazioni dell'**altezza
 * della finestra**. Ma le rose non hanno tutta la finestra: hanno quello che
 * resta sotto la barra e sotto il calciatore in asta. Su un televisore
 * larghissimo tornava, su uno schermo di portatile no, e le ultime righe
 * finivano fuori: **gli attaccanti sparivano**, che è esattamente il reparto
 * che a fine serata si guarda di più.
 *
 * Un `clamp` più stretto avrebbe spostato il problema su un altro schermo. Il
 * numero di righe però si sa con certezza — lo dice il regolamento della lega,
 * 3+8+8+6 più quattro intestazioni — quindi si misura lo spazio che c'è e lo si
 * divide per le righe che devono starci. Nessuno schermo può tagliare qualcosa
 * che è stato calcolato per entrarci.
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

  // Le righe che devono starci: i posti del regolamento più un'intestazione
  // per reparto.
  const righeTotali = 4 + previsti.P + previsti.D + previsti.C + previsti.A
  const primaColonna = useRef<HTMLDivElement>(null)
  const [altezzaRiga, setAltezzaRiga] = useState(0)

  useEffect(() => {
    const el = primaColonna.current
    if (!el) return
    // Arrotondata al mezzo pixel e scritta solo se cambia: un osservatore
    // che si risveglia da solo e' il modo piu' silenzioso di inchiodare una
    // pagina, e qui sotto ci sono centocinquanta righe da ridisegnare.
    const misura = () => {
      const nuova = Math.round((el.clientHeight / righeTotali) * 2) / 2
      setAltezzaRiga((vecchia) => (Math.abs(vecchia - nuova) < 0.5 ? vecchia : nuova))
    }
    misura()
    const osserva = new ResizeObserver(misura)
    osserva.observe(el)
    return () => osserva.disconnect()
  }, [righeTotali])

  // Finché non si è misurato si usa una taglia di ripiego: un fotogramma con
  // le righe un po' storte è meglio di un fotogramma vuoto.
  const riga = altezzaRiga > 0 ? altezzaRiga : 18
  const corpo = { height: riga, fontSize: Math.max(9, riga * 0.74), lineHeight: `${riga}px` }
  const titolo = { height: riga, fontSize: Math.max(8, riga * 0.62), lineHeight: `${riga}px` }

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
      {squadre.map((s, colonna) => {
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
            <div
              ref={colonna === 0 ? primaColonna : undefined}
              className="min-h-0 flex-1 overflow-hidden px-2"
            >
              {ORDINE_RUOLI.map((ruolo) => {
                const presi = gruppi[ruolo]
                const vuoti = Math.max(0, previsti[ruolo] - presi.length)
                return (
                  <div key={ruolo}>
                    <div className="flex items-center gap-1.5" style={titolo}>
                      <span
                        className={`flex items-center justify-center rounded px-1 font-bold ${CLASSE_RUOLO[ruolo]}`}
                        style={{ height: riga * 0.8, lineHeight: `${riga * 0.8}px` }}
                      >
                        {ruolo}
                      </span>
                      <span className="cifre-fisse text-fumo">
                        {presi.length}/{previsti[ruolo]}
                      </span>
                      <span className="h-px flex-1 bg-verde-campo/60" />
                    </div>

                    <AnimatePresence initial={false}>
                      {presi.map((r) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, x: -12, backgroundColor: 'rgba(247,196,67,0.35)' }}
                          animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(247,196,67,0)' }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.5 }}
                          className="flex items-center justify-between gap-2 rounded"
                          style={corpo}
                        >
                          <span className="min-w-0 flex-1 truncate text-nebbia">
                            {r.players.name}
                          </span>
                          <span className="cifre-fisse shrink-0 font-bold text-oro">{r.price}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {Array.from({ length: vuoti }, (_, i) => (
                      <div
                        key={`vuoto-${ruolo}-${i}`}
                        aria-hidden
                        className="flex items-center"
                        style={corpo}
                      >
                        <span className="w-full border-b border-dashed border-fumo/25">&nbsp;</span>
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
