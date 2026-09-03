import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MarchioFantasta } from '@/components/MarchioFantasta'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import { SchermoAsta } from './PaginaSchermoAsta'
import type { AcquistoInRosa, Asta, BudgetSquadra, Lotto } from '@/features/asta/api'

/**
 * Lo schermo condiviso su un televisore, aperto con un codice di sei caratteri.
 *
 * PERCHE' ESISTE
 * Con un solo telefono non si può proiettare lo schermo e nello stesso tempo
 * fare la propria asta: duplicare lo schermo manda sul televisore quello che
 * c'è sul telefono. La strada giusta è che sia la TV ad aprire la pagina — ma
 * digitare un indirizzo con dentro un identificativo di trentasei caratteri, e
 * poi email e password, col telecomando, è una serata rovinata prima di
 * cominciare.
 *
 * QUATTRO SCELTE, TUTTE DETTATE DAL TELECOMANDO
 *
 * 1. **Sei caratteri**, dallo stesso alfabeto dei codici d'invito: niente O,
 *    0, I, 1, che al telecomando si sbagliano sempre.
 * 2. **Nessun accesso da digitare.** La pagina entra da sola come visitatore
 *    anonimo, che serve solo a poter chiedere le immagini; i dati dell'asta
 *    arrivano da una funzione che controlla il codice per conto suo.
 * 3. **Si interroga a intervalli, non in tempo reale.** Un visitatore anonimo
 *    non è un partecipante e non può ascoltare il canale della lega. Ogni
 *    secondo e mezzo è più che sufficiente: il countdown si calcola comunque
 *    dall'istante dell'ultimo rilancio, non dal ritmo delle richieste.
 * 4. **Se il codice è sbagliato o scaduto lo dice grande**, perché chi guarda
 *    è a tre metri e ha in mano un telecomando, non una tastiera.
 */

const OGNI = 1500

type Risposta = {
  valido: boolean
  adesso?: string
  lega?: {
    nome: string
    stagione: string
    slots_p: number
    slots_d: number
    slots_c: number
    slots_a: number
    min_bid: number
  }
  asta?: Asta | null
  lotto?: Lotto | null
  squadre?: BudgetSquadra[]
  rose?: AcquistoInRosa[]
  stemmi?: Record<string, string>
}

/**
 * L'accesso anonimo, fatto una volta e ricordato dal browser.
 *
 * Non serve a leggere l'asta — quella la dà la funzione col codice — ma a
 * poter chiedere le immagini dei calciatori, che stanno in un archivio
 * riservato a chi usa l'applicazione. Senza, il televisore mostrerebbe le
 * iniziali al posto delle facce, che è proprio quello che sul grande schermo
 * si voleva evitare.
 */
function useAccessoAnonimo() {
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    const sb = richiediSupabase()

    void (async () => {
      const { data } = await sb.auth.getSession()
      if (!data.session) {
        // Se fallisce non è grave: si va avanti senza immagini, e la ricaduta
        // sulle iniziali è già disegnata.
        await sb.auth.signInAnonymously().catch(() => undefined)
      }
      if (vivo) setPronto(true)
    })()

    return () => {
      vivo = false
    }
  }, [])

  return pronto
}

export function PaginaSchermoTv() {
  const { codice } = useParams()
  const accessoPronto = useAccessoAnonimo()
  const [scarto, setScarto] = useState(0)

  const { data, error, isPending } = useQuery({
    queryKey: ['schermo-tv', codice],
    enabled: Boolean(codice),
    refetchInterval: OGNI,
    // Il televisore resta acceso tutta la serata senza che nessuno lo tocchi:
    // deve continuare a chiedere anche quando la pagina non ha il fuoco.
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<Risposta> => {
      const { data, error } = await richiediSupabase().rpc('schermo_tv', {
        p_codice: (codice ?? '').toUpperCase(),
      })
      if (error) throw new Error(messaggioErrore(error))
      return data as Risposta
    },
  })

  // Lo scarto fra l'orologio del televisore e quello del server: senza, un
  // televisore avanti di dieci secondi mostrerebbe un countdown sbagliato.
  // Vedi ADR-0005.
  useEffect(() => {
    if (!data?.adesso) return
    setScarto(new Date(data.adesso).getTime() - Date.now())
  }, [data?.adesso])

  if (isPending || !accessoPronto) {
    return <Avviso titolo="Un attimo…" />
  }

  if (error) {
    return (
      <Avviso
        titolo="Non riesco a collegarmi"
        dettaglio="Controlla che il televisore sia connesso a internet."
      />
    )
  }

  if (!data?.valido) {
    return (
      <Avviso
        titolo="Codice non valido"
        dettaglio={
          `Il codice «${(codice ?? '').toUpperCase()}» non apre nessuno schermo. ` +
          'Può essere scaduto: chiedi a chi conduce di generarne uno nuovo.'
        }
      />
    )
  }

  return (
    <SchermoAsta
      lega={data.lega ? { ...data.lega, name: data.lega.nome } : null}
      asta={data.asta ?? null}
      lotto={data.lotto ?? null}
      budget={data.squadre ?? []}
      rose={data.rose ?? []}
      // Il pallino verde dice «i dati arrivano», e qui arrivano davvero:
      // se non arrivassero, saremmo nel ramo dell'errore qui sopra.
      connesso
      scarto={scarto}
    />
  )
}

function Avviso({ titolo, dettaglio }: { titolo: string; dettaglio?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-verde-notte px-10 text-center">
      <MarchioFantasta className="text-6xl" />
      <p className="text-5xl font-extrabold text-nebbia">{titolo}</p>
      {dettaglio && <p className="max-w-3xl text-3xl text-fumo">{dettaglio}</p>}
    </div>
  )
}
