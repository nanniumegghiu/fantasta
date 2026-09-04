import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { backendConfigurato } from '@/lib/supabase'
import { FornitoreAccesso, useAccesso } from '@/features/auth/ContestoAccesso'
import { SeQualcosaEsplode } from '@/components/SeQualcosaEsplode'
import { PaginaAccesso } from '@/pages/PaginaAccesso'
import { PaginaLeghe } from '@/pages/PaginaLeghe'
import { PaginaBackendNonConfigurato } from '@/pages/PaginaBackendNonConfigurato'

// Le schermate meno frequenti si scaricano solo quando servono. Sullo schermo
// condiviso e sul telefono, la sera dell'asta, conta quanto codice arriva
// prima che la pagina sia usabile: l'importazione del listone non deve pesare
// sul caricamento di chi sta solo rilanciando.
const PaginaCreaLega = lazy(() =>
  import('@/pages/PaginaCreaLega').then((m) => ({ default: m.PaginaCreaLega })),
)
const PaginaEntraInLega = lazy(() =>
  import('@/pages/PaginaEntraInLega').then((m) => ({ default: m.PaginaEntraInLega })),
)
const PaginaLega = lazy(() => import('@/pages/PaginaLega').then((m) => ({ default: m.PaginaLega })))
const PaginaAsta = lazy(() => import('@/pages/PaginaAsta').then((m) => ({ default: m.PaginaAsta })))
const PaginaSchermoAsta = lazy(() =>
  import('@/pages/PaginaSchermoAsta').then((m) => ({ default: m.PaginaSchermoAsta })),
)
const PaginaObiettivi = lazy(() =>
  import('@/pages/PaginaObiettivi').then((m) => ({ default: m.PaginaObiettivi })),
)
const PaginaListone = lazy(() =>
  import('@/pages/PaginaListone').then((m) => ({ default: m.PaginaListone })),
)
const PaginaImportazione = lazy(() =>
  import('@/pages/PaginaImportazione').then((m) => ({ default: m.PaginaImportazione })),
)
const PaginaVolti = lazy(() =>
  import('@/pages/PaginaVolti').then((m) => ({ default: m.PaginaVolti })),
)
const PaginaSchermoTv = lazy(() =>
  import('@/pages/PaginaSchermoTv').then((m) => ({ default: m.PaginaSchermoTv })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Durante l'asta la connessione balla: si ritenta, ma non all'infinito.
      retry: 2,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
})

/**
 * Dove voleva andare l'utente prima di essere mandato all'accesso.
 *
 * Serve al caso concreto del link WhatsApp: si riceve /invito/ABC123, non si e'
 * ancora registrati, si fa l'accesso e ci si aspetta di finire nella lega, non
 * in una pagina qualsiasi. Senza questo si perderebbe il codice per strada.
 */
const CHIAVE_DESTINAZIONE = 'fantasta.destinazione'

function ricordaDestinazione(percorso: string) {
  try {
    sessionStorage.setItem(CHIAVE_DESTINAZIONE, percorso)
  } catch {
    // Finestra anonima o memoria del sito bloccata: si perde solo la comodita'.
  }
}

function raccogliDestinazione(): string | null {
  try {
    const v = sessionStorage.getItem(CHIAVE_DESTINAZIONE)
    if (v) sessionStorage.removeItem(CHIAVE_DESTINAZIONE)
    return v
  } catch {
    return null
  }
}

function Caricamento() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span
        aria-label="Caricamento"
        role="status"
        className="size-8 animate-spin rounded-full border-[3px] border-verde-acceso border-t-transparent"
      />
    </div>
  )
}

/**
 * Lascia passare solo chi ha una sessione **con un account**.
 *
 * PERCHE' UNA SESSIONE NON BASTA
 *
 * Per il televisore è acceso l'accesso anonimo di Supabase: la pagina della TV
 * entra come ospite per poter firmare gli indirizzi delle immagini. Quella
 * sessione però resta nel browser, nello stesso posto di tutte le altre, e per
 * Supabase un ospite ha il ruolo `authenticated` esattamente come chi si è
 * registrato.
 *
 * Risultato, prima di questa riga: chi aveva aperto una volta il link della TV
 * risultava «dentro» per sempre. Aprendo un invito entrava in lega **creando
 * una squadra senza account** — senza email, senza nome, senza modo di sapere
 * di chi fosse. È successo nella lega vera.
 *
 * Il server adesso rifiuta gli ospiti alle due porte d'ingresso, ed è lì che
 * la difesa conta. Questa riga serve a un'altra cosa: che chi arriva con una
 * sessione da ospite veda la schermata d'accesso invece di un'applicazione
 * che sembra funzionare e poi rifiuta tutto.
 */
