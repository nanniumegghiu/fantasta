import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Intestazione } from '@/components/Intestazione'
import { Interruttore } from '@/components/Interruttore'
import { ListaRiordinabile } from '@/components/ListaRiordinabile'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import { useBudgetSquadre, useCanaleAsta, useRose } from '@/features/asta/api'
import { useLega } from '@/features/leghe/api'
import { totaleSlot } from '@/features/leghe/tipi'
import {
  useAggiornaFascia,
  useAggiornaIncrocio,
  useAggiornaObiettivo,
  useAggiornaSlot,
  useAggiungiAFascia,
  useAggiungiAIncrocio,
  useAggiungiASlot,
  useAggiungiFascia,
  useAggiungiIncrocio,
  useImpostaOpzione,
  useListaObiettivi,
  useRiordinaCandidati,
  useRiordinaObiettivi,
  useTogliDaSlot,
  useTogliFascia,
  useTogliIncrocio,
  useTogliObiettivo,
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
  slotCoperti,
  spesaMassima,
  spesaPianificata,
  type ColoreFascia,
  type Fascia as FasciaTipo,
  type ListaObiettivi,
  type Obiettivo,
  type SlotRosa,
} from '@/features/obiettivi/tipi'
import type { Ruolo } from '@/domain/listone'

