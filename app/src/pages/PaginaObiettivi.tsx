import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Intestazione } from '@/components/Intestazione'
import { Interruttore } from '@/components/Interruttore'
import { ListaRiordinabile } from '@/components/ListaRiordinabile'
import { useLega } from '@/features/leghe/api'
import { totaleSlot } from '@/features/leghe/tipi'
import {
  useAggiornaFascia,
  useAggiornaIncrocio,
  useAggiornaObiettivo,
  useAggiornaSlot,
  useAggiungiAIncrocio,
  useAggiungiASlot,
  useAggiungiFascia,
  useAggiungiIncrocio,
  useAggiungiObiettivi,
  useAggiungiSlot,
  useCreaSlotStandard,
  useImpostaOpzione,
  useListaObiettivi,
  useRiordinaCandidati,
  useRiordinaObiettivi,
  useTogliFascia,
  useTogliIncrocio,
  useTogliObiettivo,
  useTogliSlot,
} from '@/features/obiettivi/api'
import { SceltaMetodo } from '@/features/obiettivi/SceltaMetodo'
import { SchedaObiettivo } from '@/features/obiettivi/SchedaObiettivo'
import { SelettoreCalciatore } from '@/features/obiettivi/SelettoreCalciatore'
import {
  CLASSE_RUOLO,
  COLORI_FASCIA,
  NOME_RUOLO,
  ORDINE_RUOLI,
  contaPerRuolo,
  spesaMassima,
  type ColoreFascia,
  type ListaObiettivi,
  type Obiettivo,
} from '@/features/obiettivi/tipi'
import type { Ruolo } from '@/domain/listone'

