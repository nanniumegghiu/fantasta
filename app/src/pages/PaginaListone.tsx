import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Intestazione } from '@/components/Intestazione'
import { Bottone } from '@/components/Bottone'
import {
  giornataAggiornamento,
  useListone,
  type CalciatoreInListone,
} from '@/features/listone/api'
import type { Ruolo } from '@/domain/listone'

const RUOLI: Array<{ codice: Ruolo; breve: string; lungo: string; classe: string }> = [
  { codice: 'P', breve: 'P', lungo: 'Portieri', classe: 'bg-oro/20 text-oro' },
  { codice: 'D', breve: 'D', lungo: 'Difensori', classe: 'bg-verde-acceso/25 text-verde-acceso' },
  { codice: 'C', breve: 'C', lungo: 'Centrocampisti', classe: 'bg-informativo/20 text-informativo' },
  { codice: 'A', breve: 'A', lungo: 'Attaccanti', classe: 'bg-arancio/20 text-arancio' },
]

type Colonna = {
  chiave: string
  etichetta: string
  titolo: string
  larghezza: number
  valore: (c: CalciatoreInListone) => number | string | null
  mostra: (c: CalciatoreInListone) => string
}

const decimale = (v: number | null) =>
  v == null ? '–' : v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const conta = (v: number | null) => (v == null ? '–' : String(v))

const COLONNE: Colonna[] = [
  { chiave: 'quotation', etichetta: 'Qt', titolo: 'Quotazione', larghezza: 56, valore: (c) => c.quotation, mostra: (c) => String(c.quotation) },
  { chiave: 'games_played', etichetta: 'PG', titolo: 'Partite giocate', larghezza: 52, valore: (c) => c.games_played, mostra: (c) => conta(c.games_played) },
  { chiave: 'minutes', etichetta: 'Min', titolo: 'Minuti giocati', larghezza: 62, valore: (c) => c.minutes, mostra: (c) => conta(c.minutes) },
  { chiave: 'avg_vote', etichetta: 'MV', titolo: 'Media voto', larghezza: 64, valore: (c) => c.avg_vote, mostra: (c) => decimale(c.avg_vote) },
  { chiave: 'fanta_avg', etichetta: 'FM', titolo: 'Fantamedia', larghezza: 64, valore: (c) => c.fanta_avg, mostra: (c) => decimale(c.fanta_avg) },
  { chiave: 'goals', etichetta: 'Gol', titolo: 'Gol fatti', larghezza: 52, valore: (c) => c.goals, mostra: (c) => conta(c.goals) },
  { chiave: 'assists', etichetta: 'Ass', titolo: 'Assist', larghezza: 52, valore: (c) => c.assists, mostra: (c) => conta(c.assists) },
  { chiave: 'yellow_cards', etichetta: 'Amm', titolo: 'Ammonizioni', larghezza: 56, valore: (c) => c.yellow_cards, mostra: (c) => conta(c.yellow_cards) },
  { chiave: 'red_cards', etichetta: 'Esp', titolo: 'Espulsioni', larghezza: 52, valore: (c) => c.red_cards, mostra: (c) => conta(c.red_cards) },
]

const LARGHEZZA_NOME = 176