export function PaginaObiettivi() {
  const { id: idLega } = useParams()
  const { data: lega } = useLega(idLega)
  const { data: listaGrezza, isPending, error } = useListaObiettivi(idLega)
  const [cambioMetodo, setCambioMetodo] = useState(false)
  const [mostraPresi, setMostraPresi] = useState(false)

  // ─── Viva durante l'asta ──────────────────────────────────────────────────
  // Il canale è lo stesso dell'asta: quando qualcuno compra, le rose si
  // ricaricano e questa pagina si aggiorna con loro. Senza, si guarderebbe un
  // elenco fermo a com'era all'apertura, e si preparerebbe una chiamata su un
  // calciatore già di un altro.
  useCanaleAsta(idLega)
  const { data: rose } = useRose(idLega)

  // Chi è già stato comprato, da chiunque. Il dato viene dalle rose e non da
  // `targets.status`: le rose sono la verità, lo stato è una copia che
  // potrebbe restare indietro.
  const { utente } = useAccesso()
  const { data: budget } = useBudgetSquadre(idLega)

  // Il reparto scelto sta nell'indirizzo, non nello stato: così dall'asta si
  // arriva già filtrati sul ruolo che si sta chiamando, e il collegamento si
  // può rimettere fra i preferiti.
  const [parametri, setParametri] = useSearchParams()
  const ruoloScelto = (parametri.get('ruolo') as Ruolo | null) ?? null
  function scegliRuolo(r: Ruolo | null) {
    const p = new URLSearchParams(parametri)
    if (r) p.set('ruolo', r)
    else p.delete('ruolo')
    setParametri(p, { replace: true })
  }

  // Si distingue «l'hai preso tu» da «l'ha preso un altro»: a fine serata è
  // una differenza che conta, e costa una riga.
  const idMiaSquadra = budget?.find((b) => b.user_id === utente?.id)?.team_id ?? null
  const compratiDaMe = new Set<number>()
  const compratiDaAltri = new Set<number>()
  for (const r of rose ?? []) {
    if (idMiaSquadra && r.team_id === idMiaSquadra) compratiDaMe.add(r.player_id)
    else compratiDaAltri.add(r.player_id)
  }
  const comprati = new Set<number>([...compratiDaMe, ...compratiDaAltri])

  if (isPending) {
    return (
      <Guscio idLega={idLega}>
        <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
      </Guscio>
    )
  }

  if (error || !listaGrezza) {
    return (
      <Guscio idLega={idLega}>
        <p role="alert" className="rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm text-errore">
          {error ? error.message : 'Non riesco a caricare la tua lista.'}
        </p>
      </Guscio>
    )
  }

  /**
   * La lista senza i calciatori che non si possono più comprare.
   *
   * Si tolgono gli obiettivi **e i legami che li nominano**: slot e incroci
   * puntano agli obiettivi per identificativo, e lasciare i legami orfani
   * farebbe contare come «coperto» uno slot il cui unico candidato è appena
   * finito nella rosa di un altro. Sarebbe un conto che dice il contrario di
   * quello che si vede.
   *
   * Nessuno viene cancellato dal database: qui si nasconde, e con un tocco si
   * riguardano. A fine serata sapere chi ti è sfuggito, e a chi, è metà del
   * divertimento.
   */
  const presi = listaGrezza.targets.filter((t) => comprati.has(t.player_id))
  const lista = ((): typeof listaGrezza => {
    if (mostraPresi || presi.length === 0) return listaGrezza
    const restano = new Set(
      listaGrezza.targets.filter((t) => !comprati.has(t.player_id)).map((t) => t.id),
    )
    return {
      ...listaGrezza,
      targets: listaGrezza.targets.filter((t) => restano.has(t.id)),
      roster_slots: listaGrezza.roster_slots.map((slot) => ({
        ...slot,
        slot_candidates: slot.slot_candidates.filter((c) => restano.has(c.target_id)),
      })),
      goalkeeper_pairings: listaGrezza.goalkeeper_pairings.map((g) => ({
        ...g,
        pairing_members: g.pairing_members.filter((m) => restano.has(m.target_id)),
      })),
    }
  })()

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
        <GiaPresi
          quantiTuoi={presi.filter((t) => compratiDaMe.has(t.player_id)).length}
          quantiAltrui={presi.filter((t) => compratiDaAltri.has(t.player_id)).length}
          mostrati={mostraPresi}
          onMostra={() => setMostraPresi((v) => !v)}
        />
        <Riepilogo lista={lista} creditiLega={lega?.credits_initial} rosa={lega ? totaleSlot(lega) : undefined} />
        <BarraMetodo lista={lista} idLega={idLega} onCambia={() => setCambioMetodo(true)} />
        <FiltroReparto scelto={ruoloScelto} onScegli={scegliRuolo} lista={lista} />

        {lista.metodo === 'fasce' ? (
          <SezioneFasce
            lista={lista}
            idLega={idLega}
            ruoloScelto={ruoloScelto}
            comprati={comprati}
          />
        ) : (
          <SezioneSlot lista={lista} idLega={idLega} ruoloScelto={ruoloScelto} comprati={comprati} />
        )}

        {lista.usa_incroci && (ruoloScelto === null || ruoloScelto === 'P') && (
          <SezioneIncroci lista={lista} idLega={idLega} />
        )}
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

// ─── Chi non si può più prendere ────────────────────────────────────────────

/**
 * Quanti obiettivi sono usciti di scena, e un modo per riguardarli.
 *
 * Toglierli e basta lascerebbe il dubbio di aver perso una riga per un difetto.
 * Una frase che dice quanti sono, e un tocco per rivederli, costano poco e
 * tolgono ogni ambiguità.
 */
function GiaPresi({
  quantiTuoi,
  quantiAltrui,
  mostrati,
  onMostra,
}: {
  quantiTuoi: number
  quantiAltrui: number
  mostrati: boolean
  onMostra: () => void
}) {
  const totale = quantiTuoi + quantiAltrui
  if (totale === 0) return null

  const pezzi = [
    quantiTuoi > 0 ? `${quantiTuoi} ${quantiTuoi === 1 ? 'preso' : 'presi'} da te` : null,
    quantiAltrui > 0 ? `${quantiAltrui} dagli avversari` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-verde-campo bg-verde-campo/20 px-4 py-3 text-sm">
      <span aria-hidden>⚡</span>
      <span className="text-fumo">
        {mostrati
          ? `Stai vedendo anche i ${totale} obiettivi non più disponibili.`
          : `${pezzi.join(', ')}: ${totale === 1 ? 'nascosto' : 'nascosti'}.`}
      </span>
      <button
        type="button"
        onClick={onMostra}
        className="ml-auto font-semibold text-oro underline underline-offset-4"
      >
        {mostrati ? 'nascondili' : 'mostrali'}
      </button>
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
  const conSlot = lista.metodo === 'slot'

  // Le due somme dicono cose diverse e non vanno confuse.
  //
  // Con le fasce gli obiettivi sono **più** di quelli che comprerai: sforare
  // è normale, ed è la ragione per cui hai delle alternative.
  //
  // Con gli slot i posti sono esattamente quelli della rosa, uno a testa: la
  // somma dei massimali è il piano di spesa vero, e se sfora non regge.
  const spesa = conSlot ? spesaPianificata(lista.roster_slots) : spesaMassima(lista.targets)
  const sfora = creditiLega != null && spesa > creditiLega
  const coperti = slotCoperti(lista.roster_slots)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-nebbia">
          {conSlot ? (
            <>
              <span className="cifre-fisse text-2xl text-oro">{coperti}</span> posti coperti su{' '}
              <span className="cifre-fisse">{lista.roster_slots.length}</span>
            </>
          ) : (
            <>
              <span className="cifre-fisse text-2xl text-oro">{lista.targets.length}</span> obiettivi
            </>
          )}
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
            <span className="text-sm text-fumo">
              {conSlot ? 'Somma dei massimali' : 'Somma dei tetti'}
            </span>
            <span className={`cifre-fisse text-lg font-bold ${sfora ? 'text-oro' : 'text-nebbia'}`}>
              {spesa}
              {creditiLega != null && <span className="text-sm text-fumo"> / {creditiLega}</span>}
            </span>
          </div>
          {sfora &&
            (conSlot ? (
              <p className="mt-2 text-xs text-oro">
                Il piano non sta in piedi: i posti sono esattamente quelli della rosa, quindi questa
                somma è quello che spenderesti davvero. Abbassa qualche massimale.
              </p>
            ) : (
              <p className="mt-2 text-xs text-oro">
                Se li prendessi tutti al tetto che ti sei dato, sforeresti il budget. Non è un
                errore: gli obiettivi sono più di quelli che comprerai.
              </p>
            ))}
        </div>
      )}
    </section>
  )
}

