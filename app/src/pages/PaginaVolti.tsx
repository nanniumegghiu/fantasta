import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Intestazione } from '@/components/Intestazione'
import { Volto } from '@/components/Volto'
import { useListone, stagioneDelListone } from '@/features/listone/api'
import { useSonoAmministratoreApp } from '@/features/listone/api'
import { useVolti } from '@/features/listone/volti'
import {
  useCaricaVolto,
  useConfermaVolto,
  useTogliVolto,
  useVoltiDaRivedere,
  type VoltoDaRivedere,
} from '@/features/listone/volti-revisione'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from '@/features/obiettivi/tipi'
import type { Ruolo } from '@/domain/listone'

/**
 * La revisione dei volti, per chi amministra l'applicazione.
 *
 * PERCHE' ESISTE
 * L'abbinamento automatico arriva al 98% dei calciatori abbinabili. Il resto
 * richiede un occhio, e ADR-0011 lo prevedeva dall'inizio: «ciò che resta
 * scoperto va nella schermata di abbinamento manuale, che serve comunque».
 *
 * DUE LAVORI DIVERSI, NON UNO
 * «Manca la foto» si risolve caricando un file. «C'è una foto ma è stata
 * dedotta dal solo cognome» si risolve guardandola e dicendo sì o no. Sono due
 * gesti diversi con due rischi diversi — nel primo caso non si vede niente,
 * nel secondo si vede la faccia di un altro — e la schermata li tiene separati
 * invece di mescolarli in un elenco unico.
 *
 * PERCHE' NON SI CERCA L'IDENTIFICATIVO DI FOOTBALL MANAGER DA QUI
 * Le immagini stanno nel facepack, sul disco di chi ce l'ha: il browser non
 * può leggerlo. Da qui si carica un file scelto a mano; il lavoro in blocco
 * sul facepack lo fa `scripts/volti.mjs`, che quel disco ce l'ha.
 */
export function PaginaVolti() {
  const { data: sonoAdmin, isPending: controlloInCorso } = useSonoAmministratoreApp()
  const { data: listone } = useListone()
  const stagione = listone ? stagioneDelListone(listone) : null

  const { data: daRivedere, isPending } = useVoltiDaRivedere(stagione ?? undefined)
  const volto = useVolti()

  const [reparto, setReparto] = useState<Ruolo | ''>('')
  const [cerca, setCerca] = useState('')
  const [soloSenzaFoto, setSoloSenzaFoto] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  const visibili = useMemo(() => {
    let v = daRivedere ?? []
    if (reparto) v = v.filter((c) => c.role === reparto)
    if (soloSenzaFoto) v = v.filter((c) => c.motivo === 'manca')
    if (cerca.trim()) {
      const q = cerca.trim().toLowerCase()
      v = v.filter(
        (c) => c.name.toLowerCase().includes(q) || c.serie_a_team.toLowerCase().includes(q),
      )
    }
    return v
  }, [daRivedere, reparto, cerca, soloSenzaFoto])

  if (controlloInCorso) {
    return (
      <Guscio>
        <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
      </Guscio>
    )
  }

  if (!sonoAdmin) {
    return (
      <Guscio>
        <p className="rounded-2xl border border-oro/40 bg-oro/10 p-5 text-sm text-oro">
          I volti dei calciatori li sistema una persona sola per tutti, chi ha fondato
          l&apos;applicazione. Tu non devi fare niente: quando lui li aggiorna te li ritrovi già
          pronti.
        </p>
      </Guscio>
    )
  }

  const mancanti = (daRivedere ?? []).filter((c) => c.motivo === 'manca').length
  const daControllare = (daRivedere ?? []).length - mancanti

  return (
    <Guscio>
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <p className="text-sm text-fumo">
              Senza foto: <strong className="cifre-fisse text-lg text-nebbia">{mancanti}</strong>
            </p>
            <p className="text-sm text-fumo">
              Da controllare: <strong className="cifre-fisse text-lg text-oro">{daControllare}</strong>
            </p>
            {stagione && <p className="text-xs text-fumo">Listone {stagione}</p>}
          </div>
          <p className="mt-2 text-xs text-fumo">
            «Da controllare» sono quelli abbinati dal solo cognome: è il caso in cui può esserci la
            faccia di un altro. Gli abbinamenti fatti incrociando cognome e squadra non compaiono
            qui, perché sono affidabili.
          </p>
        </section>

        {messaggio && (
          <p className="rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
            {messaggio}
          </p>
        )}

        <section className="flex flex-col gap-2 rounded-2xl border border-verde-campo bg-verde-campo/30 p-3">
          <input
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca un nome o una squadra"
            className="h-11 rounded-xl border border-verde-acceso/30 bg-verde-notte px-3 text-sm text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
          />
          <div className="flex flex-wrap gap-2">
            <Pillola attiva={reparto === ''} onClick={() => setReparto('')}>
              Tutti
            </Pillola>
            {ORDINE_RUOLI.map((r) => (
              <Pillola key={r} attiva={reparto === r} onClick={() => setReparto(r)}>
                {NOME_RUOLO[r]}
              </Pillola>
            ))}
            <Pillola attiva={soloSenzaFoto} onClick={() => setSoloSenzaFoto((v) => !v)}>
              solo senza foto
            </Pillola>
          </div>
        </section>

        {isPending ? (
          <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
        ) : visibili.length === 0 ? (
          <p className="rounded-2xl border border-verde-acceso/40 bg-verde-acceso/10 p-5 text-sm text-nebbia">
            {(daRivedere ?? []).length === 0
              ? 'Non c’è niente da rivedere: ogni calciatore del listone ha la sua faccia, o l’ha già confermata qualcuno.'
              : 'Nessuno con questi filtri.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibili.slice(0, 60).map((c) => (
              <li key={c.id}>
                <Riga
                  calciatore={c}
                  stagione={stagione ?? ''}
                  indirizzo={volto(c.photo_path)}
                  onFatto={setMessaggio}
                />
              </li>
            ))}
          </ul>
        )}

        {visibili.length > 60 && (
          <p className="text-xs text-fumo">
            Ne mostro 60 alla volta: sistemane un po’ e gli altri salgono. {visibili.length - 60}{' '}
            ancora da vedere.
          </p>
        )}

        <p className="text-xs text-fumo">
          Per il lavoro in blocco sul facepack c’è <code>node scripts/volti.mjs</code>: legge le
          immagini dal disco, che da qui il browser non può fare.
        </p>
      </div>
    </Guscio>
  )
}

