import { motion } from 'motion/react'
import type { ReactNode } from 'react'

type Aspetto = 'primario' | 'secondario' | 'fantasma' | 'oro'
type Misura = 'normale' | 'grande'

type Props = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  aspetto?: Aspetto
  misura?: Misura
  /** Mostra lo stato di attesa e blocca il bottone. Mai fingere che sia gia' fatto. */
  inCorso?: boolean
  disabilitato?: boolean
  larghezzaPiena?: boolean
  icona?: ReactNode
}

// Il testo su arancio e su oro e' sempre carbone, mai bianco:
// il bianco su arancio non raggiunge il contrasto minimo.
const ASPETTI: Record<Aspetto, string> = {
  primario:
    'bg-arancio text-carbone shadow-[0_4px_0_0_var(--color-arancio-caldo)] hover:bg-arancio-caldo hover:shadow-[0_2px_0_0_var(--color-arancio-caldo)]',
  oro: 'bg-oro text-carbone shadow-[0_4px_0_0_var(--color-oro-scuro)] hover:shadow-[0_2px_0_0_var(--color-oro-scuro)]',
  secondario:
    'bg-verde-campo text-nebbia border border-verde-acceso/40 hover:border-verde-acceso hover:bg-verde-campo/80',
  fantasma: 'bg-transparent text-fumo hover:text-nebbia hover:bg-verde-campo/50',
}

const MISURE: Record<Misura, string> = {
  // 44px di altezza minima: area di tocco del design system.
  normale: 'min-h-[44px] px-5 text-[15px]',
  grande: 'min-h-[56px] px-6 text-[17px]',
}

export function Bottone({
  children,
  onClick,
  type = 'button',
  aspetto = 'primario',
  misura = 'normale',
  inCorso = false,
  disabilitato = false,
  larghezzaPiena = false,
  icona,
}: Props) {
  const bloccato = disabilitato || inCorso

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={bloccato}
      whileTap={bloccato ? undefined : { scale: 0.96, y: 2 }}
      transition={{ duration: 0.12 }}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold',
        'transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        ASPETTI[aspetto],
        MISURE[misura],
        larghezzaPiena ? 'w-full' : '',
      ].join(' ')}
    >
      {inCorso ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icona
      )}
      <span>{children}</span>
    </motion.button>
  )
}
