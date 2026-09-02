import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { useListone } from '@/features/listone/api'
import type { Ruolo } from '@/domain/listone'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from './tipi'

type Props = {
  /** Calciatori già nella lista: non si ripropongono. */
  giaPresenti: Set<number>
  /** Se indicato, mostra solo quel ruolo. Serve agli incroci fra portieri. */
  soloRuolo?: Ruolo
  titolo: string
  onChiudi: () => void
  onConferma: (idCalciatori: number[]) => void
  inCorso?: boolean
}

/**
 * Scelta dei calciatori da aggiungere alla lista.
 *
 * Si sceglie a più riprese e si conferma una volta sola: durante la
 * preparazione si aggiungono dieci nomi di fila, e dieci conferme separate
 * sarebbero dieci attese.
 */
export function SelettoreCalciatore({
  giaPresenti,
  soloRuolo,
  titolo,
  onChiudi,
  onConferma,
  inCorso,
}: Props) {
  const { data: listone, isPending } = useListone()
  const [cerca, setCerca] = useState('')
  const [ruolo, setRuolo] = useState<Ruolo | null>(soloRuolo ?? null)
  const [scelti, setScelti] = useState<Set<number>>(new Set())

  const risultati = useMemo(() => {
    let v = (listone ?? []).filter((c) => !giaPresenti.has(c.id))
    if (soloRuolo) v = v.filter((c) => c.role === soloRuolo)
    else if (ruolo) v = v.filter((c) => c.role === ruolo)
    if (cerca.trim()) {
      const q = cerca.trim().toLowerCase()
      v = v.filter(
        (c) => c.name.toLowerCase().includes(q) || c.serie_a_team.toLowerCase().includes(q),
      )
    }
    return v.slice(0, 80)
  }, [listone, giaPresenti, soloRuolo, ruolo, cerca])

  function commuta(id: number) {
    setScelti((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-carbone/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onChiudi}
        className="flex-1 cursor-default"
      />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-verde-acceso/30 bg-verde-notte"
      >
        <div className="flex items-center gap-3 border-b border-verde-campo px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-nebbia">{titolo}</h2>
          <Bottone aspetto="fantasma" onClick={onChiudi}>
            Chiudi
          </Bottone>
        </div>

        <div className="px-4 pt-3">
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca per nome o squadra"
            aria-label="Cerca un calciatore"
            autoFocus
            className="h-12 w-full rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-4 text-[16px] text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
          />

          {!soloRuolo && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <Filtro attivo={ruolo === null} onClick={() => setRuolo(null)}>
                Tutti
              </Filtro>
              {ORDINE_RUOLI.map((r) => (
                <Filtro key={r} attivo={ruolo === r} onClick={() => setRuolo(r)}>
                  {NOME_RUOLO[r]}
                </Filtro>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-2">
          {isPending && <p className="py-6 text-center text-sm text-fumo">Carico il listone…</p>}

          {!isPending && (listone ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-oro">
              Il listone non è ancora stato caricato: senza, non c&apos;è niente da scegliere.
            </p>
          )}

          {!isPending && (listone ?? []).length > 0 && risultati.length === 0 && (
            <p className="py-6 text-center text-sm text-fumo">Nessun calciatore con questi filtri.</p>
          )}

          <ul className="flex flex-col">
            {risultati.map((c) => {
              const preso = scelti.has(c.id)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => commuta(c.id)}
                    aria-pressed={preso}
                    className={[
                      'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
                      preso ? 'bg-verde-acceso/15' : 'hover:bg-verde-campo/50',
                    ].join(' ')}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${CLASSE_RUOLO[c.role]}`}
                    >
                      {c.role}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-nebbia">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-fumo">{c.serie_a_team}</span>
                    </span>
                    <span className="cifre-fisse shrink-0 text-sm font-bold text-oro">
                      {c.quotation}
                    </span>
                    <span
                      aria-hidden
                      className={[
                        'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs',
                        preso
                          ? 'border-verde-acceso bg-verde-acceso text-carbone'
                          : 'border-fumo/40 text-transparent',
                      ].join(' ')}
                    >
                      ✓
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-verde-campo px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Bottone
            misura="grande"
            larghezzaPiena
            disabilitato={scelti.size === 0}
            inCorso={inCorso}
            onClick={() => onConferma([...scelti])}
          >
            {scelti.size === 0
              ? 'Scegli almeno un calciatore'
              : `Aggiungi ${scelti.size} ${scelti.size === 1 ? 'calciatore' : 'calciatori'}`}
          </Bottone>
        </div>
      </motion.div>
    </div>
  )
}

function Filtro({
  attivo,
  onClick,
  children,
}: {
  attivo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
        attivo ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
