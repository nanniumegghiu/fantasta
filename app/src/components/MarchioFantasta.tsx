/**
 * Il nome scritto di Fantasta, definito in un posto solo.
 *
 * La divisione dei colori non e' decorativa: "Fant" in bianco e "asta" in
 * arancione fanno emergere la parola ASTA dentro il nome. Se lo si scrivesse a
 * mano in ogni schermata, prima o poi qualcuno taglierebbe nel punto sbagliato.
 */

type Props = {
  /** Classi tipografiche: dimensione e peso li decide chi lo usa. */
  className?: string
}

export function MarchioFantasta({ className = '' }: Props) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-white">Fant</span>
      <span className="text-arancio">asta</span>
    </span>
  )
}
