import { useQuery } from '@tanstack/react-query'
import { richiediSupabase } from '@/lib/supabase'
import { useListone } from './api'

/**
 * Gli indirizzi firmati per i volti dei calciatori.
 *
 * PERCHE' FIRMATI E NON PUBBLICI
 * Le immagini vengono da un facepack di Football Manager: sono opera di terzi,
 * distribuite per l'uso personale dentro il gioco (ADR-0011, dichiarato e
 * accettato). L'archivio resta privato, e le vede chi ha fatto l'accesso
 * all'applicazione, non il primo che passa.
 *
 * PERCHE' TUTTI INSIEME E NON UNO ALLA VOLTA
 * Un tag `<img>` non sa mandare l'intestazione di autenticazione, quindi ogni
 * immagine ha bisogno di un indirizzo già firmato. Firmarli uno per uno
 * vorrebbe dire quattrocento richieste all'apertura del listone: si firmano
 * tutti in una chiamata sola, e il risultato resta in memoria per un'ora.
 *
 * PERCHE' UN'ORA
 * Un'asta dura tre ore e la firma scade a due: si rinnova da sola a metà
 * serata senza che nessuno se ne accorga. Metterla a dodici ore non
 * aggiungerebbe niente e allungherebbe la vita di un indirizzo che, una volta
 * copiato, non chiede più l'accesso a nessuno.
 */
const DURATA_FIRMA = 2 * 60 * 60 // due ore

export function useVolti() {
  const { data: listone } = useListone()

  const percorsi = (listone ?? [])
    .map((c) => c.photo_path)
    .filter((p): p is string => Boolean(p))

  const { data } = useQuery({
    queryKey: ['volti', percorsi.length],
    enabled: percorsi.length > 0,
    // Un po' meno della durata della firma: si rinnova prima di scadere,
    // invece di mostrare immagini rotte e poi rimediare.
    staleTime: (DURATA_FIRMA - 600) * 1000,
    queryFn: async (): Promise<Map<string, string>> => {
      const sb = richiediSupabase()
      const mappa = new Map<string, string>()

      // A blocchi: una richiesta con quattrocento percorsi passa, ma con un
      // listone di un campionato piu' grande non e' detto.
      const passo = 500
      for (let i = 0; i < percorsi.length; i += passo) {
        const { data, error } = await sb.storage
          .from('volti')
          .createSignedUrls(percorsi.slice(i, i + passo), DURATA_FIRMA)
        // Un volto che non si firma non è un errore da mostrare: la schermata
        // ha già il suo ripiego, che è l'iniziale del nome.
        if (error) continue
        for (const r of data ?? []) {
          if (r.path && r.signedUrl) mappa.set(r.path, r.signedUrl)
        }
      }
      return mappa
    },
  })

  /** L'indirizzo del volto, o null se quel calciatore non ce l'ha. */
  return (percorso: string | null | undefined): string | null =>
    percorso ? (data?.get(percorso) ?? null) : null
}
