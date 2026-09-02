import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Campo } from '@/components/Campo'
import { CampoNumero } from '@/components/CampoNumero'
import { Intestazione } from '@/components/Intestazione'
import { leggiFoglio } from '@/domain/fogli'
import {
  interpretaListone,
  interpretaStatistiche,
  type Interpretazione,
  type RigaListone,
  type RigaStatistiche,
} from '@/domain/listone'
import { stagioneCorrente } from '@/domain/stagione'
import {
  useImportaListone,
  useImportaStatistiche,
  useSonoAmministratoreApp,
} from '@/features/listone/api'

export function PaginaImportazione() {
  const { data: sonoAdmin, isPending } = useSonoAmministratoreApp()
  const [stagione, setStagione] = useState(stagioneCorrente())

  if (isPending) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="Importazione" indietroA="/leghe" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
        </div>
      </div>
    )
  }

  // Nessuna finzione: chi non ha il permesso lo legge chiaramente, invece di
  // trovarsi un modulo che fallisce dopo aver caricato un file da 300 kB.
  if (!sonoAdmin) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="Importazione" indietroA="/leghe" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="rounded-2xl border border-oro/40 bg-oro/10 p-5 text-sm text-oro">
            Il listone è unico per tutte le leghe e lo carica solo un amministratore
            dell&apos;applicazione. Non è un permesso che si può dare da qui.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <Intestazione titolo="Importazione" sottotitolo="Listone e statistiche" indietroA="/leghe" />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
          <Campo
            etichetta="Stagione"
            valore={stagione}
            onChange={setStagione}
            aiuto="Vale per tutti e due i file caricati qui sotto."
          />
        </section>

        <BloccoListone stagione={stagione} />
        <BloccoStatistiche stagione={stagione} />

        <section className="rounded-2xl border border-verde-campo bg-verde-campo/20 p-4 text-xs text-fumo">
          <p className="font-semibold text-nebbia">Da sapere</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
            <li>Vanno bene i file <code>.xlsx</code> e i <code>.csv</code>. Il vecchio <code>.xls</code> no.</li>
            <li>
              Le righe di titolo sopra le intestazioni non danno fastidio: l&apos;app le salta da sola.
            </li>
            <li>
              Ricaricare lo stesso file non crea doppioni: aggiorna. Un calciatore che sparisce dal
              listone non viene mai cancellato, esce solo dall&apos;elenco.
            </li>
            <li>
              Il file ufficiale delle statistiche non contiene i minuti giocati: quella colonna
              resterà con un trattino, e l&apos;app te lo dirà dopo la lettura.
            </li>
          </ul>
        </section>
      </main>
    </div>
  )
}

// ─── Listone ────────────────────────────────────────────────────────────────

function BloccoListone({ stagione }: { stagione: string }) {
  const importa = useImportaListone()
  const [letto, setLetto] = useState<Interpretazione<RigaListone> | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [fatto, setFatto] = useState<string | null>(null)

  async function scegli(file: File | undefined) {
    if (!file) return
    setErrore(null)
    setFatto(null)
    setLetto(null)
    try {
      const byte = new Uint8Array(await file.arrayBuffer())
      const tabella = await leggiFoglio(file.name, byte)
      setLetto(interpretaListone(tabella))
      setNomeFile(file.name)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco a leggere questo file.')
    }
  }

  async function conferma() {
    if (!letto) return
    setErrore(null)
    try {
      const esito = await importa.mutateAsync({ stagione, righe: letto.righe })
      if (esito.esito !== 'ok') {
        setErrore(esito.messaggio)
        return
      }
      setFatto(
        `${esito.messaggio} Nuovi ${esito.inseriti}, aggiornati ${esito.aggiornati}, usciti dal listone ${esito.ritirati}.`,
      )
      setLetto(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Importazione non riuscita.')
    }
  }

  return (
    <Blocco
      titolo="Il listone"
      sottotitolo="Il file delle quotazioni: chi c'è, che ruolo ha, quanto vale."
      nomeFile={nomeFile}
      onFile={scegli}
      errore={errore}
      fatto={fatto}
    >
      {letto && (
        <Anteprima
          lettura={letto}
          quanti={letto.righe.length}
          nomeCose="calciatori"
          esempio={letto.righe.slice(0, 3).map((r) => `${r.nome} · ${r.ruolo} · ${r.squadra} · ${r.quotazione}`)}
          inCorso={importa.isPending}
          onConferma={conferma}
        />
      )}
    </Blocco>
  )
}

// ─── Statistiche ────────────────────────────────────────────────────────────

function BloccoStatistiche({ stagione }: { stagione: string }) {
  const importa = useImportaStatistiche()
  const [letto, setLetto] = useState<Interpretazione<RigaStatistiche> | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [giornata, setGiornata] = useState(1)
  const [errore, setErrore] = useState<string | null>(null)
  const [fatto, setFatto] = useState<string | null>(null)

  async function scegli(file: File | undefined) {
    if (!file) return
    setErrore(null)
    setFatto(null)
    setLetto(null)
    try {
      const byte = new Uint8Array(await file.arrayBuffer())
      const tabella = await leggiFoglio(file.name, byte)
      setLetto(interpretaStatistiche(tabella))
      setNomeFile(file.name)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco a leggere questo file.')
    }
  }

  async function conferma() {
    if (!letto) return
    setErrore(null)
    try {
      const esito = await importa.mutateAsync({ stagione, giornata, righe: letto.righe })
      if (esito.esito !== 'ok') {
        setErrore(esito.messaggio)
        return
      }
      setFatto(
        `${esito.messaggio} Aggiornati ${esito.aggiornati} calciatori, ignorate ${esito.ignorati} righe che non stanno nel listone.`,
      )
      setLetto(null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Importazione non riuscita.')
    }
  }

  return (
    <Blocco
      titolo="Le statistiche"
      sottotitolo="Come sta andando ognuno. Si può ricaricare a ogni giornata."
      nomeFile={nomeFile}
      onFile={scegli}
      errore={errore}
      fatto={fatto}
    >
      {letto && (
        <>
          <div className="mb-4">
            <CampoNumero
              etichetta="Ultima giornata completa nel file"
              valore={giornata}
              onChange={setGiornata}
              minimo={0}
              massimo={60}
              aiuto="Comparirà accanto alle statistiche: senza, i numeri non si sa a quando si riferiscono."
            />
          </div>
          <Anteprima
            lettura={letto}
            quanti={letto.righe.length}
            nomeCose="righe di statistiche"
            esempio={letto.righe
              .slice(0, 3)
              .map((r) => `id ${r.id} · ${r.partite ?? '–'} partite · media ${r.media ?? '–'}`)}
            inCorso={importa.isPending}
            onConferma={conferma}
          />
        </>
      )}
    </Blocco>
  )
}

// ─── Pezzi comuni ───────────────────────────────────────────────────────────

function Blocco({
  titolo,
  sottotitolo,
  nomeFile,
  onFile,
  errore,
  fatto,
  children,
}: {
  titolo: string
  sottotitolo: string
  nomeFile: string
  onFile: (f: File | undefined) => void
  errore: string | null
  fatto: string | null
  children: React.ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [sopra, setSopra] = useState(false)

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4"
    >
      <h2 className="text-base font-bold text-nebbia">{titolo}</h2>
      <p className="mt-0.5 text-xs text-fumo">{sottotitolo}</p>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setSopra(true)
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSopra(false)
          onFile(e.dataTransfer.files?.[0])
        }}
        className={[
          'mt-3 rounded-xl border-2 border-dashed p-5 text-center transition-colors',
          sopra ? 'border-arancio bg-arancio/10' : 'border-verde-acceso/30',
        ].join(' ')}
      >
        <p className="text-sm text-fumo">
          {nomeFile ? `File letto: ${nomeFile}` : 'Trascina qui il file, oppure'}
        </p>
        <div className="mt-3">
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv,.txt,.tsv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Bottone aspetto="secondario" onClick={() => input.current?.click()}>
            Scegli un file
          </Bottone>
        </div>
      </div>

      {errore && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore"
        >
          {errore}
        </p>
      )}

      {fatto && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia"
        >
          {fatto}
        </p>
      )}

      <div className="mt-3">{children}</div>
    </motion.section>
  )
}

