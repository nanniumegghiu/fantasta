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
  useAsta,
  useBudgetSquadre,
  useCanaleAsta,
  useChiamaCalciatore,
  useChiudiLottoScaduto,
  useLottoCorrente,
  usePassa,
  usePassiDelLotto,
  usePausaAsta,
  useRilancia,
  useRose,
  useScartoOrologio,
  type AcquistoInRosa,
  type BudgetSquadra,
  type Lotto,
} from '@/features/asta/api'
import { useTimerAsta } from '@/features/asta/useTimer'
import { ImpostazioniPreAsta } from '@/features/asta/ImpostazioniPreAsta'
import { PannelloAmministratore } from '@/features/asta/PannelloAmministratore'
import { RegistroAsta } from '@/features/asta/RegistroAsta'
import { Volto } from '@/components/Volto'
import { useVolti } from '@/features/listone/volti'
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

        {(!asta || asta.status === 'draft') &&
          (sonoAdmin ? (
            <ImpostazioniPreAsta idLega={idLega} asta={asta} squadre={budget ?? []} />
          ) : (
            <div className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-5 text-center">
              <p className="text-base font-bold text-nebbia">L&apos;asta non è ancora aperta</p>
              <p className="mt-1 text-sm text-fumo">
                La apre l&apos;amministratore. Intanto puoi preparare la tua lista obiettivi.
              </p>
            </div>
          ))}

        {asta?.status === 'paused' && (
          <p className="rounded-2xl border border-oro/40 bg-oro/10 px-4 py-4 text-center text-lg font-bold text-oro">
            Asta in pausa
          </p>
        )}

        {asta?.current_role_phase && (
          <p className="rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-2 text-center text-sm font-semibold text-verde-acceso">
            Adesso si gioca il reparto: {NOME_RUOLO[asta.current_role_phase]}
          </p>
        )}

        {(asta?.status === 'open' || asta?.status === 'paused') && (
          <>
            {sonoAdmin && (
              <PannelloAmministratore
                idLega={idLega}
                asta={asta}
                lotto={lotto}
                squadre={budget ?? []}
                acquistati={acquistati}
                rose={rose ?? []}
              />
            )}
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
                conPasso={asta.bid_type === 'con_passo'}
              />
            ) : asta.method === 'chiamata' ? (
              <TuoTurno
                asta={asta}
                squadre={budget ?? []}
                mioBudget={mioBudget}
                idLega={idLega}
                acquistati={acquistati}
                offertaMinima={lega?.min_bid ?? 1}
              />
            ) : (
              <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-5 text-center">
                <p className="text-sm text-fumo">
                  {asta.method === 'random'
                    ? "In questa asta i calciatori li estrae il server."
                    : "In questa asta i calciatori escono in ordine alfabetico."}
                </p>
                <p className="mt-1 text-xs text-fumo">
                  Aspetta che l&apos;amministratore apra il prossimo.
                </p>
              </section>
            )}

            {mioBudget && lega && (
              <LaMiaRosa
                budget={mioBudget}
                lega={lega}
                acquisti={(rose ?? []).filter((r) => r.team_id === mioBudget.team_id)}
              />
            )}
            <Avversari
              squadre={budget ?? []}
              idMio={mioBudget?.team_id}
              rose={rose ?? []}
              lega={lega}
            />
          </>
        )}

        {asta?.status === 'closed' && (
          <div className="rounded-2xl border border-verde-acceso/40 bg-verde-acceso/10 p-5 text-center">
            <p className="text-lg font-bold text-nebbia">Asta conclusa</p>
            <p className="mt-1 text-sm text-fumo">Tutte le rose sono complete.</p>
          </div>
        )}

        {/* Il registro lo vedono tutti, non solo chi conduce: è la ragione
            per cui chi conduce può correggere senza doversi far credere. */}
        {asta && <RegistroAsta idLega={idLega} />}

        <Scorciatoie
          idLega={idLega}
          sonoAdmin={sonoAdmin}
          asta={asta}
          // Il reparto in corso: la lista obiettivi si apre gia' filtrata su
          // quello, senza gli altri tre a fare rumore.
          ruolo={lotto?.players.role ?? asta?.current_role_phase ?? null}
        />
      </main>
    </div>
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
  conPasso,
}: {
  lotto: Lotto
  timer: { fase: string; mancanti: number }
  squadre: BudgetSquadra[]
  mioBudget: BudgetSquadra | undefined
  idLega: string | undefined
  lista: ReturnType<typeof useListaObiettivi>['data']
  offertaMinima: number
  inPausa: boolean
  conPasso: boolean
}) {
  const rilancia = useRilancia(idLega)
  const passa = usePassa(idLega)
  const { data: chiHaPassato } = usePassiDelLotto(conPasso ? lotto.id : undefined)
  const [confermaPasso, setConfermaPasso] = useState(false)
  const [libero, setLibero] = useState<number>(lotto.current_bid + 1)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    setLibero(lotto.current_bidder_team_id ? lotto.current_bid + 1 : offertaMinima)
  }, [lotto.current_bid, lotto.current_bidder_team_id, offertaMinima])

  const volto = useVolti()
  const offerente = squadre.find((s) => s.team_id === lotto.current_bidder_team_id)
  const sonoInTesta = mioBudget?.team_id === lotto.current_bidder_team_id
  const massimo = mioBudget?.massimo_offribile ?? 0
  const obiettivo = lista?.targets.find((t) => t.player_id === lotto.player_id)
  const fascia = obiettivo ? lista?.tiers.find((f) => f.id === obiettivo.tier_id) : undefined

  // I posti della rosa per cui questo nome è candidato. Con il metodo degli
  // slot il tetto non sta sul calciatore: sta sul posto, e uno stesso nome può
  // essere candidato a più posti con massimali diversi.
  const postiSuoi =
    obiettivo && lista?.metodo === 'slot'
      ? lista.roster_slots
          .filter((s) => s.slot_candidates.some((c) => c.target_id === obiettivo.id))
          .sort((a, b) => a.position - b.position)
      : []

  // Quando i posti sono più d'uno vale il più generoso: è la cifra oltre la
  // quale questo nome non ti serve più in nessun caso.
  const tetto =
    lista?.metodo === 'slot'
      ? postiSuoi.reduce<number | null>(
          (m, s) => (s.max_price == null ? m : Math.max(m ?? 0, s.max_price)),
          null,
        )
      : (obiettivo?.max_price ?? null)

  const postoDelTetto = postiSuoi.find((s) => s.max_price === tetto)

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

  const hoPassato = Boolean(mioBudget && chiHaPassato?.includes(mioBudget.team_id))
  const bloccato = inPausa || timer.fase === 'scaduto' || hoPassato
  // Su un lotto aperto dal server non c'è ancora un'offerta: il primo scatto
  // deve valere l'offerta minima, non uno.
  const base = lotto.current_bidder_team_id ? lotto.current_bid : Math.max(offertaMinima - 1, 0)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex items-start gap-3">
        {/* La faccia, quando c'è: si riconosce prima di leggere il nome. */}
        <Volto
          nome={lotto.players.name}
          indirizzo={volto(lotto.players.photo_path)}
          classeRuolo={CLASSE_RUOLO[lotto.players.role]}
          misura={56}
        />
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
            È un tuo obiettivo
            {fascia ? ` · ${fascia.name}` : ''}
            {postiSuoi.length > 0 && ` · ${postiSuoi.map((s) => s.label).join(', ')}`}
          </p>
          {tetto != null && (
            <p className="cifre-fisse mt-1 text-sm text-nebbia">
              {postoDelTetto ? `Il massimale di «${postoDelTetto.label}»` : 'Il tetto che ti eri dato'}
              : <strong>{tetto}</strong>
              {lotto.current_bid >= tetto && (
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
          const importo = base + passo
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
            minimo={base + 1}
            massimo={Math.max(base + 1, massimo)}
          />
        </div>
        <Bottone
          misura="grande"
          aspetto="oro"
          disabilitato={bloccato || libero > massimo || libero <= base}
          inCorso={rilancia.isPending}
          onClick={() => offri(libero)}
        >
          Offri
        </Bottone>
      </div>

      <p className="cifre-fisse mt-2 text-xs text-fumo">
        Puoi arrivare al massimo a {massimo}. L&apos;offerta minima è {offertaMinima}.
      </p>

      {conPasso && (
        <div className="mt-3 border-t border-verde-campo pt-3">
          {hoPassato ? (
            <p className="text-sm font-semibold text-fumo">
              Hai passato su di lui: non puoi più rilanciare.
            </p>
          ) : confermaPasso ? (
            <div className="rounded-xl border border-errore/40 bg-errore/10 p-3">
              <p className="text-sm text-nebbia">
                Se passi sei fuori da questo calciatore <strong>per sempre</strong>: non potrai più
                rilanciare, nemmeno se il prezzo scende. Sicuro?
              </p>
              <div className="mt-3 flex gap-2">
                <Bottone
                  aspetto="secondario"
                  inCorso={passa.isPending}
                  onClick={() => {
                    setErrore(null)
                    passa.mutate(lotto.id, {
                      onSuccess: (e) => {
                        if (e.esito !== 'ok') setErrore(e.messaggio)
                        setConfermaPasso(false)
                      },
                      onError: (e) => setErrore(e.message),
                    })
                  }}
                >
                  Sì, passo
                </Bottone>
                <Bottone aspetto="fantasma" onClick={() => setConfermaPasso(false)}>
                  Resto in gioco
                </Bottone>
              </div>
            </div>
          ) : (
            <Bottone aspetto="fantasma" disabilitato={inPausa} onClick={() => setConfermaPasso(true)}>
              Passo su questo calciatore
            </Bottone>
          )}
        </div>
      )}
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
// ─── Le rose, la mia e quelle degli altri ───────────────────────────────────

/**
 * Una rosa compatta: i calciatori presi, per reparto, con il prezzo pagato, e
 * i posti ancora vuoti tratteggiati.
 *
 * La usano sia la mia squadra sia gli avversari, con la stessa forma. Due
 * disegni diversi per la stessa informazione costringerebbero a rileggere il
 * secondo dopo aver imparato il primo, e durante un'asta non c'è tempo.
 */
function Rosa({
  acquisti,
  previsti,
  compatta,
}: {
  acquisti: AcquistoInRosa[]
  previsti: Record<Ruolo, number>
  compatta?: boolean
}) {
  const volto = useVolti()
  const perRuolo: Record<Ruolo, AcquistoInRosa[]> = { P: [], D: [], C: [], A: [] }
  for (const a of acquisti) perRuolo[a.players.role].push(a)
  for (const r of ORDINE_RUOLI) {
    perRuolo[r].sort((a, b) => b.price - a.price || a.players.name.localeCompare(b.players.name, 'it'))
  }

  return (
    <div className={compatta ? 'flex flex-col gap-2' : 'flex flex-col gap-3'}>
      {ORDINE_RUOLI.map((r) => {
        const presi = perRuolo[r]
        const vuoti = Math.max(0, previsti[r] - presi.length)
        return (
          <div key={r}>
            <div className="flex items-center gap-2">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CLASSE_RUOLO[r]}`}
              >
                {r}
              </span>
              <span className="cifre-fisse text-xs text-fumo">
                {presi.length}/{previsti[r]}
              </span>
              <span className="h-px flex-1 bg-verde-campo" />
            </div>

            <ul className="mt-1">
              {presi.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-0.5">
                  <Volto
                    nome={a.players.name}
                    indirizzo={volto(a.players.photo_path)}
                    classeRuolo={CLASSE_RUOLO[a.players.role]}
                    misura={22}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-nebbia">
                    {a.players.name}
                    <span className="text-xs text-fumo"> · {a.players.serie_a_team}</span>
                  </span>
                  <span className="cifre-fisse shrink-0 text-sm font-bold text-oro">{a.price}</span>
                </li>
              ))}

              {/* I posti vuoti si vedono: sono quello che resta da fare. */}
              {Array.from({ length: vuoti }, (_, i) => (
                <li key={`vuoto-${r}-${i}`} aria-hidden className="py-0.5">
                  <span className="block border-b border-dashed border-fumo/25 text-sm">&nbsp;</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/**
 * La mia squadra, sempre aperta.
 *
 * Prima qui c'erano solo i contatori per reparto. Dicono quanto manca, non chi
 * ho già preso: e chi ha già preso il portiere non offre sul secondo portiere
 * allo stesso prezzo. Il dato serve mentre si rilancia, non dopo.
 */
function LaMiaRosa({
  budget,
  lega,
  acquisti,
}: {
  budget: BudgetSquadra
  lega: { slots_p: number; slots_d: number; slots_c: number; slots_a: number }
  acquisti: AcquistoInRosa[]
}) {
  const previsti: Record<Ruolo, number> = {
    P: lega.slots_p,
    D: lega.slots_d,
    C: lega.slots_c,
    A: lega.slots_a,
  }
  const spesi = acquisti.reduce((s, a) => s + a.price, 0)

  return (
    <section className="rounded-2xl border border-verde-acceso/30 bg-verde-campo/30 p-4">
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

      <div className="mt-3">
        <Rosa acquisti={acquisti} previsti={previsti} />
      </div>
    </section>
  )
}

/**
 * Gli avversari: la riga con i crediti c'è sempre, la rosa si apre toccandola.
 *
 * Aperte tutte insieme sarebbero duecento righe fra me e il pulsante per
 * rilanciare. Chiuse del tutto costringerebbero a cambiare schermata proprio
 * mentre si decide quanto offrire, che è il momento in cui servono.
 */
function Avversari({
  squadre,
  idMio,
  rose,
  lega,
}: {
  squadre: BudgetSquadra[]
  idMio: string | undefined
  rose: AcquistoInRosa[]
  lega: { slots_p: number; slots_d: number; slots_c: number; slots_a: number } | null | undefined
}) {
  const [aperta, setAperta] = useState<string | null>(null)
  const altri = squadre.filter((s) => s.team_id !== idMio)
  if (altri.length === 0) return null

  const previsti: Record<Ruolo, number> = {
    P: lega?.slots_p ?? 3,
    D: lega?.slots_d ?? 8,
    C: lega?.slots_c ?? 8,
    A: lega?.slots_a ?? 6,
  }

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <h2 className="mb-1 text-base font-bold text-nebbia">Gli avversari</h2>
      <p className="mb-2 text-xs text-fumo">Tocca una squadra per vedere la sua rosa.</p>

      <ul className="flex flex-col divide-y divide-verde-campo">
        {altri.map((s) => {
          const suoi = rose.filter((r) => r.team_id === s.team_id)
          const eAperta = aperta === s.team_id
          return (
            <li key={s.team_id}>
              <button
                type="button"
                onClick={() => setAperta(eAperta ? null : s.team_id)}
                aria-expanded={eAperta}
                className="flex w-full items-baseline gap-3 py-2.5 text-left"
              >
                <span
                  aria-hidden
                  className={`shrink-0 text-xs text-fumo transition-transform ${eAperta ? 'rotate-90' : ''}`}
                >
                  ▶
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-nebbia">{s.name}</span>
                <span className="cifre-fisse shrink-0 text-xs text-fumo">
                  max {s.massimo_offribile} · {s.slot_rimanenti} slot
                </span>
                <span className="cifre-fisse shrink-0 text-base font-bold text-oro">
                  {s.credits_remaining}
                </span>
              </button>

              {eAperta && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pb-3 pl-6"
                >
                  {suoi.length === 0 ? (
                    <p className="text-xs text-fumo">Non ha ancora comprato nessuno.</p>
                  ) : (
                    <Rosa acquisti={suoi} previsti={previsti} compatta />
                  )}
                </motion.div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ─── Scorciatoie ────────────────────────────────────────────────────────────

function Scorciatoie({
  idLega,
  sonoAdmin,
  asta,
  ruolo,
}: {
  idLega: string | undefined
  sonoAdmin: boolean
  asta: { status: string } | null | undefined
  /** Reparto che si sta chiamando, se c'e'. */
  ruolo: Ruolo | null
}) {
  const pausa = usePausaAsta(idLega)
  const inPausa = asta?.status === 'paused'

  return (
    <section className="flex flex-wrap gap-2">
      <Link to={`/lega/${idLega}/obiettivi${ruolo ? `?ruolo=${ruolo}` : ''}`}>
        <Bottone aspetto="secondario">
          {ruolo ? `I miei ${NOME_RUOLO[ruolo].toLowerCase()}` : 'I miei obiettivi'}
        </Bottone>
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
