import { useId } from 'react'

type Props = {
  etichetta: string
  tipo?: 'text' | 'email' | 'password'
  valore: string
  onChange: (v: string) => void
  aiuto?: string
  errore?: string
  autoComplete?: string
  /**
   * Il nome del campo. Non e' un dettaglio: il riempimento automatico del
   * browser si basa su questo e sull'id. Senza, il gestore delle password
   * tira a indovinare e scrive la password salvata dentro il campo di una
   * registrazione nuova.
   */
  nome?: string
  richiesto?: boolean
  placeholder?: string
}

export function Campo({
  etichetta,
  tipo = 'text',
  valore,
  onChange,
  aiuto,
  errore,
  autoComplete,
  nome,
  richiesto,
  placeholder,
}: Props) {
  const id = useId()
  const idAiuto = `${id}-aiuto`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-nebbia">
        {etichetta}
        {richiesto && <span className="text-oro"> *</span>}
      </label>

      <input
        id={id}
        name={nome}
        type={tipo}
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={aiuto || errore ? idAiuto : undefined}
        aria-invalid={errore ? true : undefined}
        className={[
          'min-h-[48px] rounded-xl bg-verde-campo/60 px-4 text-[16px] text-nebbia',
          'placeholder:text-fumo/60 border transition-colors',
          errore
            ? 'border-errore focus:border-errore'
            : 'border-verde-acceso/30 focus:border-verde-acceso',
          'outline-none',
        ].join(' ')}
      />

      {(errore || aiuto) && (
        <p id={idAiuto} className={`text-xs ${errore ? 'text-errore' : 'text-fumo'}`}>
          {errore ?? aiuto}
        </p>
      )}
    </div>
  )
}
