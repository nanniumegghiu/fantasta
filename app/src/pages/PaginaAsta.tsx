import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { CampoNumero } from '@/components/CampoNumero'
import { Intestazione } from '@/components/Intestazione'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import { useLega } from '@/features/leghe/api'
import { totaleSlot } from '@/features/leghe/tipi'
import { useListaObiettivi } from '@/features/obiettivi/api'
import { SelettoreCalciatore } from '@/features/obiettivi/SelettoreCalciatore'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from '@/features/obiettivi/tipi'
import {
  useApriAsta,
  useAsta,
  useBudgetSquadre,
  useCanaleAsta,
  useChiamaCalciatore,
  useChiudiLottoScaduto,
  useConfiguraAsta,
  useLottoCorrente,
  usePausaAsta,
  useRilancia,
  useRose,
  useScartoOrologio,
  type BudgetSquadra,
  type Lotto,
} from '@/features/asta/api'
import { useTimerAsta } from '@/features/asta/useTimer'
import type { Ruolo } from '@/domain/listone'

export function PaginaAsta() {
  const { id: idLega } = useParams()
  const { utente } = useAccesso()
  const { data: lega } = useLega(idLega)
  const { data: asta } = useAsta(idLega)
  const { data: lotto } = useLottoCorrente(asta?.id)
  const { data: budget } = useBudgetSquadre(idLega)
  const { data: rose } = useRose(idLega)
  const { data: lista } = useListaObiettivi(idLega)
  const { connesso } = useCanaleAsta(idLega)
  const scarto = useScartoOrologio()
  const timer = useTimerAsta(lotto, asta, scarto)
  const chiudi = useChiudiLottoScaduto(idLega)

  const sonoAdmin = lega?.admin_user_id === utente?.id
  const mioBudget = budget?.find((b) => b.user_id === utente?.id)
  const acquistati = new Set((rose ?? []).map((r) => r.player_id))

  // Allo scadere si chiede la chiusura: decide comunque il server.
  const chiusuraChiesta = useRef<string | null>(null)
  useEffect(() => {
    if (timer.fase !== 'scaduto' || !lotto) return
    if (chiusuraChiesta.current === lotto.id) return
    chiusuraChiesta.current = lotto.id
    chiudi.mutate(lotto.id)
  }, [timer.fase, lotto, chiudi])

  return (
    <div className="min-h-dvh pb-6">
      <Intestazione
        titolo="Asta"
        sottotitolo={lega?.name}
        indietroA={`/lega/${idLega}`}
        azione={
          <span
            aria-label={connesso ? 'Collegato' : 'Non collegato'}
            title={connesso ? 'Collegato' : 'Connessione persa'}
            className={`mr-1 size-3 shrink-0 rounded-full ${connesso ? 'bg-verde-acceso' : 'bg-errore'}`}
          />
        }
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-4">
        {!connesso && asta?.status === 'open' && (
          <p className="rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore">
            Connessione persa: quello che vedi potrebbe non essere aggiornato.
          </p>
        )}

        {(!asta || asta.status === 'draft') && (
          <PrimaDellAsta idLega={idLega} sonoAdmin={sonoAdmin} asta={asta} squadre={budget ?? []} />
        )}

        {asta?.status === 'paused' && (
          <p className="rounded-2xl border border-oro/40 bg-oro/10 px-4 py-4 text-center text-lg font-bold text-oro">
            Asta in pausa
          </p>
        )}

        {(asta?.status === 'open' || asta?.status === 'paused') && (
          <>
            {lotto ? (
              <InAstaOra
                lotto={lotto}
                timer={timer}
                squadre={budget ?? []}
                mioBudget={mioBudget}
                idLega={idLega}
                lista={lista}
                offertaMinima={lega?.min_bid ?? 1}
                inPausa={asta.status === 'paused'}
              />
            ) : (
              <TuoTurno
                asta={asta}
                squadre={budget ?? []}
                mioBudget={mioBudget}
                idLega={idLega}
                acquistati={acquistati}
                offertaMinima={lega?.min_bid ?? 1}
              />
            )}

            {mioBudget && lega && <IlMioBudget budget={mioBudget} lega={lega} rose={rose ?? []} />}
            <Avversari squadre={budget ?? []} idMio={mioBudget?.team_id} />
          </>
        )}

        {asta?.status === 'closed' && (
          <div className="rounded-2xl border border-verde-acceso/40 bg-verde-acceso/10 p-5 text-center">
            <p className="text-lg font-bold text-nebbia">Asta conclusa</p>
            <p className="mt-1 text-sm text-fumo">Tutte le rose sono complete.</p>
          </div>
        )}

        <Scorciatoie idLega={idLega} sonoAdmin={sonoAdmin} asta={asta} />
      </main>
    </div>
  )
}