// ─── Il filtro per reparto ──────────────────────────────────────────────────

/**
 * Durante l'asta si chiamano i portieri: in quel momento difensori,
 * centrocampisti e attaccanti sono rumore. Questo filtro li toglie di mezzo.
 *
 * Vive nell'indirizzo, così la vista personale dell'asta può portare qui già
 * filtrato sul reparto che si sta chiamando.
 */
function FiltroReparto({
  scelto,
  onScegli,
  lista,
}: {
  scelto: Ruolo | null
  onScegli: (r: Ruolo | null) => void
  lista: ListaObiettivi
}) {
  const per = contaPerRuolo(lista.targets)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <PillolaRuolo attiva={scelto === null} onClick={() => onScegli(null)}>
          Tutti i reparti
        </PillolaRuolo>
        {ORDINE_RUOLI.map((r) => (
          <PillolaRuolo key={r} attiva={scelto === r} onClick={() => onScegli(r)}>
            {NOME_RUOLO[r]} <span className="cifre-fisse opacity-70">{per[r]}</span>
          </PillolaRuolo>
        ))}
      </div>
      {scelto && (
        <p className="mt-2 px-1 text-xs text-fumo">
          Stai vedendo solo {NOME_RUOLO[scelto].toLowerCase()}. Durante l&apos;asta serve a togliere
          di mezzo i reparti che non si stanno chiamando.
        </p>
      )}
    </section>
  )
}

