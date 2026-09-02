import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

type Props<T> = {
  elementi: T[]
  chiave: (elemento: T) => string
  rendi: (elemento: T, indice: number) => ReactNode
  /** Riceve l'elenco già riordinato. Si chiama solo se qualcosa è cambiato. */
  onRiordina: (nuovoOrdine: T[]) => void
  /** Descrizione dell'elemento, per chi usa la tastiera o un lettore di schermo. */
  descrizione: (elemento: T) => string
  disabilitato?: boolean
}

/**
 * Un elenco che si riordina trascinando.
 *
 * PERCHE' SCRITTO A MANO
 * Le librerie di trascinamento risolvono il caso generale: griglie, elenchi
 * annidati, trascinamento fra contenitori diversi. Qui serve una cosa sola,
 * spostare una riga su e giù dentro un elenco verticale, e per quella bastano
 * gli eventi del puntatore che il browser ha già. Vedi ADR-0006 sull'elenco
 * chiuso delle dipendenze.
 *
 * SI USA IL PUNTATORE, NON IL TRASCINAMENTO NATIVO
 * Il trascinamento nativo del browser non esiste sul dito: su un telefono non
 * succederebbe niente. Gli eventi del puntatore valgono per mouse, dito e
 * pennino con lo stesso codice.
 *
 * CI SONO SEMPRE ANCHE LE FRECCE
 * Trascinare non si può fare con la tastiera, e chi ha attivato la riduzione
 * del movimento non deve essere costretto a un gesto continuo. Le due frecce
 * fanno la stessa identica cosa e restano sempre visibili: non sono un
 * ripiego nascosto, sono la strada alternativa.
 */
export function ListaRiordinabile<T>({
  elementi,
  chiave,
  rendi,
  onRiordina,
  descrizione,
  disabilitato,
}: Props<T>) {
  const contenitore = useRef<HTMLUListElement>(null)
  const [inMovimento, setInMovimento] = useState<number | null>(null)
  const [spostamento, setSpostamento] = useState(0)
  const [destinazione, setDestinazione] = useState<number | null>(null)

  const stato = useRef<{
    indice: number
    partenzaY: number
    riquadri: DOMRect[]
  } | null>(null)

  const sposta = useCallback(
    (da: number, a: number) => {
      if (da === a || a < 0 || a >= elementi.length) return
      const copia = [...elementi]
      const [preso] = copia.splice(da, 1)
      copia.splice(a, 0, preso)
      onRiordina(copia)
    },
    [elementi, onRiordina],
  )

  const muovi = useCallback((e: PointerEvent) => {
    const s = stato.current
    if (!s) return
    const delta = e.clientY - s.partenzaY
    setSpostamento(delta)

    // Dove finirebbe la riga se la lasciassi adesso: si confronta il centro
    // della riga trascinata con il centro delle altre.
    const centro = s.riquadri[s.indice].top + s.riquadri[s.indice].height / 2 + delta
    let nuovo = s.indice
    for (let i = 0; i < s.riquadri.length; i++) {
      if (i === s.indice) continue
      const r = s.riquadri[i]
      const centroAltro = r.top + r.height / 2
      if (i < s.indice && centro < centroAltro) {
        nuovo = Math.min(nuovo, i)
      } else if (i > s.indice && centro > centroAltro) {
        nuovo = Math.max(nuovo, i)
      }
    }
    setDestinazione(nuovo)
  }, [])

  const finisci = useCallback(() => {
    const s = stato.current
    if (s && destinazione != null) sposta(s.indice, destinazione)
    stato.current = null
    setInMovimento(null)
    setSpostamento(0)
    setDestinazione(null)
  }, [destinazione, sposta])

  useEffect(() => {
    if (inMovimento == null) return
    window.addEventListener('pointermove', muovi)
    window.addEventListener('pointerup', finisci)
    window.addEventListener('pointercancel', finisci)
    return () => {
      window.removeEventListener('pointermove', muovi)
      window.removeEventListener('pointerup', finisci)
      window.removeEventListener('pointercancel', finisci)
    }
  }, [inMovimento, muovi, finisci])

  function inizia(e: React.PointerEvent, indice: number) {
    if (disabilitato || elementi.length < 2) return
    const righe = Array.from(contenitore.current?.children ?? []) as HTMLElement[]
    stato.current = {
      indice,
      partenzaY: e.clientY,
      riquadri: righe.map((r) => r.getBoundingClientRect()),
    }
    setInMovimento(indice)
    setDestinazione(indice)
    // Impedisce che il gesto diventi uno scorrimento della pagina.
    e.preventDefault()
  }

  /** Di quanto si sposta una riga che non è quella trascinata. */
  function scostamento(i: number): number {
    const s = stato.current
    if (!s || inMovimento == null || destinazione == null) return 0
    const altezza = s.riquadri[s.indice].height + 8
    if (inMovimento < destinazione && i > inMovimento && i <= destinazione) return -altezza
    if (inMovimento > destinazione && i < inMovimento && i >= destinazione) return altezza
    return 0
  }

  return (
    <ul ref={contenitore} className="flex flex-col gap-2">
      {elementi.map((elemento, i) => {
        const trascinata = inMovimento === i
        return (
          <li
            key={chiave(elemento)}
            style={{
              transform: `translateY(${trascinata ? spostamento : scostamento(i)}px)`,
              transition: inMovimento == null ? 'transform 180ms' : trascinata ? 'none' : 'transform 180ms',
              zIndex: trascinata ? 10 : undefined,
              position: 'relative',
            }}
            className={trascinata ? 'opacity-90 shadow-2xl' : ''}
          >
            <div className="flex items-stretch gap-2">
              <div className="flex shrink-0 flex-col justify-center">
                {/* La maniglia: si trascina da qui, non da tutta la riga, così
                    dentro la scheda restano usabili campi e pulsanti. */}
                <button
                  type="button"
                  onPointerDown={(e) => inizia(e, i)}
                  disabled={disabilitato || elementi.length < 2}
                  aria-label={`Trascina per spostare ${descrizione(elemento)}`}
                  className="flex h-11 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-fumo hover:bg-verde-campo hover:text-nebbia active:cursor-grabbing disabled:opacity-30"
                >
                  <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
                    <circle cx="9" cy="6" r="1.6" />
                    <circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" />
                    <circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" />
                    <circle cx="15" cy="18" r="1.6" />
                  </svg>
                </button>

                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => sposta(i, i - 1)}
                    disabled={disabilitato || i === 0}
                    aria-label={`Sposta ${descrizione(elemento)} più in alto`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs text-fumo hover:text-nebbia disabled:opacity-25"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => sposta(i, i + 1)}
                    disabled={disabilitato || i === elementi.length - 1}
                    aria-label={`Sposta ${descrizione(elemento)} più in basso`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs text-fumo hover:text-nebbia disabled:opacity-25"
                  >
                    ▼
                  </button>
                </div>
              </div>

              <div className="min-w-0 flex-1">{rendi(elemento, i)}</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