export function PaginaListone() {
  const { data: righe, isPending, error, refetch } = useListone()

  const [ruolo, setRuolo] = useState<Ruolo | null>(null)
  const [squadra, setSquadra] = useState<string>('')
  const [cerca, setCerca] = useState('')
  const [ordine, setOrdine] = useState<{ chiave: string; crescente: boolean }>({
    chiave: 'quotation',
    crescente: false,
  })

  const squadre = useMemo(
    () => [...new Set((righe ?? []).map((r) => r.serie_a_team))].sort((a, b) => a.localeCompare(b, 'it')),
    [righe],
  )

  const visibili = useMemo(() => {
    let v = righe ?? []
    if (ruolo) v = v.filter((c) => c.role === ruolo)
    if (squadra) v = v.filter((c) => c.serie_a_team === squadra)
    if (cerca.trim()) {
      const q = cerca.trim().toLowerCase()
      v = v.filter((c) => c.name.toLowerCase().includes(q))
    }

    const colonna = COLONNE.find((c) => c.chiave === ordine.chiave)
    const estrai = colonna ? colonna.valore : (c: CalciatoreInListone) => c.name

    return [...v].sort((a, b) => {
      const va = estrai(a)
      const vb = estrai(b)
      // I valori mancanti restano sempre in fondo, in tutti e due i versi:
      // un trattino in cima a una classifica per media voto è disorientante.
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const c = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'it')
      return ordine.crescente ? c : -c
    })
  }, [righe, ruolo, squadra, cerca, ordine])

  const giornata = giornataAggiornamento(righe ?? [])

  return (
    <div className="flex min-h-dvh flex-col">
      <Intestazione
        titolo="Listone"
        sottotitolo={
          righe
            ? `${visibili.length} di ${righe.length} calciatori`
            : undefined
        }
        indietroA="/leghe"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pt-4">
        <input
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca un calciatore"
          aria-label="Cerca un calciatore"
          className="h-12 w-full rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-4 text-[16px] text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
        />

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Pillola attiva={ruolo === null} onClick={() => setRuolo(null)}>
            Tutti
          </Pillola>
          {RUOLI.map((r) => (
            <Pillola key={r.codice} attiva={ruolo === r.codice} onClick={() => setRuolo(r.codice)}>
              {r.lungo}
            </Pillola>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <select
            value={squadra}
            onChange={(e) => setSquadra(e.target.value)}
            aria-label="Filtra per squadra di Serie A"
            className="h-11 min-w-0 flex-1 rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm text-nebbia outline-none focus:border-verde-acceso"
          >
            <option value="">Tutte le squadre</option>
            {squadre.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {(ruolo || squadra || cerca) && (
            <Bottone
              aspetto="fantasma"
              onClick={() => {
                setRuolo(null)
                setSquadra('')
                setCerca('')
              }}
            >
              Azzera
            </Bottone>
          )}
        </div>

        <p className="mt-2 text-xs text-fumo">
          {giornata != null
            ? `Statistiche aggiornate alla giornata ${giornata}.`
            : 'Statistiche non ancora caricate: le colonne mostrano un trattino.'}
        </p>
      </div>

      {isPending && (
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          <div className="h-72 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
        </div>
      )}

      {error && (
        <div className="mx-auto w-full max-w-5xl px-4 py-4">
          <p role="alert" className="rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm text-errore">
            {error.message}
          </p>
          <div className="mt-3">
            <Bottone aspetto="secondario" onClick={() => void refetch()}>
              Riprova
            </Bottone>
          </div>
        </div>
      )}

      {righe && righe.length === 0 && (
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <div className="rounded-2xl border border-oro/40 bg-oro/10 p-5 text-sm text-oro">
            Il listone non è ancora stato caricato. Lo carica una volta sola chi ha fondato
            l&apos;applicazione, e da quel momento lo vedono tutti su qualsiasi dispositivo.
          </div>
        </div>
      )}

      {righe && righe.length > 0 && visibili.length === 0 && (
        <div className="mx-auto w-full max-w-5xl px-4 py-6">
          <p className="text-sm text-fumo">Nessun calciatore con questi filtri.</p>
        </div>
      )}

      {visibili.length > 0 && (
        <Tabella righe={visibili} ordine={ordine} setOrdine={setOrdine} />
      )}
    </div>
  )
}

function Pillola({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
        attiva ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Tabella({
  righe,
  ordine,
  setOrdine,
}: {
  righe: CalciatoreInListone[]
  ordine: { chiave: string; crescente: boolean }
  setOrdine: (o: { chiave: string; crescente: boolean }) => void
}) {
  const contenitore = useRef<HTMLDivElement>(null)

  // Con oltre cinquecento righe si disegnano solo quelle visibili: una tabella
  // normale scatta durante lo scorrimento, e su un telefono si nota subito.
  const virtuale = useVirtualizer({
    count: righe.length,
    getScrollElement: () => contenitore.current,
    estimateSize: () => 52,
    overscan: 8,
  })

  function ordinaPer(chiave: string) {
    setOrdine(
      ordine.chiave === chiave
        ? { chiave, crescente: !ordine.crescente }
        : { chiave, crescente: false },
    )
  }

  const larghezzaTotale = LARGHEZZA_NOME + COLONNE.reduce((s, c) => s + c.larghezza, 0)

  return (
    <div className="mx-auto mt-3 w-full max-w-5xl flex-1 px-4 pb-6">
      <div
        ref={contenitore}
        className="h-[calc(100dvh-19rem)] min-h-64 overflow-auto rounded-2xl border border-verde-campo bg-verde-campo/20"
      >
        <div style={{ width: larghezzaTotale }}>
          {/* Intestazione della tabella: resta in alto mentre si scorre. */}
          <div className="sticky top-0 z-10 flex border-b border-verde-campo bg-verde-notte">
            <div
              className="sticky left-0 z-10 flex items-center bg-verde-notte px-3 py-2 text-xs font-semibold text-fumo"
              style={{ width: LARGHEZZA_NOME }}
            >
              Calciatore
            </div>
            {COLONNE.map((c) => {
              const attiva = ordine.chiave === c.chiave
              return (
                <button
                  key={c.chiave}
                  type="button"
                  onClick={() => ordinaPer(c.chiave)}
                  title={`${c.titolo}: ordina`}
                  aria-label={`Ordina per ${c.titolo}`}
                  className={[
                    'flex shrink-0 items-center justify-end gap-0.5 px-2 py-2 text-xs font-semibold',
                    attiva ? 'text-oro' : 'text-fumo hover:text-nebbia',
                  ].join(' ')}
                  style={{ width: c.larghezza }}
                >
                  {c.etichetta}
                  <span aria-hidden className="text-[10px]">
                    {attiva ? (ordine.crescente ? '▲' : '▼') : ''}
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ height: virtuale.getTotalSize(), position: 'relative' }}>
            {virtuale.getVirtualItems().map((v) => {
              const c = righe[v.index]
              const ruolo = RUOLI.find((r) => r.codice === c.role)!
              return (
                <div
                  key={c.id}
                  className="absolute left-0 flex items-center border-b border-verde-campo/50"
                  style={{ top: v.start, height: v.size, width: larghezzaTotale }}
                >
                  <div
                    className="sticky left-0 z-10 flex h-full items-center gap-2 bg-verde-notte px-3"
                    style={{ width: LARGHEZZA_NOME }}
                  >
                    <Ritratto calciatore={c} classeRuolo={ruolo.classe} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-nebbia">{c.name}</p>
                      <p className="truncate text-[11px] text-fumo">{c.serie_a_team}</p>
                    </div>
                  </div>

                  {COLONNE.map((col) => (
                    <div
                      key={col.chiave}
                      className={[
                        'cifre-fisse shrink-0 px-2 text-right text-sm',
                        col.chiave === ordine.chiave ? 'font-semibold text-oro' : 'text-nebbia',
                      ].join(' ')}
                      style={{ width: col.larghezza }}
                    >
                      {col.mostra(c)}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-fumo">
        Scorri la tabella in orizzontale per vedere tutte le statistiche. Tocca
        un&apos;intestazione per ordinare.
      </p>
    </div>
  )
}

/** La foto del calciatore, o le sue iniziali sul colore del ruolo. */
function Ritratto({
  calciatore,
  classeRuolo,
}: {
  calciatore: CalciatoreInListone
  classeRuolo: string
}) {
  const iniziali = calciatore.name
    .split(/[\s']+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()

  if (calciatore.photo_path) {
    return (
      <img
        src={calciatore.photo_path}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${classeRuolo}`}
    >
      {iniziali}
    </span>
  )
}
