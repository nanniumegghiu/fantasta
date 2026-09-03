import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import type { Ruolo } from '@/domain/listone'

export type VoltoDaRivedere = {
  id: number
  season: string
  name: string
  role: Ruolo
  serie_a_team: string
  quotation: number
  photo_path: string | null
  fm_id: number | null
  fm_origine: 'scaricata' | 'dedotta' | 'confermata' | null
  /** `manca` si risolve caricando, `da_controllare` guardando. */
  motivo: 'manca' | 'da_controllare'
}

/**
 * I calciatori su cui vale la pena passare a mano.
 *
 * Non tutti: quelli **senza volto** e quelli il cui volto è stato **dedotto
 * dal solo cognome**. Gli abbinamenti nati incrociando cognome e squadra sono
 * affidabili; i dedotti no, ed è lì che può esserci la faccia di un altro.
 *
 * Scorrere cinquecento calciatori per trovarne novanta è il modo migliore per
 * non farlo mai.
 */
export function useVoltiDaRivedere(stagione: string | undefined) {
  return useQuery({
    queryKey: ['volti-da-rivedere', stagione],
    enabled: Boolean(stagione),
    queryFn: async (): Promise<VoltoDaRivedere[]> => {
      const { data, error } = await richiediSupabase()
        .from('volti_da_rivedere')
        .select('*')
        .eq('season', stagione!)
        .order('quotation', { ascending: false })
      if (error) throw new Error(messaggioErrore(error))
      return (data ?? []) as unknown as VoltoDaRivedere[]
    },
  })
}

function useAzione<T>(azione: (v: T) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: azione,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['volti-da-rivedere'] })
      // Il listone porta `photo_path`, e gli indirizzi firmati si ricavano da
      // lì: senza questo, la faccia appena caricata non comparirebbe da
      // nessuna parte fino al prossimo ricaricamento della pagina.
      qc.invalidateQueries({ queryKey: ['listone'] })
      qc.invalidateQueries({ queryKey: ['volti'] })
    },
  })
}

/**
 * Carica un'immagine per un calciatore e la registra come **confermata**.
 *
 * Confermata perché l'ha scelta una persona guardando: da quel momento nessun
 * giro automatico la sovrascrive. È la regola scritta nella migrazione 0022, e
 * il motivo per cui questa schermata vale la pena di esistere.
 */
export function useCaricaVolto() {
  return useAzione<{ calciatore: number; stagione: string; file: File }>(async (v) => {
    const sb = richiediSupabase()
    const estensione = v.file.type === 'image/jpeg' ? 'jpg' : v.file.type === 'image/webp' ? 'webp' : 'png'
    const percorso = `${v.stagione}/${v.calciatore}.${estensione}`

    const { error: erroreArchivio } = await sb.storage
      .from('volti')
      .upload(percorso, v.file, { upsert: true, contentType: v.file.type })
    if (erroreArchivio) throw new Error(messaggioErrore(erroreArchivio))

    // Solo dopo che l'immagine c'è davvero: scrivere prima il percorso
    // lascerebbe il database a indicare un file che non esiste se il
    // caricamento fallisse.
    const { error } = await sb.rpc('imposta_volto', {
      p_player_id: v.calciatore,
      p_fm_id: null,
      p_percorso: percorso,
      p_origine: 'confermata',
    })
    if (error) throw new Error(messaggioErrore(error))
  })
}

/** «Questa faccia è giusta»: non la si tocca più. */
export function useConfermaVolto() {
  return useAzione<number>(async (calciatore) => {
    const { error } = await richiediSupabase().rpc('conferma_volto', { p_player_id: calciatore })
    if (error) throw new Error(messaggioErrore(error))
  })
}

/** «Questa faccia è di un altro»: via, e non torna al prossimo giro. */
export function useTogliVolto() {
  return useAzione<number>(async (calciatore) => {
    const { error } = await richiediSupabase().rpc('togli_volto', { p_player_id: calciatore })
    if (error) throw new Error(messaggioErrore(error))
  })
}