function Guscio({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Intestazione titolo="Volti dei calciatori" sottotitolo="Revisione" indietroA="/listone" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
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
        'h-9 rounded-full px-3 text-xs font-semibold transition-colors',
        attiva ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Riga({
  calciatore,
  stagione,
  indirizzo,
  onFatto,
}: {
  calciatore: VoltoDaRivedere
  stagione: string
  indirizzo: string | null
  onFatto: (m: string) => void
}) {
  const carica = useCaricaVolto()
  const conferma = useConfermaVolto()
  const togli = useTogliVolto()
  const scelta = useRef<HTMLInputElement>(null)
  const [errore, setErrore] = useState<string | null>(null)

  function scegliFile(file: File | undefined) {
    setErrore(null)
    if (!file) return
    // Il limite è quello dell'archivio: dirlo qui evita un caricamento che
    // fallisce dopo aver mandato due megabyte.
    if (file.size > 2 * 1024 * 1024) {
      setErrore('Immagine troppo grande: il limite è 2 MB.')
      return
    }
    carica.mutate(
      { calciatore: calciatore.id, stagione, file },
      {
        onSuccess: () => onFatto(`Volto caricato per ${calciatore.name}.`),
        onError: (e) => setErrore(e.message),
      },
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={[
        'flex flex-wrap items-center gap-3 rounded-xl border p-3',
        calciatore.motivo === 'manca'
          ? 'border-verde-campo bg-verde-notte'
          : 'border-oro/40 bg-oro/5',
      ].join(' ')}
    >
      <Volto
        nome={calciatore.name}
        indirizzo={indirizzo}
        classeRuolo={CLASSE_RUOLO[calciatore.role]}
        misura={48}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-nebbia">{calciatore.name}</p>
        <p className="cifre-fisse truncate text-xs text-fumo">
          {calciatore.serie_a_team} · quotazione {calciatore.quotation}
          {calciatore.fm_id ? ` · fm ${calciatore.fm_id}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {calciatore.motivo === 'da_controllare' && (
          <>
            <Bottone
              aspetto="secondario"
              inCorso={conferma.isPending}
              onClick={() =>
                conferma.mutate(calciatore.id, {
                  onSuccess: () => onFatto(`${calciatore.name}: faccia confermata.`),
                  onError: (e) => setErrore(e.message),
                })
              }
            >
              È lui
            </Bottone>
            <Bottone
              aspetto="fantasma"
              inCorso={togli.isPending}
              onClick={() =>
                togli.mutate(calciatore.id, {
                  onSuccess: () => onFatto(`${calciatore.name}: faccia tolta.`),
                  onError: (e) => setErrore(e.message),
                })
              }
            >
              Non è lui
            </Bottone>
          </>
        )}

        <input
          ref={scelta}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            scegliFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Bottone
          aspetto={calciatore.motivo === 'manca' ? 'primario' : 'fantasma'}
          inCorso={carica.isPending}
          onClick={() => scelta.current?.click()}
        >
          {calciatore.motivo === 'manca' ? 'Carica una foto' : 'Cambiala'}
        </Bottone>
      </div>

      {errore && <p className="w-full text-xs text-errore">{errore}</p>}
    </motion.div>
  )
}
