import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MarchioFantasta } from './MarchioFantasta'

type Props = {
  titolo?: string
  sottotitolo?: string
  /**
   * Dove va la freccia indietro **quando non c'è un posto da cui si è
   * arrivati**: arrivando da un collegamento esterno, o riaprendo l'app su
   * questa schermata. Negli altri casi si torna da dove si veniva davvero.
   */
  indietroA?: string
  azione?: ReactNode
  /** Mostra il marchio al posto del titolo: solo nella schermata principale. */
  conMarchio?: boolean
}

export function Intestazione({ titolo, sottotitolo, indietroA, azione, conMarchio }: Props) {
  const naviga = useNavigate()
  const posizione = useLocation()

  /**
   * Indietro vuol dire **da dove sono venuto**, non «un piano più su».
   *
   * Durante un'asta si esce di continuo per un secondo: guardo un obiettivo,
   * controllo il listone, torno. Con una destinazione fissa quel ritorno
   * finiva sulla schermata della lega, e rientrare in asta costava tre tocchi
   * e magari una chiamata persa.
   *
   * React Router mette `key: 'default'` quando questa è la prima schermata
   * della sessione: lì una cronologia non c'è, e si usa la destinazione fissa.
   * In tutti gli altri casi si torna indietro sul serio.
   */
  function indietro() {
    if (posizione.key !== 'default') return naviga(-1)
    if (indietroA) return naviga(indietroA)
  }

  return (
    <header className="sticky top-0 z-20 border-b border-verde-campo bg-verde-notte/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {indietroA && (
          <button
            type="button"
            onClick={indietro}
            aria-label="Torna indietro"
            className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-fumo hover:bg-verde-campo hover:text-nebbia"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="size-6">
              <path
                d="M15 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {conMarchio && (
          <img src={`${import.meta.env.BASE_URL}icona-512.png`} alt="" width={36} height={36} className="size-9 rounded-lg" />
        )}

        <div className="min-w-0 flex-1">
          {conMarchio ? (
            <MarchioFantasta className="text-xl" />
          ) : (
            <p className="truncate text-base font-bold text-nebbia">{titolo}</p>
          )}
          {sottotitolo && <p className="truncate text-xs text-fumo">{sottotitolo}</p>}
        </div>

        {azione}
      </div>
    </header>
  )
}
