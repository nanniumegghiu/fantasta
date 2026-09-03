import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { Ruolo } from '@/domain/listone'

export type CalciatoreDelloScambio = {
  id: number
  nome: string
  ruolo: Ruolo
  squadra: string
}

export type StatoScambio = 'proposto' | 'accettato' | 'rifiutato' | 'ritirato' | 'decaduto'

export type Scambio = {
  id: string
  league_id: string
  from_team_id: string
  to_team_id: string
  squadra_propone: string
  squadra_riceve: string
  /** Conguaglio dal proponente a chi riceve. Negativo vuol dire il contrario. */
  credits: number
  status: StatoScambio
  note: string | null
  created_at: string
  resolved_at: string | null
  danno: CalciatoreDelloScambio[]
  ricevono: CalciatoreDelloScambio[]
}

type Esito = { esito: string; messaggio: string; scambio?: string | null }

async function chiama<T>(funzione: string, argomenti: Record<string, unknown>): Promise<T> {
  const { data, error } = await richiediSupabase().rpc(funzione, argomenti)
  if (error) throw new Error(messaggioErrore(error))
  return (Array.isArray(data) ? data[0] : data) as T
}

/**
 * Tutti gli scambi della lega, i chiusi compresi.
 *
 * Non solo i propri: uno scambio cambia gli equilibri di tutti, e una lega in
 * cui si scambia di nascosto è una lega in cui si litiga. La stessa ragione
 * per cui il registro dell'asta lo leggono tutti.
 */
export function useScambi(idLega: string | undefined) {
  return useQuery({
    queryKey: ['scambi', idLega],
    enabled: Boolean(idLega),
    queryFn: async (): Promise<Scambio[]> => {
      const { data, error } = await richiediSupabase()
        .from('scambi')
        .select('*')
        .eq('league_id', idLega!)
        .order('created_at', { ascending: false })
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []) as unknown as Scambio[]
    },
  })
}

function useAzione<T>(idLega: string | undefined, azione: (v: T) => Promise<Esito>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: azione,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scambi', idLega] })
      // Uno scambio accettato muove rose e crediti: tutto quello che li mostra
      // va ricaricato, altrimenti resta a raccontare com'era prima.
      qc.invalidateQueries({ queryKey: ['rose', idLega] })
      qc.invalidateQueries({ queryKey: ['budget', idLega] })
    },
  })
}

export function useProponiScambio(idLega: string | undefined) {
  return useAzione<{
    aSquadra: string
    miei: number[]
    suoi: number[]
    crediti: number
    nota: string
  }>(idLega, (v) =>
    chiama<Esito>('proponi_scambio', {
      p_lega: idLega,
      p_a_squadra: v.aSquadra,
      p_miei_calciatori: v.miei,
      p_suoi_calciatori: v.suoi,
      p_crediti: v.crediti,
      p_nota: v.nota || null,
    }),
  )
}

/** Accettare, rifiutare e ritirare passano tutti di qui: il server sa chi sei. */
export function useRispondiScambio(idLega: string | undefined) {
  return useAzione<{ idScambio: string; accetto: boolean }>(idLega, (v) =>
    chiama<Esito>('rispondi_scambio', { p_scambio: v.idScambio, p_accetto: v.accetto }),
  )
}
