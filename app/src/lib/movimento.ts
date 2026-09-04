import { useEffect, useState } from 'react'

/**
 * Se chi guarda ha chiesto meno movimento.
 *
 * PERCHE' STA QUI E NON DENTRO OGNI ANIMAZIONE
 *
 * La regola in `styles/index.css` azzera le durate **CSS**. Le animazioni di
 * `motion/react` non sono CSS: sono pilotate da JavaScript, e quella regola
 * non le tocca. Il risultato era che, con «Riduci movimento» attivo, il
 * countdown dello schermo condiviso continuava a pulsare all'infinito —
 * esattamente il caso che `docs/04-frontend-e-design.md` dichiarava di voler
 * evitare, e con la motivazione giusta: le pulsazioni danno fastidio fisico a
 * chi soffre di emicrania vestibolare.
 *
 * Si legge in un punto solo perche' risolverlo animazione per animazione vuol
 * dire dimenticarsene alla prossima. Chi anima chiede qui, e decide.
 *
 * PERCHE' NON `useReducedMotion` DI MOTION
 *
 * Fa la stessa cosa. Averlo in casa costa dodici righe e da' un posto dove
 * scrivere questo commento, che e' la parte che serve davvero: la prossima
 * persona che aggiunge un'animazione deve incontrare la regola, non scoprirla.
 */
export function useMovimentoRidotto(): boolean {
  const [ridotto, setRidotto] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cambia = (e: MediaQueryListEvent) => setRidotto(e.matches)
    query.addEventListener('change', cambia)
    return () => query.removeEventListener('change', cambia)
  }, [])

  return ridotto
}

/**
 * Il tremito di chi si e' appena visto superare.
 *
 * Non e' decorazione: e' l'unico modo che ha il telefono di dirti una cosa che
 * devi sapere subito, visto che i telefoni in asta sono muti per scelta (dieci
 * telefoni che suonano insieme in una stanza sono rumore, non informazione).
 *
 * La vibrazione e' un di piu' e non un canale: su iOS Safari `vibrate` non
 * esiste, e li' resta il tremito visivo. Un segnale che funziona solo su meta'
 * dei telefoni non puo' essere l'unico.
 */
export function vibraBreve(ridotto: boolean) {
  if (ridotto) return
  try {
    navigator.vibrate?.(30)
  } catch {
    // Alcuni browser la dichiarano e poi la rifiutano fuori da un gesto
    // dell'utente. Non e' un errore che riguardi chi sta giocando.
  }
}