function SoloAutenticati({ children }: { children: React.ReactNode }) {
  const { inCaricamento, sessione } = useAccesso()
  const posizione = useLocation()

  const ospite = sessione?.user?.is_anonymous === true

  if (inCaricamento) return <Caricamento />
  if (!sessione || ospite) {
    ricordaDestinazione(posizione.pathname + posizione.search)
    return <Navigate to="/accesso" replace />
  }
  return <>{children}</>
}

/**
 * Chi e' gia' dentro non deve rivedere la schermata di accesso.
 *
 * Ma una sessione da ospite — quella del televisore — qui non conta, e se
 * contasse sarebbe una trappola: rimbalzerebbe alle leghe chi sta cercando di
 * fare l'accesso vero, e da lì `SoloAutenticati` lo rimanderebbe qui. Due
 * porte che si rimandano a vicenda sono un'applicazione da cui non si entra.
 */
function SoloOspiti({ children }: { children: React.ReactNode }) {
  const { inCaricamento, sessione } = useAccesso()
  const conAccount = sessione && sessione.user?.is_anonymous !== true

  if (inCaricamento) return <Caricamento />
  if (conAccount) return <Navigate to={raccogliDestinazione() ?? '/leghe'} replace />
  return <>{children}</>
}

function Rotte() {
  return (
    <Routes>
      <Route
        path="/accesso"
        element={
          <SoloOspiti>
            <PaginaAccesso />
          </SoloOspiti>
        }
      />

      <Route
        path="/leghe"
        element={
          <SoloAutenticati>
            <PaginaLeghe />
          </SoloAutenticati>
        }
      />
      <Route
        path="/leghe/nuova"
        element={
          <SoloAutenticati>
            <PaginaCreaLega />
          </SoloAutenticati>
        }
      />
      <Route
        path="/leghe/entra"
        element={
          <SoloAutenticati>
            <PaginaEntraInLega />
          </SoloAutenticati>
        }
      />
      {/* Il link che gira su WhatsApp. Il codice arriva gia' scritto. */}
      <Route
        path="/invito/:codice"
        element={
          <SoloAutenticati>
            <PaginaEntraInLega />
          </SoloAutenticati>
        }
      />
      <Route
        path="/lega/:id"
        element={
          <SoloAutenticati>
            <PaginaLega />
          </SoloAutenticati>
        }
      />

      <Route
        path="/lega/:id/asta"
        element={
          <SoloAutenticati>
            <PaginaAsta />
          </SoloAutenticati>
        }
      />
      {/* Lo schermo condiviso è una pagina a sé: non mostra nessun dato
          privato, nemmeno di chi l'ha aperta. */}
      <Route
        path="/lega/:id/asta/schermo"
        element={
          <SoloAutenticati>
            <PaginaSchermoAsta />
          </SoloAutenticati>
        }
      />

      <Route
        path="/lega/:id/obiettivi"
        element={
          <SoloAutenticati>
            <PaginaObiettivi />
          </SoloAutenticati>
        }
      />

      <Route
        path="/listone"
        element={
          <SoloAutenticati>
            <PaginaListone />
          </SoloAutenticati>
        }
      />
      <Route
        path="/importazione"
        element={
          <SoloAutenticati>
            <PaginaImportazione />
          </SoloAutenticati>
        }
      />
      {/* La revisione dei volti: la schermata dice da sola a chi non
          amministra che non deve fare niente. */}
      <Route
        path="/volti"
        element={
          <SoloAutenticati>
            <PaginaVolti />
          </SoloAutenticati>
        }
      />

      {/* Lo schermo per il televisore: e' l'unica rotta senza accesso, e ci
          sta perche' il codice di sei caratteri e' la chiave, e perche'
          digitare una password col telecomando e' una serata rovinata. Non
          mostra dati privati di nessuno: quello che si vede da qui lo decide
          una funzione sola, `schermo_tv`. */}
      <Route path="/tv/:codice" element={<PaginaSchermoTv />} />

      <Route path="*" element={<Navigate to="/leghe" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!backendConfigurato) return <PaginaBackendNonConfigurato />

  return (
    <QueryClientProvider client={queryClient}>
      {/* Il percorso base lo decide la compilazione: senza, aprendo
          /fantasta/leghe il router cercherebbe la rotta «/fantasta/leghe»
          e non la troverebbe. */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        {/* La rete sta **dentro** il router e fuori dalle rotte: dentro,
            perché il tasto «torna alle leghe» deve poter navigare; fuori dalle
            rotte, perché un errore in una qualsiasi schermata non deve poter
            svuotare la pagina. */}
        <SeQualcosaEsplode>
          <FornitoreAccesso>
            <Suspense fallback={<Caricamento />}>
              <Rotte />
            </Suspense>
          </FornitoreAccesso>
        </SeQualcosaEsplode>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
