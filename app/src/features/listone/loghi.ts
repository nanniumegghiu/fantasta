import { useQuery } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { messaggioErrore } from '@/lib/messaggioErrore'
import { stagioneDelListone, useListone } from './api'

/**
 * Gli stemmi delle squadre di Serie A, con l'indirizzo già firmato.
 *
 * PERCHE' SONO VENTI E NON CINQUECENTO
 * Lo stemma appartiene alla squadra, non ai suoi venticinque calciatori: una
 * richiesta sola porta tutta la Serie A, e la stessa immagine serve venticinque
 * righe di listone. È il motivo per cui stanno in una tabella loro e non in una
 * colonna su `players`.
 *
 * Per il resto vale quello che vale per i volti: archivio privato perché le
 * immagini sono di terzi, indirizzi firmati tutti insieme perché un tag `<img>`
 * non sa mandare l'autenticazione, e una durata di due ore che copre una serata
 * rinnovandosi da sola.
 */
const DURATA_FIRMA = 2 * 60 * 60

type RigaLogo = { serie_a_team: string; logo_path: string | null }

export function useLoghi() {
  const { data: listone } = useListone()
  const stagione = listone ? stagioneDelListone(listone) : null

  const { data } = useQuery({
    queryKey: ['loghi', stagione],
    enabled: Boolean(stagione),
    staleTime: (DURATA_FIRMA - 600) * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const sb = richiediSupabase()
      const mappa = new Map<string, string>()

      const { data: righe, error } = await sb
        .from('club_logos')
        .select('serie_a_team,logo_path')
        .eq('season', stagione!)
      if (error) throw new Error(messaggioErrore(error))

      const percorsi = (righe ?? [])
        .map((r) => (r as RigaLogo).logo_path)
        .filter((p): p is string => Boolean(p))
      if (percorsi.length === 0) return mappa

      const { data: firmati } = await sb.storage
        .from('loghi')
        .createSignedUrls(percorsi, DURATA_FIRMA)

      const perPercorso = new Map((firmati ?? []).map((f) => [f.path, f.signedUrl]))
      for (const r of (righe ?? []) as RigaLogo[]) {
        const indirizzo = r.logo_path ? perPercorso.get(r.logo_path) : null
        // Una squadra senza stemma non è un errore: tre su venti non ce
        // l'hanno perché in Football Manager non sono in Serie A.
        if (indirizzo) mappa.set(r.serie_a_team, indirizzo)
      }
      return mappa
    },
  })

  return (squadra: string | null | undefined): string | null =>
    squadra ? (data?.get(squadra) ?? null) : null
}