/**
 * Cosa ho capito del file, prima di scrivere niente.
 *
 * È il pezzo che rende sicura un'importazione: si vede quale riga conteneva le
 * intestazioni, quale colonna è stata usata per ogni campo, quante righe sono
 * buone e **quali sono state scartate e perché**. Un'importazione che scrive in
 * silenzio è il modo migliore per accorgersi di un errore a asta iniziata.
 */
function Anteprima<T>({
  lettura,
  quanti,
  nomeCose,
  esempio,
  inCorso,
  onConferma,
}: {
  lettura: Interpretazione<T>
  quanti: number
  nomeCose: string
  esempio: string[]
  inCorso: boolean
  onConferma: () => void
}) {
  const [mostraScarti, setMostraScarti] = useState(false)

  return (
    <div className="rounded-xl border border-verde-acceso/30 bg-verde-notte p-4">
      <p className="text-sm font-semibold text-nebbia">
        Ho letto <span className="cifre-fisse text-verde-acceso">{quanti}</span> {nomeCose}.
      </p>
      <p className="mt-1 text-xs text-fumo">
        Intestazioni trovate alla riga {lettura.rigaIntestazione}.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(lettura.colonne).map(([campo, colonna]) => (
          <div key={campo} className="flex justify-between gap-2">
            <dt className="text-fumo">{campo}</dt>
            <dd
              className={
                colonna.startsWith('—') ? 'text-right text-oro' : 'text-right font-medium text-nebbia'
              }
            >
              {colonna}
            </dd>
          </div>
        ))}
      </dl>

      {lettura.mancanti.length > 0 && (
        <p className="mt-3 rounded-lg border border-oro/30 bg-oro/10 px-3 py-2 text-xs text-oro">
          Colonne non trovate nel file: {lettura.mancanti.join(', ')}. I valori corrispondenti
          resteranno vuoti e nell&apos;app compariranno come trattino.
        </p>
      )}

      {esempio.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-fumo">Prime righe lette</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-xs text-nebbia">
            {esempio.map((r, i) => (
              <li key={i} className="truncate">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lettura.scartate.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMostraScarti((v) => !v)}
            className="text-xs font-semibold text-oro underline underline-offset-4"
          >
            {lettura.scartate.length} righe scartate: {mostraScarti ? 'nascondi' : 'guarda quali'}
          </button>
          {mostraScarti && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-auto text-xs text-fumo">
              {lettura.scartate.map((s, i) => (
                <li key={i} className="truncate">
                  riga {s.riga} · {s.motivo} · {s.contenuto}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4">
        <Bottone misura="grande" larghezzaPiena inCorso={inCorso} onClick={onConferma}>
          Conferma e importa
        </Bottone>
      </div>
    </div>
  )
}
