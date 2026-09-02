import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarchioFantasta } from './MarchioFantasta'

type Props = {
  titolo?: string
  sottotitolo?: string
  /** Se presente, mostra la freccia indietro e ci torna. */
  indietroA?: string
  azione?: ReactNode
  /** Mostra il marchio al posto del titolo: solo nella schermata principale. */
  conMarchio?: boolean
}

export function Intestazione({ titolo, sottotitolo, indietroA, azione, conMarchio }: Props) {
  const naviga = useNavigate()

  return (
    <header className="sticky top-0 z-20 border-b border-verde-campo bg-verde-notte/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {indietroA && (
          <button
            type="button"
            onClick={() => naviga(indietroA)}
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
          <img src="/icona-512.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
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
