import { useState } from 'react'

/**
 * Il volto di un calciatore, con il suo ripiego.
 *
 * PERCHE' IL RIPIEGO NON E' UN DETTAGLIO
 * Un quarto dei calciatori non ha la foto, e ce ne saranno sempre: il facepack
 * non copre le squadre minori e il listone cambia ogni anno. Un riquadro vuoto
 * dove gli altri hanno una faccia fa sembrare rotta l'applicazione. Le
 * iniziali dentro il colore del ruolo, invece, sono una scelta: si legge lo
 * stesso, e la riga resta della stessa altezza delle altre.
 *
 * Il ripiego vale anche quando l'immagine c'e' ma non arriva — indirizzo
 * scaduto, rete che cade a meta' asta. Si accorge da sola e non lascia il buco.
 */
export function Volto({
  nome,
  indirizzo,
  classeRuolo,
  misura = 32,
}: {
  nome: string
  indirizzo: string | null
  /** Le classi del colore del ruolo, per il ripiego. */
  classeRuolo: string
  misura?: number
}) {
  const [rotta, setRotta] = useState(false)

  const iniziali = nome
    .split(/[\s']+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()

  if (indirizzo && !rotta) {
    return (
      <img
        src={indirizzo}
        alt=""
        width={misura}
        height={misura}
        loading="lazy"
        onError={() => setRotta(true)}
        style={{ width: misura, height: misura }}
        className="shrink-0 rounded-full bg-verde-campo object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ width: misura, height: misura, fontSize: Math.max(10, misura * 0.34) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${classeRuolo}`}
    >
      {iniziali}
    </span>
  )
}
