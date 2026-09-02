import { useId } from 'react'

type Props = {
  etichetta: string
  descrizione?: string
  acceso: boolean
  onChange: (v: boolean) => void
  disabilitato?: boolean
  /** Motivo per cui e' bloccato: si mostra invece di lasciare l'utente a indovinare. */
  motivoBlocco?: string
}

export function Interruttore({
  etichetta,
  descrizione,
  acceso,
  onChange,
  disabilitato,
  motivoBlocco,
}: Props) {
  const id = useId()

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={acceso}
        disabled={disabilitato}
        onClick={() => onChange(!acceso)}
        className={[
          'mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors',
          acceso ? 'bg-verde-acceso' : 'bg-verde-campo',
          disabilitato ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      >
        <span
          className={[
            'size-5 rounded-full bg-nebbia transition-transform duration-200',
            acceso ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>

      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-nebbia">{etichetta}</span>
        {descrizione && <span className="block text-xs text-fumo">{descrizione}</span>}
        {disabilitato && motivoBlocco && (
          <span className="mt-0.5 block text-xs text-oro">{motivoBlocco}</span>
        )}
      </label>
    </div>
  )
}
