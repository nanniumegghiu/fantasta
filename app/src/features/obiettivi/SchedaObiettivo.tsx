import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { CLASSE_RUOLO, COLORI_FASCIA, type Fascia, type Obiettivo } from './tipi'

type Props = {
  obiettivo: Obiettivo
  fasce: Fascia[]
  mostraFascia: boolean
  mostraTetto: boolean
  onAggiorna: (campi: { tier_id?: string | null; max_price?: number | null; note?: string | null }) => void
  onTogli: () => void
}

/**
 * Un obiettivo, con tutto quello che il proprietario ci ha attaccato.
 *
 * Tetto e nota si salvano quando il campo perde il fuoco, non a ogni lettera:
 * scrivere «non oltre 90» genererebbe quindici scritture inutili, e su una
 * connessione ballerina si vedrebbe.
 */
export function SchedaObiettivo({
  obiettivo,
  fasce,
  mostraFascia,
  mostraTetto,
  onAggiorna,
  onTogli,
}: Props) {
  const c = obiettivo.players
  const [tetto, setTetto] = useState(obiettivo.max_price?.toString() ?? '')
  const [nota, setNota] = useState(obiettivo.note ?? '')
  const [apertaNota, setApertaNota] = useState(Boolean(obiettivo.note))

  // Se il dato cambia altrove, il campo si riallinea.
  useEffect(() => setTetto(obiettivo.max_price?.toString() ?? ''), [obiettivo.max_price])
  useEffect(() => setNota(obiettivo.note ?? ''), [obiettivo.note])

  const fascia = fasce.find((f) => f.id === obiettivo.tier_id)

  function salvaTetto() {
    const pulito = tetto.trim()
    const n = pulito === '' ? null : Math.max(0, Math.round(Number(pulito.replace(',', '.'))))
    if (pulito !== '' && !Number.isFinite(n as number)) {
      setTetto(obiettivo.max_price?.toString() ?? '')
      return
    }
    if (n !== obiettivo.max_price) onAggiorna({ max_price: n })
  }

  function salvaNota() {
    const pulita = nota.trim() === '' ? null : nota.trim()
    if (pulita !== obiettivo.note) onAggiorna({ note: pulita })
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={[
        'rounded-2xl border bg-verde-campo/30 p-3',
        fascia ? COLORI_FASCIA[fascia.color].bordo : 'border-verde-campo',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CLASSE_RUOLO[c.role]}`}
        >
          {c.role}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-nebbia">{c.name}</p>
          <p className="cifre-fisse truncate text-xs text-fumo">
            {c.serie_a_team} · quotazione {c.quotation}
          </p>
        </div>

        <button
          type="button"
          onClick={onTogli}
          aria-label={`Togli ${c.name} dagli obiettivi`}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-fumo hover:bg-errore/15 hover:text-errore"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-5">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mostraTetto && (
          <label className="flex items-center gap-2">
            <span className="text-xs text-fumo">Tetto</span>
            <input
              value={tetto}
              onChange={(e) => setTetto(e.target.value.replace(/[^\d]/g, ''))}
              onBlur={salvaTetto}
              inputMode="numeric"
              placeholder="—"
              aria-label={`Tetto di spesa per ${c.name}`}
              className="cifre-fisse h-11 w-20 rounded-xl border border-verde-acceso/30 bg-verde-notte text-center text-sm font-bold text-oro outline-none focus:border-verde-acceso"
            />
          </label>
        )}

        {mostraFascia && (
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Fascia di {c.name}</span>
            <select
              value={obiettivo.tier_id ?? ''}
              onChange={(e) => onAggiorna({ tier_id: e.target.value || null })}
              className="h-11 min-w-0 flex-1 rounded-xl border border-verde-acceso/30 bg-verde-notte px-2 text-sm text-nebbia outline-none focus:border-verde-acceso"
            >
              <option value="">Senza fascia</option>
              {fasce.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={() => setApertaNota((v) => !v)}
          className="h-11 shrink-0 rounded-xl px-3 text-xs font-semibold text-fumo hover:text-nebbia"
        >
          {obiettivo.note ? 'Nota ✓' : 'Nota'}
        </button>
      </div>

      {apertaNota && (
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value.slice(0, 500))}
          onBlur={salvaNota}
          rows={2}
          placeholder="Cosa devi ricordarti su di lui durante l'asta"
          aria-label={`Nota su ${c.name}`}
          className="mt-2 w-full rounded-xl border border-verde-acceso/30 bg-verde-notte p-3 text-sm text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
        />
      )}
    </motion.li>
  )
}