// ─── Prima dell'asta ────────────────────────────────────────────────────────

function PrimaDellAsta({
  idLega,
  sonoAdmin,
  asta,
  squadre,
}: {
  idLega: string | undefined
  sonoAdmin: boolean
  asta: { inactivity_seconds: number; countdown_seconds: number } | null | undefined
  squadre: BudgetSquadra[]
}) {
  const configura = useConfiguraAsta(idLega)
  const apri = useApriAsta(idLega)
  const [inattivita, setInattivita] = useState(asta?.inactivity_seconds ?? 8)
  const [countdown, setCountdown] = useState(asta?.countdown_seconds ?? 5)
  const [sorteggia, setSorteggia] = useState(true)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  if (!sonoAdmin) {
    return (
      <div className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-5 text-center">
        <p className="text-base font-bold text-nebbia">L&apos;asta non è ancora aperta</p>
        <p className="mt-1 text-sm text-fumo">
          La apre l&apos;amministratore. Intanto puoi preparare la tua lista obiettivi.
        </p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <h2 className="text-base font-bold text-nebbia">Impostazioni dell&apos;asta</h2>
      <p className="mt-0.5 mb-4 text-xs text-fumo">
        Si cambiano solo prima di aprire. Dopo l&apos;apertura si congelano: cambiarle a metà
        falserebbe la gara.
      </p>

      <div className="flex flex-col gap-4">
        <CampoNumero
          etichetta="Secondi di attesa dopo l'ultimo rilancio"
          valore={inattivita}
          onChange={setInattivita}
          minimo={3}
          massimo={120}
          aiuto="Passati questi senza offerte, parte il countdown."
        />
        <CampoNumero
          etichetta="Durata del countdown"
          valore={countdown}
          onChange={setCountdown}
          minimo={3}
          massimo={60}
          aiuto="A zero il calciatore va al miglior offerente."
        />

        <div className="rounded-xl border border-verde-acceso/30 bg-verde-notte p-3 text-xs text-fumo">
          Per ora è disponibile la <strong className="text-nebbia">chiamata libera totale</strong>,
          condotta dall&apos;app. Le altre varianti sono progettate ma non ancora costruite, e
          l&apos;app le rifiuta invece di fingere che funzionino.
        </div>

        <label className="flex items-center gap-3 text-sm text-nebbia">
          <input
            type="checkbox"
            checked={sorteggia}
            onChange={(e) => setSorteggia(e.target.checked)}
            className="size-5 accent-[var(--color-verde-acceso)]"
          />
          Sorteggia l&apos;ordine di chiamata
        </label>

        {messaggio && (
          <p className="rounded-xl border border-oro/40 bg-oro/10 px-4 py-3 text-sm text-oro">
            {messaggio}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Bottone
            aspetto="secondario"
            inCorso={configura.isPending}
            onClick={() =>
              configura.mutate(
                { secondiInattivita: inattivita, secondiCountdown: countdown },
                {
                  onSuccess: (e) => setMessaggio(e.messaggio),
                  onError: (e) => setMessaggio(e.message),
                },
              )
            }
          >
            Salva le impostazioni
          </Bottone>

          <Bottone
            misura="grande"
            inCorso={apri.isPending}
            disabilitato={squadre.length < 2}
            onClick={() =>
              apri.mutate(sorteggia, {
                onSuccess: (e) => setMessaggio(e.messaggio),
                onError: (e) => setMessaggio(e.message),
              })
            }
          >
            Apri l&apos;asta
          </Bottone>
        </div>

        {squadre.length < 2 && (
          <p className="text-xs text-oro">Servono almeno due squadre per aprire l&apos;asta.</p>
        )}
      </div>
    </section>
  )
}

// ─── Il calciatore in asta ──────────────────────────────────────────────────

function InAstaOra({
  lotto,
  timer,
  squadre,
  mioBudget,
  idLega,
  lista,
  offertaMinima,
  inPausa,
}: {
  lotto: Lotto
  timer: { fase: string; mancanti: number }
  squadre: BudgetSquadra[]
  mioBudget: BudgetSquadra | undefined
  idLega: string | undefined
  lista: ReturnType<typeof useListaObiettivi>['data']
  offertaMinima: number
  inPausa: boolean
}) {
  const rilancia = useRilancia(idLega)
  const [libero, setLibero] = useState<number>(lotto.current_bid + 1)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => setLibero(lotto.current_bid + 1), [lotto.current_bid])

  const offerente = squadre.find((s) => s.team_id === lotto.current_bidder_team_id)
  const sonoInTesta = mioBudget?.team_id === lotto.current_bidder_team_id
  const massimo = mioBudget?.massimo_offribile ?? 0
  const obiettivo = lista?.targets.find((t) => t.player_id === lotto.player_id)
  const fascia = obiettivo ? lista?.tiers.find((f) => f.id === obiettivo.tier_id) : undefined

  function offri(importo: number) {
    setErrore(null)
    rilancia.mutate(
      { idLotto: lotto.id, importo },
      {
        onSuccess: (e) => {
          if (e.esito !== 'ok') setErrore(e.messaggio)
        },
        onError: (e) => setErrore(e.message),
      },
    )
  }

  const bloccato = inPausa || timer.fase === 'scaduto'

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${CLASSE_RUOLO[lotto.players.role]}`}
        >
          {lotto.players.role}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold text-nebbia">{lotto.players.name}</p>
          <p className="cifre-fisse truncate text-sm text-fumo">
            {lotto.players.serie_a_team} · quotazione {lotto.players.quotation}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`cifre-fisse text-3xl font-extrabold ${timer.fase === 'countdown' ? 'text-errore' : 'text-oro'}`}
          >
            {timer.mancanti}
          </p>
          <p className="text-[11px] uppercase text-fumo">
            {timer.fase === 'countdown' ? 'chiudo' : 'secondi'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 rounded-xl bg-verde-notte px-4 py-3">
        <div>
          <p className="text-xs uppercase text-fumo">Offerta corrente</p>
          <motion.p
            key={lotto.current_bid}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
            className="cifre-fisse text-4xl font-extrabold text-oro"
          >
            {lotto.current_bid}
          </motion.p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-xs uppercase text-fumo">di</p>
          <p className={`truncate text-lg font-bold ${sonoInTesta ? 'text-verde-acceso' : 'text-nebbia'}`}>
            {sonoInTesta ? 'te' : (offerente?.name ?? '—')}
          </p>
        </div>
      </div>

      {/* L'aggancio con la lista obiettivi: quello che avevo scritto su di lui. */}
      {obiettivo && (
        <div className="mt-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 p-3">
          <p className="text-sm font-bold text-verde-acceso">
            È un tuo obiettivo{fascia ? ` · ${fascia.name}` : ''}
          </p>
          {obiettivo.max_price != null && (
            <p className="cifre-fisse mt-1 text-sm text-nebbia">
              Il tetto che ti eri dato: <strong>{obiettivo.max_price}</strong>
              {lotto.current_bid >= obiettivo.max_price && (
                <span className="text-oro"> · sei già arrivato al tuo limite</span>
              )}
            </p>
          )}
          {obiettivo.note && <p className="mt-1 text-sm text-nebbia">{obiettivo.note}</p>}
        </div>
      )}

      {errore && (
        <p role="alert" className="mt-3 rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore">
          {errore}
        </p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[1, 5, 10].map((passo) => {
          const importo = lotto.current_bid + passo
          return (
            <Bottone
              key={passo}
              misura="grande"
              disabilitato={bloccato || importo > massimo}
              inCorso={rilancia.isPending}
              onClick={() => offri(importo)}
            >
              +{passo}
            </Bottone>
          )
        })}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <CampoNumero
            etichetta="Rilancio libero"
            valore={libero}
            onChange={setLibero}
            minimo={lotto.current_bid + 1}
            massimo={Math.max(lotto.current_bid + 1, massimo)}
          />
        </div>
        <Bottone
          misura="grande"
          aspetto="oro"
          disabilitato={bloccato || libero > massimo || libero <= lotto.current_bid}
          inCorso={rilancia.isPending}
          onClick={() => offri(libero)}
        >
          Offri
        </Bottone>
      </div>

      <p className="cifre-fisse mt-2 text-xs text-fumo">
        Puoi arrivare al massimo a {massimo}. L&apos;offerta minima è {offertaMinima}.
      </p>
    </section>
  )
}

// ─── Il turno di chiamata ───────────────────────────────────────────────────

function TuoTurno({
  asta,
  squadre,
  mioBudget,
  idLega,
  acquistati,
  offertaMinima,
}: {
  asta: { nomination_order: string[]; current_turn_index: number; status: string }
  squadre: BudgetSquadra[]
  mioBudget: BudgetSquadra | undefined
  idLega: string | undefined
  acquistati: Set<number>
  offertaMinima: number
}) {
  const chiama = useChiamaCalciatore(idLega)
  const [selettore, setSelettore] = useState(false)
  const [scelto, setScelto] = useState<number | null>(null)
  const [importo, setImporto] = useState(offertaMinima)
  const [errore, setErrore] = useState<string | null>(null)

  const squadraDiTurno = asta.nomination_order[asta.current_turn_index]
  const tocca = mioBudget?.team_id === squadraDiTurno
  const chiChiama = squadre.find((s) => s.team_id === squadraDiTurno)

  if (!tocca) {
    return (
      <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-5 text-center">
        <p className="text-sm text-fumo">Tocca a</p>
        <p className="mt-1 text-2xl font-extrabold text-arancio">{chiChiama?.name ?? '—'}</p>
        <p className="mt-1 text-xs text-fumo">Aspetta la sua chiamata.</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-arancio/50 bg-arancio/10 p-4">
      <p className="text-center text-lg font-extrabold text-arancio">Tocca a te chiamare</p>

      {scelto == null ? (
        <div className="mt-3">
          <Bottone misura="grande" larghezzaPiena onClick={() => setSelettore(true)}>
            Scegli il calciatore
          </Bottone>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <CampoNumero
            etichetta="Offerta di apertura"
            valore={importo}
            onChange={setImporto}
            minimo={offertaMinima}
            massimo={mioBudget?.massimo_offribile ?? offertaMinima}
          />
          {errore && (
            <p role="alert" className="rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore">
              {errore}
            </p>
          )}
          <div className="flex gap-2">
            <Bottone
              misura="grande"
              inCorso={chiama.isPending}
              onClick={() => {
                setErrore(null)
                chiama.mutate(
                  { idCalciatore: scelto, importo },
                  {
                    onSuccess: (e) => {
                      if (e.esito !== 'ok') setErrore(e.messaggio)
                      else setScelto(null)
                    },
                    onError: (e) => setErrore(e.message),
                  },
                )
              }}
            >
              Chiama
            </Bottone>
            <Bottone aspetto="fantasma" onClick={() => setScelto(null)}>
              Cambia
            </Bottone>
          </div>
        </div>
      )}

      {selettore && (
        <SelettoreCalciatore
          titolo="Chi metti all'asta"
          giaPresenti={acquistati}
          onChiudi={() => setSelettore(false)}
          onConferma={(ids) => {
            setScelto(ids[0] ?? null)
            setImporto(offertaMinima)
            setSelettore(false)
          }}
        />
      )}
    </section>
  )
}

// ─── Il mio budget ──────────────────────────────────────────────────────────

function IlMioBudget({
  budget,
  lega,
  rose,
}: {
  budget: BudgetSquadra
  lega: { slots_p: number; slots_d: number; slots_c: number; slots_a: number }
  rose: Array<{ team_id: string; price: number }>
}) {
  const previsti: Record<Ruolo, number> = {
    P: lega.slots_p,
    D: lega.slots_d,
    C: lega.slots_c,
    A: lega.slots_a,
  }
  const presi: Record<Ruolo, number> = {
    P: budget.presi_p,
    D: budget.presi_d,
    C: budget.presi_c,
    A: budget.presi_a,
  }
  const spesi = rose.filter((r) => r.team_id === budget.team_id).reduce((s, r) => s + r.price, 0)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-bold text-nebbia">{budget.name}</h2>
        <p className="cifre-fisse shrink-0 text-2xl font-extrabold text-oro">
          {budget.credits_remaining}
        </p>
      </div>
      <p className="cifre-fisse text-xs text-fumo">
        massimo offribile {budget.massimo_offribile} · spesi {spesi} · restano{' '}
        {budget.slot_rimanenti} slot su {totaleSlot(lega)}
      </p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {ORDINE_RUOLI.map((r) => (
          <div key={r} className="rounded-xl bg-verde-notte px-2 py-2 text-center">
            <span
              className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${CLASSE_RUOLO[r]}`}
              title={NOME_RUOLO[r]}
            >
              {r}
            </span>
            <p className="cifre-fisse text-base font-bold text-nebbia">
              {presi[r]}
              <span className="text-xs text-fumo">/{previsti[r]}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Gli avversari ──────────────────────────────────────────────────────────

function Avversari({ squadre, idMio }: { squadre: BudgetSquadra[]; idMio: string | undefined }) {
  const altri = squadre.filter((s) => s.team_id !== idMio)
  if (altri.length === 0) return null

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <h2 className="mb-2 text-base font-bold text-nebbia">Gli avversari</h2>
      <ul className="flex flex-col divide-y divide-verde-campo">
        {altri.map((s) => (
          <li key={s.team_id} className="flex items-baseline gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-nebbia">{s.name}</span>
            <span className="cifre-fisse shrink-0 text-xs text-fumo">
              max {s.massimo_offribile} · {s.slot_rimanenti} slot
            </span>
            <span className="cifre-fisse shrink-0 text-base font-bold text-oro">
              {s.credits_remaining}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Scorciatoie ────────────────────────────────────────────────────────────

function Scorciatoie({
  idLega,
  sonoAdmin,
  asta,
}: {
  idLega: string | undefined
  sonoAdmin: boolean
  asta: { status: string } | null | undefined
}) {
  const pausa = usePausaAsta(idLega)
  const inPausa = asta?.status === 'paused'

  return (
    <section className="flex flex-wrap gap-2">
      <Link to={`/lega/${idLega}/obiettivi`}>
        <Bottone aspetto="secondario">I miei obiettivi</Bottone>
      </Link>
      <Link to="/listone">
        <Bottone aspetto="secondario">Listone</Bottone>
      </Link>
      {sonoAdmin && (
        <>
          <Link to={`/lega/${idLega}/asta/schermo`} target="_blank">
            <Bottone aspetto="secondario">Apri lo schermo condiviso</Bottone>
          </Link>
          {(asta?.status === 'open' || inPausa) && (
            <Bottone
              aspetto="fantasma"
              inCorso={pausa.isPending}
              onClick={() => pausa.mutate(!inPausa)}
            >
              {inPausa ? 'Riprendi' : 'Metti in pausa'}
            </Bottone>
          )}
        </>
      )}
    </section>
  )
}
