import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRegistroAsta, type VoceRegistro } from './api'

/**
 * Il registro dell'asta, **visibile a chiunque partecipi**.
 *
 * PERCHE' NON E' UNA SCHERMATA DA AMMINISTRATORE
 *
 * L'amministratore può togliere un calciatore dalla rosa di chiunque e
 * cambiare il prezzo di un acquisto già fatto. Sono poteri necessari — in tre
 * ore d'asta qualcosa va storto per forza — e sono anche poteri che, in mano a
 * uno che gioca, potrebbero decidere la serata.
 *
 * La risposta non è togliergli il potere, è renderlo visibile. Quindi questo
 * elenco lo leggono tutti, e le correzioni ci arrivano dentro con il **motivo**
 * che chi le ha fatte ha dovuto scrivere. Un controllo che vede solo il
 * controllato non è un controllo.
 *
 * PERCHE' GLI INTERVENTI SONO IN EVIDENZA
 * Il registro contiene anche il gioco normale: chiamate, rilanci,
 * aggiudicazioni. Sono la maggioranza, e annegherebbero le poche righe che
 * contano. Si apre sui soli interventi manuali, e tutto il resto è a un tocco.
 *
 * PERCHE' STA IN UN ANGOLO
 *
 * Perché è un estintore. Serve nei casi di emergenza — «quel prezzo è
 * sbagliato», «chi ha tolto quel calciatore?» — e nelle altre due ore e
 * cinquantacinque minuti non serve a niente. Era una scheda a tutta larghezza
 * con titolo, sottotitolo e icona: ottanta pixel di altezza, presi allo
 * spazio dell'asta, per una cosa che quasi nessuno aprirà mai.
 *
 * Adesso è una riga sola, discreta, in fondo. Quando ci sono interventi da
 * leggere si accende d'oro: **un estintore si nota quando serve**, non prima.
 */
export function RegistroAsta({ idLega }: { idLega: string | undefined }) {
  const [aperto, setAperto] = useState(false)
  const [tutto, setTutto] = useState(false)
  const { data: voci, isPending } = useRegistroAsta(idLega, !tutto)

  // Quanti interventi ci sono in tutto: si vuole saperlo senza aprire, perché
  // «zero correzioni» è già di per sé un'informazione.
  const { data: manuali } = useRegistroAsta(idLega, true)
  const quantiManuali = manuali?.length ?? 0

  return (
    <section className="rounded-xl">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        aria-expanded={aperto}
        className={[
          'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors',
          quantiManuali > 0
            ? 'text-oro hover:bg-oro/10'
            : 'text-fumo hover:bg-verde-campo/40 hover:text-nebbia',
        ].join(' ')}
      >
        <span aria-hidden>📓</span>
        <span className="min-w-0 flex-1 truncate">
          Registro dell&apos;asta
          {quantiManuali > 0 &&
            ` · ${quantiManuali} ${quantiManuali === 1 ? 'intervento' : 'interventi'}`}
        </span>
        <span aria-hidden className={`transition-transform ${aperto ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      <AnimatePresence initial={false}>
        {aperto && (
          <motion.div
            key="registro"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-xl border border-verde-campo bg-verde-campo/30 p-4">
            <div className="mb-3 flex gap-2">
              <Pillola attiva={!tutto} onClick={() => setTutto(false)}>
                Solo gli interventi
              </Pillola>
              <Pillola attiva={tutto} onClick={() => setTutto(true)}>
                Tutta la serata
              </Pillola>
            </div>

            {isPending ? (
              <div className="h-24 animate-pulse rounded-xl bg-verde-notte" />
            ) : (voci ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-verde-campo px-4 py-3 text-sm text-fumo">
                {tutto
                  ? "Non è ancora successo niente."
                  : "Nessuna correzione: l'asta è andata come è andata."}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {(voci ?? []).map((v) => (
                  <Voce key={v.seq} voce={v} />
                ))}
              </ol>
            )}

              <p className="mt-3 text-xs text-fumo">
                Il registro è a sola aggiunta: nessuno può cambiarlo o cancellarlo, nemmeno chi
                amministra la lega.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function Pillola({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-9 rounded-full px-3 text-xs font-semibold transition-colors',
        attiva ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Il reparto scritto per esteso: nel registro «P» non dice niente a nessuno. */
const NOME_REPARTO: Record<string, string> = {
  P: 'portieri',
  D: 'difensori',
  C: 'centrocampisti',
  A: 'attaccanti',
  'tutti i reparti': 'reparti',
}

/** Le parole con cui si racconta ogni tipo di evento. */
const RACCONTO: Record<string, (v: VoceRegistro) => string> = {
  apertura: () => "L'asta è stata aperta",
  chiusura: () => "L'asta è stata chiusa",
  pausa: () => 'Asta messa in pausa',
  ripresa: () => 'Asta ripresa',
  chiamata: (v) => `${v.squadra ?? 'Qualcuno'} ha chiamato ${v.calciatore ?? '—'}`,
  estrazione: (v) =>
    v.payload?.metodo === 'riempimento'
      ? `${v.calciatore ?? '—'} rimesso all'asta`
      : `${v.calciatore ?? '—'} estratto`,
  rilancio: (v) => `${v.squadra ?? 'Qualcuno'} ha offerto ${v.payload?.importo ?? '—'}`,
  aggiudicazione: (v) =>
    `${v.calciatore ?? '—'} a ${v.squadra ?? '—'} per ${v.payload?.prezzo ?? '—'}`,
  passaggio: (v) => `${v.calciatore ?? '—'} passato: non lo voleva nessuno`,
  nuovo_giro: (v) =>
    `Nuovo giro sui ${NOME_REPARTO[String(v.payload?.reparto ?? '')] ?? 'reparti'}: ` +
    `${v.payload?.rimessi ?? '—'} calciatori rimessi nel mazzo`,
  annullamento: (v) => `Annullata l'aggiudicazione di ${v.calciatore ?? '—'}`,
  rimozione: (v) => `${v.calciatore ?? '—'} tolto dalla rosa di ${v.squadra ?? '—'}`,
  correzione_prezzo: (v) =>
    `${v.calciatore ?? '—'}: prezzo da ${v.payload?.prezzo_prima ?? '—'} a ${v.payload?.prezzo ?? '—'}`,
}

function Voce({ voce }: { voce: VoceRegistro }) {
  const racconta = RACCONTO[voce.type]
  const testo = racconta ? racconta(voce) : voce.type
  const quando = new Date(voce.created_at).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li
      className={[
        'rounded-xl border px-3 py-2',
        voce.manuale ? 'border-oro/40 bg-oro/10' : 'border-verde-campo bg-verde-notte',
      ].join(' ')}
    >
      <div className="flex items-baseline gap-2">
        <span className="cifre-fisse shrink-0 text-xs text-fumo">{quando}</span>
        <span className="min-w-0 flex-1 text-sm text-nebbia">{testo}</span>
        {voce.manuale && (
          <span className="shrink-0 rounded-full bg-oro/20 px-2 py-0.5 text-[10px] font-bold uppercase text-oro">
            intervento
          </span>
        )}
      </div>

      {/* Il motivo è la parte che rende utile il registro: si legge per intero. */}
      {voce.motivo && (
        <p className="mt-1 text-sm text-nebbia">
          <span className="text-fumo">Motivo: </span>
          {voce.motivo}
        </p>
      )}

      {voce.manuale && voce.attore && (
        <p className="mt-0.5 text-xs text-fumo">fatto da {voce.attore}</p>
      )}
    </li>
  )
}