function PillolaRuolo({
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
        'h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
        attiva ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
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

/**
 * Le fasce, divise per reparto.
 *
 * Il reparto è la prima divisione, non un modo di visualizzare: una fascia di
 * difensori accoglie solo difensori, e quando scegli i nomi non ti vengono
 * proposti gli attaccanti.
 */
function SezioneFasce({
  lista,
  idLega,
  ruoloScelto,
  comprati,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  ruoloScelto: Ruolo | null
  /** Chi ha già una rosa: non si propone più a nessuno. */
  comprati: Set<number>
}) {
  const aggiungiFascia = useAggiungiFascia(idLega)
  const aggiungiA = useAggiungiAFascia(idLega)
  const [selettore, setSelettore] = useState<{ fascia: string; ruolo: Ruolo; nome: string } | null>(null)
  const [nuova, setNuova] = useState<Record<string, string>>({})

  const reparti = ruoloScelto ? [ruoloScelto] : ORDINE_RUOLI
  const senzaFascia = lista.targets.filter(
    (x) => !x.tier_id && (!ruoloScelto || x.players.role === ruoloScelto),
  )

  /** Chi non va più proposto: i tuoi obiettivi di quel reparto, e i comprati. */
  function giaNelReparto(ruolo: Ruolo): Set<number> {
    return new Set([
      ...lista.targets.filter((x) => x.players.role === ruolo).map((x) => x.player_id),
      ...comprati,
    ])
  }

  return (
    <>
      {reparti.map((ruolo) => {
        const fasce = lista.tiers
          .filter((f) => f.role === ruolo)
          .sort((a, b) => a.position - b.position)

        return (
          <section key={ruolo} className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${CLASSE_RUOLO[ruolo]}`}
              >
                {ruolo}
              </span>
              <h2 className="text-base font-bold text-nebbia">{NOME_RUOLO[ruolo]}</h2>
              <span className="cifre-fisse text-xs text-fumo">
                {lista.targets.filter((x) => x.players.role === ruolo).length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {fasce.map((fascia, i) => (
                <Fascia
                  key={fascia.id}
                  fascia={fascia}
                  posizione={i}
                  quante={fasce.length}
                  lista={lista}
                  idLega={idLega}
                  onAggiungi={() => setSelettore({ fascia: fascia.id, ruolo, nome: fascia.name })}
                />
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={nuova[ruolo] ?? ''}
                onChange={(e) => setNuova((n) => ({ ...n, [ruolo]: e.target.value }))}
                placeholder={`Nuova fascia per i ${NOME_RUOLO[ruolo].toLowerCase()}`}
                className="h-11 min-w-0 flex-1 rounded-xl border border-verde-acceso/30 bg-verde-notte px-3 text-sm text-nebbia outline-none focus:border-verde-acceso"
              />
              <Bottone
                aspetto="secondario"
                disabilitato={(nuova[ruolo] ?? '').trim().length === 0}
                onClick={() => {
                  aggiungiFascia.mutate({
                    idLista: lista.id,
                    ruolo,
                    nome: (nuova[ruolo] ?? '').trim(),
                    colore: 'fumo',
                    posizione: fasce.length,
                  })
                  setNuova((n) => ({ ...n, [ruolo]: '' }))
                }}
              >
                Aggiungi
              </Bottone>
            </div>
          </section>
        )
      })}

      {senzaFascia.length > 0 && (
        <section className="rounded-2xl border border-dashed border-fumo/40 bg-verde-campo/20 p-4">
          <h3 className="text-base font-bold text-fumo">Senza fascia</h3>
          <p className="mt-0.5 mb-3 text-xs text-fumo">
            Assegnali a una fascia dal menù dentro ogni scheda, oppure toglili.
          </p>
          <ElencoObiettivi lista={lista} idLega={idLega} obiettivi={senzaFascia} idFascia={null} />
        </section>
      )}

      {selettore && (
        <SelettoreCalciatore
          titolo={`Aggiungi a «${selettore.nome}»`}
          soloRuolo={selettore.ruolo}
          giaPresenti={giaNelReparto(selettore.ruolo)}
          inCorso={aggiungiA.isPending}
          onChiudi={() => setSelettore(null)}
          onConferma={(idCalciatori) =>
            aggiungiA.mutate(
              { idFascia: selettore.fascia, idCalciatori },
              { onSettled: () => setSelettore(null) },
            )
          }
        />
      )}
    </>
  )
}

function Fascia({
  fascia,
  posizione,
  quante,
  lista,
  idLega,
  onAggiungi,
}: {
  fascia: FasciaTipo
  posizione: number
  quante: number
  lista: ListaObiettivi
  idLega: string | undefined
  onAggiungi: () => void
}) {
  const aggiornaFascia = useAggiornaFascia(idLega)
  const togliFascia = useTogliFascia(idLega)

  const dentro = lista.targets.filter((x) => x.tier_id === fascia.id)
  const sorelle = lista.tiers
    .filter((f) => f.role === fascia.role)
    .sort((a, b) => a.position - b.position)

  function sposta(direzione: -1 | 1) {
    const altro = posizione + direzione
    if (altro < 0 || altro >= sorelle.length) return
    aggiornaFascia.mutate({ id: sorelle[posizione].id, campi: { position: sorelle[altro].position } })
    aggiornaFascia.mutate({ id: sorelle[altro].id, campi: { position: sorelle[posizione].position } })
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`rounded-xl border bg-verde-notte p-3 ${COLORI_FASCIA[fascia.color].bordo}`}
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
          className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold text-nebbia outline-none hover:border-verde-acceso/30 focus:border-verde-acceso"
        />
        <span className="cifre-fisse shrink-0 text-xs text-fumo">{dentro.length}</span>
        <button
          type="button"
          onClick={() => sposta(-1)}
          disabled={posizione === 0}
          aria-label={`Sposta la fascia ${fascia.name} più in alto`}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-nebbia disabled:opacity-25"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => sposta(1)}
          disabled={posizione === quante - 1}
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
          className="h-10 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-xs text-nebbia outline-none"
        >
          {Object.entries(COLORI_FASCIA).map(([chiave, c]) => (
            <option key={chiave} value={chiave}>
              {c.nome}
            </option>
          ))}
        </select>

        <Bottone aspetto="secondario" onClick={onAggiungi}>
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
        <ElencoObiettivi
          lista={lista}
          idLega={idLega}
          obiettivi={dentro}
          idFascia={fascia.id}
          fasceDelReparto={sorelle}
        />
      </div>
    </motion.div>
  )
}

/** I calciatori di un contenitore, in ordine, riordinabili trascinando. */
function ElencoObiettivi({
  lista,
  idLega,
  obiettivi,
  idFascia,
  fasceDelReparto,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  obiettivi: Obiettivo[]
  idFascia: string | null
  fasceDelReparto?: FasciaTipo[]
}) {
  const aggiorna = useAggiornaObiettivo(idLega)
  const togli = useTogliObiettivo(idLega)
  const riordina = useRiordinaObiettivi(idLega)

  const righe = useMemo(
    () =>
      [...obiettivi].sort(
        (a, b) => a.priority - b.priority || a.players.name.localeCompare(b.players.name, 'it'),
      ),
    [obiettivi],
  )

  if (righe.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-verde-campo px-3 py-2 text-xs text-fumo">
        Ancora nessun calciatore qui dentro.
      </p>
    )
  }

  return (
    <ListaRiordinabile
      elementi={righe}
      chiave={(o) => o.id}
      descrizione={(o) => o.players.name}
      onRiordina={(nuovo) =>
        riordina.mutate(nuovo.map((o, i) => ({ id: o.id, priorita: i, fascia: idFascia })))
      }
      rendi={(o) => (
        <SchedaObiettivo
          obiettivo={o}
          // Solo le fasce dello stesso reparto: spostare un attaccante fra i
          // difensori non è una cosa che si possa fare.
          fasce={fasceDelReparto ?? lista.tiers.filter((f) => f.role === o.players.role)}
          mostraFascia={lista.metodo === 'fasce'}
          mostraTetto={lista.usa_tetti}
          onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
          onTogli={() => togli.mutate(o.id)}
        />
      )}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Metodo degli slot
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// Metodo degli slot
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gli slot sono i posti della rosa, e sono **quelli del regolamento**: tanti
 * portieri quanti ne prevede la lega, tanti difensori, e così via. Non se ne
 * aggiungono e non se ne tolgono, perché una rosa non funziona così.
 *
 * Di ogni posto decidi due cose: **come si chiama**, per ricordarti che ruolo
 * ha nella tua idea di squadra, e **quanto sei disposto a spendere per
 * riempirlo**. Il massimale è uno per posto, non uno per nome: i candidati
 * dentro uno slot valgono la stessa cosa, ed è esattamente il motivo per cui
 * li hai messi insieme.
 */
function SezioneSlot({
  lista,
  idLega,
  ruoloScelto,
  comprati,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  ruoloScelto: Ruolo | null
  /** Chi ha già una rosa: non si propone più a nessuno. */
  comprati: Set<number>
}) {
  const aggiungiA = useAggiungiASlot(idLega)
  const [selettore, setSelettore] = useState<{ slot: string; ruolo: Ruolo; nome: string } | null>(null)

  const perObiettivo = new Map(lista.targets.map((t) => [t.id, t]))
  const inQualcheSlot = new Set(
    lista.roster_slots.flatMap((s) => s.slot_candidates.map((c) => c.target_id)),
  )
  const orfani = lista.targets.filter(
    (t) => !inQualcheSlot.has(t.id) && (!ruoloScelto || t.players.role === ruoloScelto),
  )

  /** Chi è già candidato in quello slot, più chiunque sia già stato comprato. */
  function giaInSlot(idSlot: string): Set<number> {
    const s = lista.roster_slots.find((x) => x.id === idSlot)
    return new Set([
      ...(s?.slot_candidates ?? [])
        .map((c) => perObiettivo.get(c.target_id)?.player_id)
        .filter((n): n is number => typeof n === 'number'),
      ...comprati,
    ])
  }

  // Gli slot li allinea il server a ogni apertura della lista. Se qui non ce
  // ne sono, non è una schermata da riempire: è qualcosa che non ha
  // funzionato, e si dice invece di far finta di niente.
  if (lista.roster_slots.length === 0) {
    return (
      <section className="rounded-2xl border border-oro/40 bg-oro/10 p-5">
        <p className="text-base font-bold text-nebbia">Non trovo i posti della tua rosa</p>
        <p className="mt-2 text-sm text-fumo">
          Dovrebbero esserci tanti slot quanti ne prevede il regolamento della lega, e li crea il
          server da solo. Ricarica la pagina: se restano zero, è un problema da segnalare.
        </p>
      </section>
    )
  }

  return (
    <>
      {(ruoloScelto ? [ruoloScelto] : ORDINE_RUOLI).map((ruolo) => {
        const slot = lista.roster_slots
          .filter((s) => s.role === ruolo)
          .sort((a, b) => a.position - b.position)
        if (slot.length === 0) return null

        const coperti = slotCoperti(slot)

        return (
          <section key={ruolo} className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${CLASSE_RUOLO[ruolo]}`}
              >
                {ruolo}
              </span>
              <h2 className="text-base font-bold text-nebbia">{NOME_RUOLO[ruolo]}</h2>
              <span className="cifre-fisse ml-auto text-xs text-fumo">
                {coperti} posti coperti su {slot.length}
              </span>
            </div>
            <p className="mb-3 text-xs text-fumo">
              Sono i {slot.length} posti previsti dal regolamento della lega. Il nome lo cambi tu, la
              quantità no.
            </p>

            <div className="flex flex-col gap-3">
              {slot.map((s) => (
                <Slot
                  key={s.id}
                  slot={s}
                  lista={lista}
                  idLega={idLega}
                  candidati={[...s.slot_candidates]
                    .sort((a, b) => a.position - b.position)
                    .map((c) => perObiettivo.get(c.target_id))
                    .filter((o): o is Obiettivo => Boolean(o))}
                  onAggiungi={() => setSelettore({ slot: s.id, ruolo, nome: s.label })}
                />
              ))}
            </div>
          </section>
        )
      })}

      {orfani.length > 0 && <FuoriDagliSlot lista={lista} idLega={idLega} orfani={orfani} />}

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

/** Un posto della rosa: il suo nome, il suo massimale, i suoi candidati. */
function Slot({
  slot,
  lista,
  idLega,
  candidati,
  onAggiungi,
}: {
  slot: SlotRosa
  lista: ListaObiettivi
  idLega: string | undefined
  candidati: Obiettivo[]
  onAggiungi: () => void
}) {
  const aggiornaSlot = useAggiornaSlot(idLega)
  const aggiorna = useAggiornaObiettivo(idLega)
  const togliDaSlot = useTogliDaSlot(idLega)
  const riordina = useRiordinaCandidati(idLega)

  const [tetto, setTetto] = useState(slot.max_price?.toString() ?? '')
  useEffect(() => setTetto(slot.max_price?.toString() ?? ''), [slot.max_price])

  function salvaTetto() {
    const pulito = tetto.trim()
    if (pulito === '') {
      if (slot.max_price != null) aggiornaSlot.mutate({ id: slot.id, campi: { max_price: null } })
      return
    }
    const n = Math.round(Number(pulito.replace(',', '.')))
    if (!Number.isFinite(n) || n < 1) {
      // Un numero che non si capisce non si salva a caso: si torna a quello
      // che c'era, così si vede subito che non è stato preso.
      setTetto(slot.max_price?.toString() ?? '')
      return
    }
    if (n !== slot.max_price) aggiornaSlot.mutate({ id: slot.id, campi: { max_price: n } })
  }

  const vuoto = candidati.length === 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={[
        'rounded-xl border bg-verde-notte p-3',
        vuoto ? 'border-dashed border-fumo/40' : 'border-verde-campo',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="cifre-fisse flex size-7 shrink-0 items-center justify-center rounded-lg bg-verde-campo text-xs font-bold text-fumo"
        >
          {slot.position + 1}
        </span>
        <input
          defaultValue={slot.label}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== slot.label) aggiornaSlot.mutate({ id: slot.id, campi: { label: v } })
            else e.target.value = slot.label
          }}
          aria-label={`Nome del posto numero ${slot.position + 1}`}
          className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-bold text-nebbia outline-none hover:border-verde-acceso/30 focus:border-verde-acceso"
        />
        <span className="cifre-fisse shrink-0 text-xs text-fumo">
          {candidati.length === 0 ? 'vuoto' : `${candidati.length} candidati`}
        </span>
      </div>

      {/* Il massimale del posto. Uno solo, valido per chiunque lo riempia. */}
      {lista.usa_tetti && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-verde-campo/50 px-3 py-2">
          <label htmlFor={`tetto-${slot.id}`} className="text-xs text-fumo">
            Fino a
          </label>
          <input
            id={`tetto-${slot.id}`}
            value={tetto}
            onChange={(e) => setTetto(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
            onBlur={salvaTetto}
            inputMode="numeric"
            placeholder="—"
            className="cifre-fisse h-9 w-20 rounded-lg border border-verde-acceso/30 bg-verde-notte px-2 text-center text-sm font-bold text-oro outline-none placeholder:text-fumo/50 focus:border-verde-acceso"
          />
          <span className="text-xs text-fumo">crediti, per chiunque di loro</span>
        </div>
      )}

      {candidati.length > 0 ? (
        <div className="mt-3">
          <ListaRiordinabile
            elementi={candidati}
            chiave={(o) => o.id}
            descrizione={(o) => o.players.name}
            onRiordina={(nuovo) =>
              riordina.mutate({ idSlot: slot.id, ordine: nuovo.map((o) => o.id) })
            }
            rendi={(o) => (
              <SchedaObiettivo
                obiettivo={o}
                fasce={[]}
                mostraFascia={false}
                // Il tetto di questo metodo sta sullo slot, non sul nome:
                // ripeterlo qui sarebbe la stessa cifra scritta cinque volte.
                mostraTetto={false}
                onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
                onTogli={() => togliDaSlot.mutate({ idSlot: slot.id, idObiettivo: o.id })}
              />
            )}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-fumo">
          Nessun candidato per questo posto: all&apos;asta non sapresti chi chiamare.
        </p>
      )}

      <div className="mt-3">
        <Bottone aspetto="secondario" onClick={onAggiungi}>
          Aggiungi candidati
        </Bottone>
      </div>
    </motion.div>
  )
}

/**
 * I calciatori che stanno nella lista ma in nessuno slot.
 *
 * Con il metodo degli slot non se ne creano di nuovi: restano da quando si
 * usavano le fasce. Si mostrano lo stesso, altrimenti sparirebbero senza che
 * nessuno l'abbia deciso.
 */
function FuoriDagliSlot({
  lista,
  idLega,
  orfani,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  orfani: Obiettivo[]
}) {
  const aggiorna = useAggiornaObiettivo(idLega)
  const togli = useTogliObiettivo(idLega)

  return (
    <section className="rounded-2xl border border-dashed border-fumo/40 bg-verde-campo/20 p-4">
      <h3 className="text-base font-bold text-fumo">Fuori dagli slot</h3>
      <p className="mt-0.5 mb-3 text-xs text-fumo">
        Sono nella tua lista ma non occupano nessun posto: ti restano dal metodo delle fasce.
        Mettili fra i candidati di uno slot, oppure toglili.
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
            .map((mm) => perObiettivo.get(mm.target_id))
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
                      className="rounded-full bg-oro/15 px-3 py-1.5 text-sm text-nebbia"
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
