import { useState } from 'react'

/**
 * Lo stemma di una squadra di Serie A.
 *
 * PERCHE' LA RICADUTA E' IL NULLA, E NON UN SEGNAPOSTO
 *
 * Al contrario del volto, qui la mancanza non lascia un buco: accanto allo
 * stemma c'è sempre il nome della squadra, scritto. Un quadrato grigio al
 * posto di un'immagine che manca aggiungerebbe rumore senza aggiungere
 * informazione, e su una riga di listone lunga come una rosa il rumore si paga.
 *
 * Tre squadre su venti non hanno lo stemma perché in Football Manager non
 * giocano in Serie A: è una condizione normale, non un guasto.
 */
export function Stemma({
  squadra,
  indirizzo,
  misura = 18,
}: {
  squadra: string
  indirizzo: string | null
  misura?: number
}) {
  const [rotta, setRotta] = useState(false)
  if (!indirizzo || rotta) return null

  return (
    <img
      src={indirizzo}
      alt=""
      title={squadra}
      width={misura}
      height={misura}
      loading="lazy"
      onError={() => setRotta(true)}
      style={{ width: misura, height: misura }}
      className="shrink-0 object-contain"
    />
  )
}
