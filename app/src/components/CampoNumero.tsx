import { useId } from 'react'
import { motion } from 'motion/react'

type Props = {
  etichetta: string
  valore: number
  onChange: (v: number) => void
  minimo: number
  massimo: number
  passo?: number
  aiuto?: string
}

/**
 * Numero con due pulsanti grandi.
 *
 * Sul telefono la tastiera numerica copre mezzo schermo e obbliga a chiuderla
 * per vedere il risultato. Per valori che si aggiustano di poco, due pulsanti
 * da 44 pixel sono piu' rapidi e non sbagliano. Il campo resta comunque
 * scrivibile, perche' passare da 500 a 1000 a colpi di piu' sarebbe assurdo.
 */
export function CampoNumero({
  etichetta,
  valore,
  onChange,
  minimo,
  massimo,
  passo = 1,
  aiuto,
}: Props) {
  const id = useId()
  const limita = (v: number) => Math.min(massimo, Math.max(minimo, v))

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-nebbia">
        {etichetta}
      </label>

      <div className="flex items-center gap-2">
        <Passo
          segno="meno"
          onClick={() => onChange(limita(valore - passo))}
          disabilitato={valore <= minimo}
          etichetta={`Diminuisci ${etichetta}`}
        />

        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={valore}
          min={minimo}
          max={massimo}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(limita(Math.round(n)))
          }}
          className="cifre-fisse h-12 w-full min-w-0 rounded-xl border border-verde-acceso/30 bg-verde-campo/60 text-center text-[17px] font-bold text-nebbia outline-none focus:border-verde-acceso"
        />

        <Passo
          segno="piu"
          onClick={() => onChange(limita(valore + passo))}
          disabilitato={valore >= massimo}
          etichetta={`Aumenta ${etichetta}`}
        />
      </div>

      {aiuto && <p className="text-xs text-fumo">{aiuto}</p>}
    </div>
  )
}

function Passo({
  segno,
  onClick,
  disabilitato,
  etichetta,
}: {
  segno: 'piu' | 'meno'
  onClick: () => void
  disabilitato: boolean
  etichetta: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabilitato}
      aria-label={etichetta}
      whileTap={disabilitato ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-verde-acceso/30 bg-verde-campo text-xl font-bold text-nebbia disabled:opacity-40"
    >
      {segno === 'piu' ? '+' : '−'}
    </motion.button>
  )
}
