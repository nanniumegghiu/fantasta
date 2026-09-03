import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bottone } from '@/components/Bottone'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'

type Codice = { codice: string; scade: string }

async function chiama<T>(funzione: string, argomenti: Record<string, unknown>): Promise<T> {
  const { data, error } = await richiediSupabase().rpc(funzione, argomenti)
  if (error) throw new Error(messaggioErrore(error))
  return (Array.isArray(data) ? data[0] : data) as T
}

function useCodiceTv(idLega: string | undefined) {
  return useQuery({
    queryKey: ['codice-tv', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<Codice | null> =>
      (await chiama<Codice | null>('codice_tv_corrente', { p_lega: idLega })) ?? null,
  })
}

/**
 * Il codice con cui il televisore apre lo schermo condiviso.
 *
 * PERCHE' ESISTE
 * Con un solo telefono non si può proiettare lo schermo e fare la propria asta
 * insieme: duplicare lo schermo manda sul televisore quello che c'è sul
 * telefono. Deve essere la TV ad aprire la pagina — e digitare col telecomando
 * un indirizzo con dentro l'identificativo della lega, e poi email e password,
 * è una serata rovinata prima di cominciare.
 *
 * PERCHE' L'INDIRIZZO E' SCRITTO GRANDE E A PEZZI
 * Chi digita guarda il telefono e preme sul telecomando, alternando lo sguardo.
 * Il codice sta staccato dal resto, in caratteri a larghezza fissa e spaziati,
 * perché è la parte che si sbaglia: l'indirizzo prima è sempre lo stesso e si
 * impara alla seconda volta.
 */
export function CodiceTv({ idLega }: { idLega: string | undefined }) {
  const qc = useQueryClient()
  const { data: codice, isPending } = useCodiceTv(idLega)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [copiato, setCopiato] = useState(false)

  const genera = useMutation({
    mutationFn: () =>
      chiama<{ esito: string; messaggio: string }>('crea_codice_tv', {
        p_lega: idLega,
        p_ore: 12,
      }),
    onSuccess: (e) => {
      setMessaggio(e.messaggio)
      qc.invalidateQueries({ queryKey: ['codice-tv', idLega] })
    },
    onError: (e: Error) => setMessaggio(e.message),
  })

  const revoca = useMutation({
    mutationFn: () =>
      chiama<{ esito: string; messaggio: string }>('revoca_codice_tv', { p_lega: idLega }),
    onSuccess: (e) => {
      setMessaggio(e.messaggio)
      qc.invalidateQueries({ queryKey: ['codice-tv', idLega] })
    },
    onError: (e: Error) => setMessaggio(e.message),
  })

  const base = `${window.location.origin}${import.meta.env.BASE_URL}tv/`
  const indirizzo = codice ? `${base}${codice.codice}` : null

  async function copia() {
    if (!indirizzo) return
    try {
      await navigator.clipboard.writeText(indirizzo)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2000)
    } catch {
      setMessaggio('Il browser non mi lascia copiare: scrivilo a mano, è corto apposta.')
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-verde-campo bg-verde-notte p-3">
      <p className="text-sm font-semibold text-nebbia">Lo schermo sul televisore</p>
      <p className="mt-0.5 text-xs text-fumo">
        Apri questo indirizzo dal browser della TV. Non chiede nessun accesso, e mostra solo quello
        che vedono tutti: niente obiettivi, niente tetti di spesa.
      </p>

      {isPending ? (
        <div className="mt-3 h-16 animate-pulse rounded-lg bg-verde-campo/40" />
      ) : codice ? (
        <>
          <div className="mt-3 rounded-lg bg-verde-campo/50 p-3 text-center">
            <p className="text-sm text-fumo">{base}</p>
            <p className="cifre-fisse mt-1 text-3xl font-extrabold tracking-[0.3em] text-oro">
              {codice.codice}
            </p>
          </div>

          <p className="mt-2 text-xs text-fumo">
            Vale fino alle{' '}
            {new Date(codice.scade).toLocaleString('it-IT', {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            . Dopo non apre più niente.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Bottone aspetto="secondario" onClick={() => void copia()}>
              {copiato ? 'Copiato' : 'Copia il link'}
            </Bottone>
            <Bottone aspetto="fantasma" inCorso={genera.isPending} onClick={() => genera.mutate()}>
              Genera un codice nuovo
            </Bottone>
            <Bottone aspetto="fantasma" inCorso={revoca.isPending} onClick={() => revoca.mutate()}>
              Revoca
            </Bottone>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <Bottone aspetto="secondario" inCorso={genera.isPending} onClick={() => genera.mutate()}>
            Genera il codice per la TV
          </Bottone>
        </div>
      )}

      {messaggio && <p className="mt-2 text-xs text-nebbia">{messaggio}</p>}
    </div>
  )
}
