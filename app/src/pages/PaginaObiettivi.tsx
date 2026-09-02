import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Intestazione } from '@/components/Intestazione'
import { Interruttore } from '@/components/Interruttore'
import { useLega } from '@/features/leghe/api'
import { totaleSlot } from '@/features/leghe/tipi'
import {
  useAggiornaFascia,
  useAggiornaIncrocio,
  useAggiornaObiettivo,
  useAggiornaSlot,
  useAggiungiCandidato,
  useAggiungiFascia,
  useAggiungiIncrocio,
  useAggiungiMembroIncrocio,
  useAggiungiObiettivi,
  useAggiungiSlot,
  useImpostaMetodi,
  useListaObiettivi,
  useTogliCandidato,
  useTogliFascia,
  useTogliIncrocio,
  useTogliMembroIncrocio,
  useTogliObiettivo,
  useTogliSlot,
} from '@/features/obiettivi/api'
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
} from '@/features/obiettivi/tipi'
import type { Ruolo } from '@/domain/listone'

export function PaginaObiettivi() {
  const { id: idLega } = useParams()
  const { data: lega } = useLega(idLega)
  const { data: lista, isPending, error } = useListaObiettivi(idLega)

  const [selettoreAperto, setSelettoreAperto] = useState<{ fascia?: string | null } | null>(null)
  const aggiungi = useAggiungiObiettivi(idLega)

  if (isPending) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="I miei obiettivi" indietroA={`/lega/${idLega}`} />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
        </div>
      </div>
    )
  }

  if (error || !lista) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="I miei obiettivi" indietroA={`/lega/${idLega}`} />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p role="alert" className="rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm text-errore">
            {error ? error.message : 'Non riesco a caricare la tua lista.'}
          </p>
        </div>
      </div>
    )
  }

  const giaPresenti = new Set(lista.targets.map((t) => t.player_id))

  return (
    <div className="min-h-dvh">
      <Intestazione
        titolo="I miei obiettivi"
        sottotitolo={lega?.name}
        indietroA={`/lega/${idLega}`}
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 pb-28">
        <Riservatezza />
        <Riepilogo lista={lista} creditiLega={lega?.credits_initial} rosa={lega ? totaleSlot(lega) : undefined} />
        <Metodi lista={lista} idLega={idLega} />

        <SezioneObiettivi
          lista={lista}
          idLega={idLega}
          onAggiungi={(fascia) => setSelettoreAperto({ fascia })}
        />

        {lista.usa_fasce && <SezioneFasce lista={lista} idLega={idLega} />}
        {lista.usa_slot && <SezioneSlot lista={lista} idLega={idLega} />}
        {lista.usa_incroci && <SezioneIncroci lista={lista} idLega={idLega} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-verde-campo bg-verde-notte/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Bottone misura="grande" larghezzaPiena onClick={() => setSelettoreAperto({})}>
            Aggiungi calciatori
          </Bottone>
        </div>
      </div>

      {selettoreAperto && (
        <SelettoreCalciatore
          titolo="Aggiungi agli obiettivi"
          giaPresenti={giaPresenti}
          inCorso={aggiungi.isPending}
          onChiudi={() => setSelettoreAperto(null)}
          onConferma={(idCalciatori) => {
            aggiungi.mutate(
              { idLista: lista.id, idCalciatori, idFascia: selettoreAperto.fascia ?? null },
              { onSettled: () => setSelettoreAperto(null) },
            )
          }}
        />
      )}
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
              gli obiettivi sono più di quelli che comprerai. Serve solo a saperlo.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Metodi ─────────────────────────────────────────────────────────────────

function Metodi({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const imposta = useImpostaMetodi(idLega)
  const [aperto, setAperto] = useState(false)

  const voci = [
    {
      campo: 'usa_fasce' as const,
      etichetta: 'Fasce',
      descrizione: 'Raggruppa per valore equivalente: se ti rubano un obiettivo, sai chi pescare.',
      acceso: lista.usa_fasce,
    },
    {
      campo: 'usa_tetti' as const,
      etichetta: 'Tetto di spesa',
      descrizione: 'Il prezzo massimo che ti imponi, per non farti prendere dai rilanci.',
      acceso: lista.usa_tetti,
    },
    {
      campo: 'usa_slot' as const,
      etichetta: 'Slot della rosa ideale',
      descrizione: 'Caselle gerarchiche da riempire, con i candidati per ognuna.',
      acceso: lista.usa_slot,
    },
    {
      campo: 'usa_incroci' as const,
      etichetta: 'Incrocio portieri',
      descrizione: 'Coppie di portieri con i calendari che si alternano.',
      acceso: lista.usa_incroci,
    },
  ]

  const attivi = voci.filter((v) => v.acceso).map((v) => v.etichetta)

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <button
        type="button"
        onClick={() => setAperto((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-nebbia">Il tuo metodo</h2>
          <p className="mt-0.5 truncate text-xs text-fumo">
            {attivi.length > 0 ? attivi.join(' · ') : 'Nessun metodo attivo'}
          </p>
        </div>
        <span aria-hidden className="text-fumo">
          {aperto ? '▲' : '▼'}
        </span>
      </button>

      {aperto && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-xs text-fumo">
            Accendi solo quelli che usi davvero. Si combinano come vuoi e si cambiano quando vuoi:
            spegnere un metodo non cancella niente, nasconde soltanto.
          </p>
          {voci.map((v) => (
            <Interruttore
              key={v.campo}
              etichetta={v.etichetta}
              descrizione={v.descrizione}
              acceso={v.acceso}
              onChange={(acceso) => imposta.mutate({ idLista: lista.id, campo: v.campo, acceso })}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Gli obiettivi ──────────────────────────────────────────────────────────

function SezioneObiettivi({
  lista,
  idLega,
  onAggiungi,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  onAggiungi: (idFascia?: string | null) => void
}) {
  const aggiorna = useAggiornaObiettivo(idLega)
  const togli = useTogliObiettivo(idLega)
  const [filtroRuolo, setFiltroRuolo] = useState<Ruolo | null>(null)

  const visibili = useMemo(
    () => (filtroRuolo ? lista.targets.filter((t) => t.players.role === filtroRuolo) : lista.targets),
    [lista.targets, filtroRuolo],
  )

  const gruppi = useMemo(() => {
    if (lista.usa_fasce) {
      const ordinate = [...lista.tiers].sort((a, b) => a.position - b.position)
      const per = ordinate.map((f) => ({
        chiave: f.id,
        titolo: f.name,
        colore: f.color,
        obiettivi: visibili.filter((t) => t.tier_id === f.id),
      }))
      const senza = visibili.filter((t) => !t.tier_id)
      if (senza.length > 0) {
        per.push({ chiave: 'senza', titolo: 'Senza fascia', colore: 'fumo', obiettivi: senza })
      }
      return per
    }
    return ORDINE_RUOLI.map((r) => ({
      chiave: r,
      titolo: NOME_RUOLO[r],
      colore: null,
      obiettivi: visibili.filter((t) => t.players.role === r),
    })).filter((g) => g.obiettivi.length > 0)
  }, [lista.usa_fasce, lista.tiers, visibili])

  if (lista.targets.length === 0) {
    return (
      <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-6 text-center">
        <p className="text-sm font-semibold text-nebbia">La tua lista è vuota</p>
        <p className="mx-auto mt-2 max-w-sm text-xs text-fumo">
          Aggiungi i calciatori che vuoi puntare. Per ognuno potrai segnare quanto sei disposto a
          spendere e cosa devi ricordarti durante l&apos;asta.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <PillolaRuolo attiva={filtroRuolo === null} onClick={() => setFiltroRuolo(null)}>
          Tutti
        </PillolaRuolo>
        {ORDINE_RUOLI.map((r) => (
          <PillolaRuolo key={r} attiva={filtroRuolo === r} onClick={() => setFiltroRuolo(r)}>
            {NOME_RUOLO[r]}
          </PillolaRuolo>
        ))}
      </div>

      {gruppi.map((g) => (
        <div key={g.chiave}>
          <div className="mb-2 flex items-center gap-2">
            {g.colore && (
              <span
                aria-hidden
                className={`size-3 rounded-full ${COLORI_FASCIA[g.colore as ColoreFascia].punto}`}
              />
            )}
            <h3 className="text-sm font-bold text-nebbia">{g.titolo}</h3>
            <span className="cifre-fisse text-xs text-fumo">{g.obiettivi.length}</span>
            {lista.usa_fasce && g.chiave !== 'senza' && (
              <button
                type="button"
                onClick={() => onAggiungi(g.chiave)}
                className="ml-auto text-xs font-semibold text-oro underline underline-offset-4"
              >
                aggiungi qui
              </button>
            )}
          </div>

          {g.obiettivi.length === 0 ? (
            <p className="rounded-xl border border-dashed border-verde-campo px-4 py-3 text-xs text-fumo">
              Ancora nessun calciatore in questa fascia.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {g.obiettivi.map((o) => (
                <SchedaObiettivo
                  key={o.id}
                  obiettivo={o}
                  fasce={lista.tiers}
                  mostraFascia={lista.usa_fasce}
                  mostraTetto={lista.usa_tetti}
                  onAggiorna={(campi) => aggiorna.mutate({ id: o.id, campi })}
                  onTogli={() => togli.mutate(o.id)}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
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

// ─── Fasce ──────────────────────────────────────────────────────────────────

function SezioneFasce({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungi = useAggiungiFascia(idLega)
  const aggiorna = useAggiornaFascia(idLega)
  const togli = useTogliFascia(idLega)
  const [nuova, setNuova] = useState('')

  const ordinate = [...lista.tiers].sort((a, b) => a.position - b.position)

  function sposta(indice: number, direzione: -1 | 1) {
    const altro = indice + direzione
    if (altro < 0 || altro >= ordinate.length) return
    aggiorna.mutate({ id: ordinate[indice].id, campi: { position: ordinate[altro].position } })
    aggiorna.mutate({ id: ordinate[altro].id, campi: { position: ordinate[indice].position } })
  }

  return (
    <Sezione
      titolo="Le fasce"
      sottotitolo="Gruppi di valore equivalente. Se ti rubano un obiettivo, peschi dallo stesso livello."
    >
      <ul className="flex flex-col gap-2">
        {ordinate.map((f, i) => {
          const quanti = lista.targets.filter((t) => t.tier_id === f.id).length
          return (
            <li
              key={f.id}
              className={`flex items-center gap-2 rounded-xl border bg-verde-notte p-2 ${COLORI_FASCIA[f.color].bordo}`}
            >
              <select
                value={f.color}
                onChange={(e) => aggiorna.mutate({ id: f.id, campi: { color: e.target.value as ColoreFascia } })}
                aria-label={`Colore della fascia ${f.name}`}
                className="h-11 w-24 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-xs text-nebbia outline-none"
              >
                {Object.entries(COLORI_FASCIA).map(([chiave, c]) => (
                  <option key={chiave} value={chiave}>
                    {c.nome}
                  </option>
                ))}
              </select>

              <input
                defaultValue={f.name}
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v && v !== f.name) aggiorna.mutate({ id: f.id, campi: { name: v } })
                }}
                aria-label="Nome della fascia"
                className="h-11 min-w-0 flex-1 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm text-nebbia outline-none focus:border-verde-acceso"
              />

              <span className="cifre-fisse w-6 shrink-0 text-center text-xs text-fumo">{quanti}</span>

              <button
                type="button"
                onClick={() => sposta(i, -1)}
                disabled={i === 0}
                aria-label="Sposta la fascia più in alto"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-nebbia disabled:opacity-30"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => sposta(i, 1)}
                disabled={i === ordinate.length - 1}
                aria-label="Sposta la fascia più in basso"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-nebbia disabled:opacity-30"
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => togli.mutate(f.id)}
                aria-label={`Elimina la fascia ${f.name}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-xs text-fumo">
        Eliminare una fascia non cancella i calciatori: restano nella lista, senza fascia.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={nuova}
          onChange={(e) => setNuova(e.target.value)}
          placeholder="Nome della nuova fascia"
          className="h-11 min-w-0 flex-1 rounded-xl border border-verde-acceso/30 bg-verde-notte px-3 text-sm text-nebbia outline-none focus:border-verde-acceso"
        />
        <Bottone
          aspetto="secondario"
          disabilitato={nuova.trim().length === 0}
          onClick={() => {
            aggiungi.mutate({
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
    </Sezione>
  )
}

// ─── Slot ───────────────────────────────────────────────────────────────────

function SezioneSlot({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungi = useAggiungiSlot(idLega)
  const aggiorna = useAggiornaSlot(idLega)
  const togli = useTogliSlot(idLega)
  const aggiungiCandidato = useAggiungiCandidato(idLega)
  const togliCandidato = useTogliCandidato(idLega)

  const perObiettivo = new Map(lista.targets.map((t) => [t.id, t]))

  return (
    <Sezione
      titolo="Gli slot della rosa ideale"
      sottotitolo="Una casella per ogni posto da riempire, con i candidati in ordine di preferenza."
    >
      {ORDINE_RUOLI.map((ruolo) => {
        const slot = lista.roster_slots
          .filter((s) => s.role === ruolo)
          .sort((a, b) => a.position - b.position)
        const obiettiviDelRuolo = lista.targets.filter((t) => t.players.role === ruolo)

        return (
          <div key={ruolo} className="mb-4 last:mb-0">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${CLASSE_RUOLO[ruolo]}`}
              >
                {ruolo}
              </span>
              <h3 className="text-sm font-bold text-nebbia">{NOME_RUOLO[ruolo]}</h3>
              <button
                type="button"
                onClick={() =>
                  aggiungi.mutate({
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

            {slot.length === 0 ? (
              <p className="rounded-xl border border-dashed border-verde-campo px-4 py-3 text-xs text-fumo">
                Nessuno slot per questo reparto.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {slot.map((s) => {
                  const candidati = [...s.slot_candidates].sort((a, b) => a.position - b.position)
                  const liberi = obiettiviDelRuolo.filter(
                    (t) => !candidati.some((c) => c.target_id === t.id),
                  )
                  return (
                    <li key={s.id} className="rounded-xl border border-verde-campo bg-verde-notte p-3">
                      <div className="flex items-center gap-2">
                        <input
                          defaultValue={s.label}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== s.label) aggiorna.mutate({ id: s.id, campi: { label: v } })
                          }}
                          aria-label="Nome dello slot"
                          className="h-11 min-w-0 flex-1 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm font-semibold text-nebbia outline-none focus:border-verde-acceso"
                        />
                        <button
                          type="button"
                          onClick={() => togli.mutate(s.id)}
                          aria-label={`Elimina lo slot ${s.label}`}
                          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
                        >
                          ✕
                        </button>
                      </div>

                      <ul className="mt-2 flex flex-col gap-1">
                        {candidati.map((c, i) => {
                          const o = perObiettivo.get(c.target_id)
                          if (!o) return null
                          return (
                            <li key={c.target_id} className="flex items-center gap-2 text-sm">
                              <span className="cifre-fisse w-5 text-xs text-fumo">{i + 1}.</span>
                              <span className="min-w-0 flex-1 truncate text-nebbia">
                                {o.players.name}
                                <span className="text-fumo"> · {o.players.serie_a_team}</span>
                              </span>
                              {lista.usa_tetti && o.max_price != null && (
                                <span className="cifre-fisse shrink-0 text-xs text-oro">
                                  max {o.max_price}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  togliCandidato.mutate({ idSlot: s.id, idObiettivo: c.target_id })
                                }
                                aria-label={`Togli ${o.players.name} da ${s.label}`}
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fumo hover:text-errore"
                              >
                                ✕
                              </button>
                            </li>
                          )
                        })}
                      </ul>

                      {liberi.length > 0 ? (
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return
                            aggiungiCandidato.mutate({
                              idSlot: s.id,
                              idObiettivo: e.target.value,
                              posizione: candidati.length,
                            })
                          }}
                          aria-label={`Aggiungi un candidato a ${s.label}`}
                          className="mt-2 h-11 w-full rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-sm text-nebbia outline-none"
                        >
                          <option value="">Aggiungi un candidato…</option>
                          {liberi.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.players.name} · {t.players.serie_a_team}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-2 text-xs text-fumo">
                          Tutti i tuoi obiettivi di questo reparto sono già qui dentro.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </Sezione>
  )
}

// ─── Incroci portieri ───────────────────────────────────────────────────────

function SezioneIncroci({ lista, idLega }: { lista: ListaObiettivi; idLega: string | undefined }) {
  const aggiungi = useAggiungiIncrocio(idLega)
  const aggiorna = useAggiornaIncrocio(idLega)
  const togli = useTogliIncrocio(idLega)
  const aggiungiMembro = useAggiungiMembroIncrocio(idLega)
  const togliMembro = useTogliMembroIncrocio(idLega)

  const portieri = lista.targets.filter((t) => t.players.role === 'P')
  const perObiettivo = new Map(lista.targets.map((t) => [t.id, t]))
  const gruppi = [...lista.goalkeeper_pairings].sort((a, b) => a.position - b.position)

  return (
    <Sezione
      titolo="L'incrocio dei portieri"
      sottotitolo="Due o tre portieri di media fascia con i calendari che si alternano."
    >
      {portieri.length === 0 && (
        <p className="rounded-xl border border-oro/30 bg-oro/10 px-4 py-3 text-xs text-oro">
          Prima aggiungi qualche portiere agli obiettivi: gli incroci si costruiscono con quelli.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {gruppi.map((g) => {
          const membri = [...g.pairing_members].sort((a, b) => a.position - b.position)
          const liberi = portieri.filter((p) => !membri.some((m) => m.target_id === p.id))
          return (
            <li key={g.id} className="rounded-xl border border-verde-campo bg-verde-notte p-3">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={g.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== g.name) aggiorna.mutate({ id: g.id, campi: { name: v } })
                  }}
                  aria-label="Nome dell'incrocio"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm font-semibold text-nebbia outline-none focus:border-verde-acceso"
                />
                <button
                  type="button"
                  onClick={() => togli.mutate(g.id)}
                  aria-label={`Elimina l'incrocio ${g.name}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
                >
                  ✕
                </button>
              </div>

              <ul className="mt-2 flex flex-wrap gap-2">
                {membri.map((m) => {
                  const o = perObiettivo.get(m.target_id)
                  if (!o) return null
                  return (
                    <li
                      key={m.target_id}
                      className="flex items-center gap-2 rounded-full bg-oro/15 py-1 pl-3 pr-1 text-sm text-nebbia"
                    >
                      <span className="truncate">
                        {o.players.name}
                        <span className="text-fumo"> · {o.players.serie_a_team}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => togliMembro.mutate({ idIncrocio: g.id, idObiettivo: m.target_id })}
                        aria-label={`Togli ${o.players.name} dall'incrocio`}
                        className="flex size-8 items-center justify-center rounded-full text-fumo hover:text-errore"
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>

              {liberi.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    aggiungiMembro.mutate({
                      idIncrocio: g.id,
                      idObiettivo: e.target.value,
                      posizione: membri.length,
                    })
                  }}
                  aria-label={`Aggiungi un portiere a ${g.name}`}
                  className="mt-2 h-11 w-full rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-sm text-nebbia outline-none"
                >
                  <option value="">Aggiungi un portiere…</option>
                  {liberi.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.players.name} · {p.players.serie_a_team}
                    </option>
                  ))}
                </select>
              )}

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
            </li>
          )
        })}
      </ul>

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
    </Sezione>
  )
}

// ─── Contenitore ────────────────────────────────────────────────────────────

function Sezione({
  titolo,
  sottotitolo,
  children,
}: {
  titolo: string
  sottotitolo: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4"
    >
      <h2 className="text-base font-bold text-nebbia">{titolo}</h2>
      <p className="mt-0.5 mb-3 text-xs text-fumo">{sottotitolo}</p>
      {children}
    </motion.section>
  )
}
