import { useMutation, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'

type Esito = { esito: string; messaggio: string }

async function chiama(funzione: string, argomenti: Record<string, unknown>): Promise<Esito> {
  const { data, error } = await richiediSupabase().rpc(funzione, argomenti)
  if (error) throw new Error(messaggioErrore(error))
  return (Array.isArray(data) ? data[0] : data) as Esito
}

/**
 * Ricarica tutto quello che cambia quando una squadra passa di mano.
 *
 * Sono più cose di quante sembrino: la lega con i suoi partecipanti, le
 * squadre con i loro proprietari, il budget e il registro. Dimenticarne una
 * lascerebbe la schermata a raccontare com'era prima, che è il modo più
 * veloce di far dubitare che l'azione sia riuscita.
 */
function useAzione<T>(idLega: string | undefined, azione: (v: T) => Promise<Esito>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: azione,
    onSuccess: () => {
      for (const chiave of ['lega', 'budget', 'rose', 'registro', 'asta', 'squadre-libere']) {
        qc.invalidateQueries({ queryKey: [chiave, idLega] })
      }
      qc.invalidateQueries({ queryKey: ['leghe'] })
    },
  })
}

/**
 * Riapre un'asta chiusa.
 *
 * Esiste perché il suo contrario esisteva già e questo no: un'asta chiusa per
 * sbaglio bloccava la lega senza nessun modo di rimediare. Ogni azione che
 * chiude una porta deve avere il suo contrario, o non è un'azione, è una
 * trappola.
 */
export function useRiapriAsta(idLega: string | undefined) {
  return useAzione<string>(idLega, (motivo) =>
    chiama('riapri_asta', { p_lega: idLega, p_motivo: motivo }),
  )
}

/** Toglie un partecipante dalla lega lasciando la sua squadra dov'è. */
export function useLiberaSquadra(idLega: string | undefined) {
  return useAzione<{ idSquadra: string; motivo: string }>(idLega, (v) =>
    chiama('libera_squadra', { p_lega: idLega, p_squadra: v.idSquadra, p_motivo: v.motivo }),
  )
}

/** Affida una squadra rimasta senza nessuno a chi ha già un account. */
export function useAffidaSquadra(idLega: string | undefined) {
  return useAzione<{ idSquadra: string; email: string }>(idLega, (v) =>
    chiama('affida_squadra', { p_lega: idLega, p_squadra: v.idSquadra, p_email: v.email }),
  )
}