export function PaginaObiettivi() {
  const { id: idLega } = useParams()
  const { data: lega } = useLega(idLega)
  const { data: lista, isPending, error } = useListaObiettivi(idLega)
  const [cambioMetodo, setCambioMetodo] = useState(false)

  if (isPending) {
    return (
      <Guscio idLega={idLega}>
        <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
      </Guscio>
    )
  }

  if (error || !lista) {
    return (
      <Guscio idLega={idLega}>
        <p role="alert" className="rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm text-errore">
          {error ? error.message : 'Non riesco a caricare la tua lista.'}
        </p>
      </Guscio>
    )
  }

  // Finché non ha scelto, la schermata è la scelta. Non si apre un ambiente
  // già impostato per lui su un metodo che non ha deciso.
  if (!lista.metodo_confermato || cambioMetodo) {
    return (
      <div className="min-h-dvh">
        {/* La freccia indietro c'è sempre: da una schermata di scelta si deve
            poter uscire senza scegliere. */}
        <Intestazione titolo="I miei obiettivi" sottotitolo={lega?.name} indietroA={`/lega/${idLega}`} />
        <SceltaMetodo
          lista={lista}
          idLega={idLega}
          primaVolta={!lista.metodo_confermato}
          onAnnulla={cambioMetodo ? () => setCambioMetodo(false) : undefined}
          onFatto={() => setCambioMetodo(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <Intestazione titolo="I miei obiettivi" sottotitolo={lega?.name} indietroA={`/lega/${idLega}`} />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <Riservatezza />
        <Riepilogo lista={lista} creditiLega={lega?.credits_initial} rosa={lega ? totaleSlot(lega) : undefined} />
        <BarraMetodo lista={lista} idLega={idLega} onCambia={() => setCambioMetodo(true)} />

        {lista.metodo === 'fasce' ? (
          <SezioneFasce lista={lista} idLega={idLega} />
        ) : (
          <SezioneSlot lista={lista} idLega={idLega} />
        )}

        {lista.usa_incroci && <SezioneIncroci lista={lista} idLega={idLega} />}
      </main>
    </div>
  )
}

function Guscio({ idLega, children }: { idLega: string | undefined; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Intestazione titolo="I miei obiettivi" indietroA={`/lega/${idLega}`} />
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  )
}

// ─── Riservatezza ───────────────────────────────────────────────────────────

function Riservatezza() {
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-verde-acceso/30 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
      <span aria-hidden className="text-base">
        🔒
      </span>
      <span>
        Questa pagina la vedi <strong>solo tu</strong>. Nemmeno l&apos;amministratore della lega può
        leggere i tuoi obiettivi, i tetti di spesa o le note.
      </span>
    </p>
  )
}

// ─── Riepilogo ──────────────────────────────────────────────────────────────

function Riepilogo({
  lista,
  creditiLega,
  rosa,
}: {
  lista: ListaObiettivi
  creditiLega: number | undefined
  rosa: number | undefined
}) {
  const per = contaPerRuolo(lista.targets)
  const spesa = spesaMassima(lista.targets)
  const sfora = creditiLega != null && spesa > creditiLega

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-nebbia">
          <span className="cifre-fisse text-2xl text-oro">{lista.targets.length}</span> obiettivi
        </h2>
        {rosa != null && <p className="text-xs text-fumo">La rosa da riempire è di {rosa}</p>}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {ORDINE_RUOLI.map((r) => (
          <div key={r} className="rounded-xl bg-verde-notte px-2 py-2 text-center">
            <span
              className={`mx-auto mb-1 flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${CLASSE_RUOLO[r]}`}
              title={NOME_RUOLO[r]}
            >
              {r}
            </span>
            <p className="cifre-fisse text-lg font-bold text-nebbia">{per[r]}</p>
          </div>
        ))}
      </div>

      {lista.usa_tetti && (
        <div className="mt-3 rounded-xl bg-verde-notte px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-fumo">Somma dei tetti</span>
            <span className={`cifre-fisse text-lg font-bold ${sfora ? 'text-oro' : 'text-nebbia'}`}>
              {spesa}
              {creditiLega != null && <span className="text-sm text-fumo"> / {creditiLega}</span>}
            </span>
          </div>
          {sfora && (
            <p className="mt-2 text-xs text-oro">
              Se li prendessi tutti al tetto che ti sei dato, sforeresti il budget. Non è un errore:
              gli obiettivi sono più di quelli che comprerai.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ─── La barra del metodo ────────────────────────────────────────────────────

function BarraMetodo({
  lista,
  idLega,
  onCambia,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  onCambia: () => void
}) {
  const opzione = useImpostaOpzione(idLega)
  const [aperta, setAperta] = useState(false)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-2xl">
          {lista.metodo === 'fasce' ? '🪜' : '🎯'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-nebbia">
            {lista.metodo === 'fasce' ? 'Stai usando le fasce' : 'Stai usando gli slot'}
          </p>
          <p className="truncate text-xs text-fumo">
            {[
              lista.usa_tetti ? 'con tetto di spesa' : 'senza tetto di spesa',
              lista.usa_incroci ? 'con incrocio portieri' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Bottone aspetto="fantasma" onClick={() => setAperta((v) => !v)}>
          {aperta ? 'Chiudi' : 'Opzioni'}
        </Bottone>
      </div>

      {aperta && (
        <div className="mt-4 flex flex-col gap-4 border-t border-verde-campo pt-4">
          <Interruttore
            etichetta="Tetto di spesa"
            descrizione="Il prezzo massimo che ti imponi su ogni calciatore."
            acceso={lista.usa_tetti}
            onChange={(acceso) => opzione.mutate({ idLista: lista.id, campo: 'usa_tetti', acceso })}
          />
          <Interruttore
            etichetta="Incrocio portieri"
            descrizione="Coppie di portieri con i calendari che si alternano."
            acceso={lista.usa_incroci}
            onChange={(acceso) => opzione.mutate({ idLista: lista.id, campo: 'usa_incroci', acceso })}
          />
          <div>
            <Bottone aspetto="secondario" onClick={onCambia}>
              Cambia metodo
            </Bottone>
            <p className="mt-2 text-xs text-fumo">
              Si apre la schermata di scelta. Finché non confermi non cambia niente, e quello che
              hai costruito con l&apos;altro metodo resta comunque dov&apos;è.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Metodo delle fasce
// ═══════════════════════════════════════════════════════════════════════════

function SezioneFasce({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungiFascia = useAggiungiFascia(idLega)
  const aggiornaFascia = useAggiornaFascia(idLega)
  const togliFascia = useTogliFascia(idLega)
  const aggiungi = useAggiungiObiettivi(idLega)
  const [selettore, setSelettore] = useState<{ fascia: string; nome: string } | null>(null)
  const [nuova, setNuova] = useState('')

  const ordinate = [...lista.tiers].sort((a, b) => a.position - b.position)
  const senzaFascia = lista.targets.filter((t) => !t.tier_id)
  const giaPresenti = new Set(lista.targets.map((t) => t.player_id))

  function spostaFascia(indice: number, direzione: -1 | 1) {
    const altro = indice + direzione
    if (altro < 0 || altro >= ordinate.length) return
    aggiornaFascia.mutate({ id: ordinate[indice].id, campi: { position: ordinate[altro].position } })
    aggiornaFascia.mutate({ id: ordinate[altro].id, campi: { position: ordinate[indice].position } })
  }

  return (
    <>
      {ordinate.map((fascia, i) => {
        const dentro = lista.targets.filter((t) => t.tier_id === fascia.id)
        return (
          <motion.section
            key={fascia.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className={`rounded-2xl border bg-verde-campo/30 p-4 ${COLORI_FASCIA[fascia.color].bordo}`}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden className={`size-3 shrink-0 rounded-full ${COLORI_FASCIA[fascia.color].punto}`} />
              <input
                defaultValue={fascia.name}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== fascia.name) aggiornaFascia.mutate({ id: fascia.id, campi: { name: v } })
                }}
                aria-label="Nome della fascia"
                className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-base font-bold text-nebbia outline-none hover:border-verde-acceso/30 focus:border-verde-acceso"
              />
              <span className="cifre-fisse shrink-0 text-sm text-fumo">{dentro.length}</span>
              <button
                type="button"
                onClick={() => spostaFascia(i, -1)}
                disabled={i === 0}
                aria-label={`Sposta la fascia ${fascia.name} più in alto`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-nebbia disabled:opacity-25"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => spostaFascia(i, 1)}
                disabled={i === ordinate.length - 1}
                aria-label={`Sposta la fascia ${fascia.name} più in basso`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-nebbia disabled:opacity-25"
              >
                ▼
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={fascia.color}
                onChange={(e) =>
                  aggiornaFascia.mutate({ id: fascia.id, campi: { color: e.target.value as ColoreFascia } })
                }
                aria-label={`Colore della fascia ${fascia.name}`}
                className="h-10 rounded-lg border border-verde-acceso/30 bg-verde-notte px-2 text-xs text-nebbia outline-none"
              >
                {Object.entries(COLORI_FASCIA).map(([chiave, c]) => (
                  <option key={chiave} value={chiave}>
                    {c.nome}
                  </option>
                ))}
              </select>

              <Bottone
                aspetto="secondario"
                onClick={() => setSelettore({ fascia: fascia.id, nome: fascia.name })}
              >
                Aggiungi calciatori
              </Bottone>

              <button
                type="button"
                onClick={() => togliFascia.mutate(fascia.id)}
                aria-label={`Elimina la fascia ${fascia.name}`}
                className="ml-auto flex size-10 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
              >
                ✕
              </button>
            </div>

            <div className="mt-3">
              <GruppiPerRuolo lista={lista} idLega={idLega} obiettivi={dentro} idFascia={fascia.id} />
            </div>
          </motion.section>
        )
      })}

      {senzaFascia.length > 0 && (
        <section className="rounded-2xl border border-dashed border-fumo/40 bg-verde-campo/20 p-4">
          <h3 className="text-base font-bold text-fumo">Senza fascia</h3>
          <p className="mt-0.5 mb-3 text-xs text-fumo">
            Assegnali a una fascia dal menù dentro ogni scheda, oppure toglili.
          </p>
          <GruppiPerRuolo lista={lista} idLega={idLega} obiettivi={senzaFascia} idFascia={null} />
        </section>
      )}

      <section className="rounded-2xl border border-verde-campo bg-verde-campo/20 p-4">
        <p className="mb-2 text-sm font-semibold text-nebbia">Aggiungi una fascia</p>
        <div className="flex gap-2">
          <input
            value={nuova}
            onChange={(e) => setNuova(e.target.value)}
            placeholder="Es. Scommesse da 1 credito"
            className="h-11 min-w-0 flex-1 rounded-xl border border-verde-acceso/30 bg-verde-notte px-3 text-sm text-nebbia outline-none focus:border-verde-acceso"
          />
          <Bottone
            aspetto="secondario"
            disabilitato={nuova.trim().length === 0}
            onClick={() => {
              aggiungiFascia.mutate({
                idLista: lista.id,
                nome: nuova.trim(),
                colore: 'fumo',
                posizione: ordinate.length,
              })
              setNuova('')
            }}
          >
            Aggiungi
          </Bottone>
        </div>
        <p className="mt-2 text-xs text-fumo">
          Eliminare una fascia non cancella i calciatori: restano nella lista, senza fascia.
        </p>
      </section>

      {selettore && (
        <SelettoreCalciatore
          titolo={`Aggiungi a «${selettore.nome}»`}
          giaPresenti={giaPresenti}
          inCorso={aggiungi.isPending}
          onChiudi={() => setSelettore(null)}
          onConferma={(idCalciatori) =>
            aggiungi.mutate(
              { idLista: lista.id, idCalciatori, idFascia: selettore.fascia },
              { onSettled: () => setSelettore(null) },
            )
          }
        />
      )}
    </>
  )
}

/**
 * I calciatori di un gruppo, divisi per ruolo e riordinabili trascinando.
 *
 * L'ordine conta dentro il ruolo, non fra ruoli: durante l'asta ci si chiede
 * «chi provo a prendere adesso in attacco», non «chi viene prima fra un
 * portiere e un difensore».
 */
function GruppiPerRuolo({
  lista,
  idLega,
  obiettivi,
  idFascia,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  obiettivi: Obiettivo[]
  idFascia: string | null
}) {
  const aggiorna = useAggiornaObiettivo(idLega)
  const togli = useTogliObiettivo(idLega)
  const riordina = useRiordinaObiettivi(idLega)

  const perRuolo = useMemo(() => {
    return ORDINE_RUOLI.map((r) => ({
      ruolo: r,
      righe: obiettivi
        .filter((t) => t.players.role === r)
        .sort((a, b) => a.priority - b.priority || a.players.name.localeCompare(b.players.name, 'it')),
    })).filter((g) => g.righe.length > 0)
  }, [obiettivi])

  if (obiettivi.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-verde-campo px-4 py-3 text-xs text-fumo">
        Ancora nessun calciatore qui dentro.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {perRuolo.map((g) => (
        <div key={g.ruolo}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${CLASSE_RUOLO[g.ruolo]}`}
            >
              {g.ruolo}
            </span>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-fumo">
              {NOME_RUOLO[g.ruolo]}
            </h4>
            <span className="cifre-fisse text-xs text-fumo">{g.righe.length}</span>
          </div>

          <ListaRiordinabile
            elementi={g.righe}
            chiave={(o) => o.id}
            descrizione={(o) => o.players.name}
            onRiordina={(nuovo) =>
              riordina.mutate(
                nuovo.map((o, i) => ({ id: o.id, priorita: i, fascia: idFascia })),
              )
            }
            rendi={(o) => (
              <SchedaObiettivo
                obiettivo={o}
                fasce={lista.tiers}
                mostraFascia={lista.metodo === 'fasce'}
                mostraTetto={lista.usa_tetti}
                onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
                onTogli={() => togli.mutate(o.id)}
              />
            )}
          />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Metodo degli slot
// ═══════════════════════════════════════════════════════════════════════════

function SezioneSlot({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungiSlot = useAggiungiSlot(idLega)
  const aggiornaSlot = useAggiornaSlot(idLega)
  const togliSlot = useTogliSlot(idLega)
  const creaStandard = useCreaSlotStandard(idLega)
  const aggiungiA = useAggiungiASlot(idLega)
  const riordina = useRiordinaCandidati(idLega)
  const aggiorna = useAggiornaObiettivo(idLega)
  const togli = useTogliObiettivo(idLega)

  const [selettore, setSelettore] = useState<{ slot: string; ruolo: Ruolo; nome: string } | null>(null)

  /** Chi è già candidato in quello slot: solo lui va escluso dalla scelta. */
  function giaInSlot(idSlot: string): Set<number> {
    const s = lista.roster_slots.find((x) => x.id === idSlot)
    return new Set(
      (s?.slot_candidates ?? [])
        .map((c) => perObiettivo.get(c.target_id)?.player_id)
        .filter((n): n is number => typeof n === 'number'),
    )
  }

  const perObiettivo = new Map(lista.targets.map((t) => [t.id, t]))
  const inQualcheSlot = new Set(
    lista.roster_slots.flatMap((s) => s.slot_candidates.map((c) => c.target_id)),
  )
  const orfani = lista.targets.filter((t) => !inQualcheSlot.has(t.id))

  if (lista.roster_slots.length === 0) {
    return (
      <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-6 text-center">
        <p className="text-base font-bold text-nebbia">Non hai ancora nessuno slot</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-fumo">
          Uno slot è un posto della rosa da riempire: «Attaccante 1», «il portiere titolare», «la
          scommessa». Dentro ogni slot metti i candidati in ordine di preferenza.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Bottone
            misura="grande"
            inCorso={creaStandard.isPending}
            onClick={() => creaStandard.mutate(lista.id)}
          >
            Creali dalla rosa della lega
          </Bottone>
        </div>
        <p className="mt-3 text-xs text-fumo">
          Li crea seguendo la composizione decisa dalla lega, e poi li rinomini come vuoi.
        </p>
      </section>
    )
  }

  return (
    <>
      {ORDINE_RUOLI.map((ruolo) => {
        const slot = lista.roster_slots
          .filter((s) => s.role === ruolo)
          .sort((a, b) => a.position - b.position)
        if (slot.length === 0) return null

        return (
          <section key={ruolo} className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${CLASSE_RUOLO[ruolo]}`}
              >
                {ruolo}
              </span>
              <h2 className="text-base font-bold text-nebbia">{NOME_RUOLO[ruolo]}</h2>
              <button
                type="button"
                onClick={() =>
                  aggiungiSlot.mutate({
                    idLista: lista.id,
                    ruolo,
                    etichetta: `${NOME_RUOLO[ruolo].slice(0, -1)} ${slot.length + 1}`,
                    posizione: slot.length,
                  })
                }
                className="ml-auto text-xs font-semibold text-oro underline underline-offset-4"
              >
                aggiungi slot
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {slot.map((s) => {
                const candidati = [...s.slot_candidates]
                  .sort((a, b) => a.position - b.position)
                  .map((c) => perObiettivo.get(c.target_id))
                  .filter((o): o is Obiettivo => Boolean(o))

                return (
                  <div key={s.id} className="rounded-xl border border-verde-campo bg-verde-notte p-3">
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={s.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== s.label) aggiornaSlot.mutate({ id: s.id, campi: { label: v } })
                        }}
                        aria-label="Nome dello slot"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold text-nebbia outline-none hover:border-verde-acceso/30 focus:border-verde-acceso"
                      />
                      <span className="cifre-fisse shrink-0 text-xs text-fumo">
                        {candidati.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => togliSlot.mutate(s.id)}
                        aria-label={`Elimina lo slot ${s.label}`}
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
                      >
                        ✕
                      </button>
                    </div>

                    {candidati.length > 0 ? (
                      <div className="mt-3">
                        <ListaRiordinabile
                          elementi={candidati}
                          chiave={(o) => o.id}
                          descrizione={(o) => o.players.name}
                          onRiordina={(nuovo) =>
                            riordina.mutate({ idSlot: s.id, ordine: nuovo.map((o) => o.id) })
                          }
                          rendi={(o) => (
                            <SchedaObiettivo
                              obiettivo={o}
                              fasce={[]}
                              mostraFascia={false}
                              mostraTetto={lista.usa_tetti}
                              onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
                              onTogli={() => togli.mutate(o.id)}
                            />
                          )}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 rounded-lg border border-dashed border-verde-campo px-3 py-2 text-xs text-fumo">
                        Nessun candidato per questo posto.
                      </p>
                    )}

                    <div className="mt-3">
                      <Bottone
                        aspetto="secondario"
                        onClick={() => setSelettore({ slot: s.id, ruolo, nome: s.label })}
                      >
                        Aggiungi calciatori
                      </Bottone>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {orfani.length > 0 && (
        <section className="rounded-2xl border border-dashed border-fumo/40 bg-verde-campo/20 p-4">
          <h3 className="text-base font-bold text-fumo">Fuori dagli slot</h3>
          <p className="mt-0.5 mb-3 text-xs text-fumo">
            Sono nella tua lista ma non dentro nessuno slot. Aggiungili a uno slot dal pulsante qui
            sopra, oppure toglili.
          </p>
          <ul className="flex flex-col gap-2">
            {orfani.map((o) => (
              <li key={o.id}>
                <SchedaObiettivo
                  obiettivo={o}
                  fasce={[]}
                  mostraFascia={false}
                  mostraTetto={lista.usa_tetti}
                  onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
                  onTogli={() => togli.mutate(o.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {selettore && (
        <SelettoreCalciatore
          titolo={`Candidati per «${selettore.nome}»`}
          soloRuolo={selettore.ruolo}
          giaPresenti={giaInSlot(selettore.slot)}
          inCorso={aggiungiA.isPending}
          onChiudi={() => setSelettore(null)}
          onConferma={(idCalciatori) =>
            aggiungiA.mutate(
              { idSlot: selettore.slot, idCalciatori },
              { onSettled: () => setSelettore(null) },
            )
          }
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Incrocio portieri
// ═══════════════════════════════════════════════════════════════════════════

function SezioneIncroci({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungi = useAggiungiIncrocio(idLega)
  const aggiorna = useAggiornaIncrocio(idLega)
  const togli = useTogliIncrocio(idLega)
  const aggiungiA = useAggiungiAIncrocio(idLega)
  const [selettore, setSelettore] = useState<{ incrocio: string; nome: string } | null>(null)

  const perObiettivo = new Map(lista.targets.map((t) => [t.id, t]))
  const gruppi = [...lista.goalkeeper_pairings].sort((a, b) => a.position - b.position)

  /** Chi è già in quell'incrocio. Lo stesso portiere può stare in due gruppi
      che stai confrontando fra loro. */
  function giaNellIncrocio(idIncrocio: string): Set<number> {
    const g = gruppi.find((x) => x.id === idIncrocio)
    return new Set(
      (g?.pairing_members ?? [])
        .map((mm) => perObiettivo.get(mm.target_id)?.player_id)
        .filter((n): n is number => typeof n === 'number'),
    )
  }

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <h2 className="text-base font-bold text-nebbia">L&apos;incrocio dei portieri</h2>
      <p className="mt-0.5 mb-3 text-xs text-fumo">
        Due o tre portieri di squadre di media fascia i cui calendari si alternano: quando uno
        affronta una big, l&apos;altro ha la partita facile. Nella nota scrivi come si incrociano.
      </p>

      <div className="flex flex-col gap-3">
        {gruppi.map((g) => {
          const membri = [...g.pairing_members]
            .sort((a, b) => a.position - b.position)
            .map((m) => perObiettivo.get(m.target_id))
            .filter((o): o is Obiettivo => Boolean(o))

          return (
            <div key={g.id} className="rounded-xl border border-verde-campo bg-verde-notte p-3">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={g.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== g.name) aggiorna.mutate({ id: g.id, campi: { name: v } })
                  }}
                  aria-label="Nome dell'incrocio"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold text-nebbia outline-none hover:border-verde-acceso/30 focus:border-verde-acceso"
                />
                <button
                  type="button"
                  onClick={() => togli.mutate(g.id)}
                  aria-label={`Elimina l'incrocio ${g.name}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
                >
                  ✕
                </button>
              </div>

              {membri.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {membri.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-2 rounded-full bg-oro/15 py-1.5 pl-3 pr-2 text-sm text-nebbia"
                    >
                      <span className="truncate">
                        {o.players.name}
                        <span className="text-fumo"> · {o.players.serie_a_team}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-fumo">Nessun portiere in questo incrocio.</p>
              )}

              <div className="mt-2">
                <Bottone
                  aspetto="secondario"
                  onClick={() => setSelettore({ incrocio: g.id, nome: g.name })}
                >
                  Aggiungi portieri
                </Bottone>
              </div>

              <textarea
                defaultValue={g.note ?? ''}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null
                  if (v !== g.note) aggiorna.mutate({ id: g.id, campi: { note: v } })
                }}
                rows={2}
                placeholder="Come si alternano in calendario"
                aria-label={`Nota sull'incrocio ${g.name}`}
                className="mt-2 w-full rounded-lg border border-verde-acceso/30 bg-verde-campo/60 p-3 text-sm text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        <Bottone
          aspetto="secondario"
          onClick={() =>
            aggiungi.mutate({
              idLista: lista.id,
              nome: `Incrocio ${gruppi.length + 1}`,
              posizione: gruppi.length,
            })
          }
        >
          Nuovo incrocio
        </Bottone>
      </div>

      {selettore && (
        <SelettoreCalciatore
          titolo={`Portieri per «${selettore.nome}»`}
          soloRuolo="P"
          giaPresenti={giaNellIncrocio(selettore.incrocio)}
          inCorso={aggiungiA.isPending}
          onChiudi={() => setSelettore(null)}
          onConferma={(idCalciatori) =>
            aggiungiA.mutate(
              { idIncrocio: selettore.incrocio, idCalciatori },
              { onSettled: () => setSelettore(null) },
            )
          }
        />
      )}
    </section>
  )
}
