import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { backendConfigurato } from '@/lib/supabase'
import { FornitoreAccesso, useAccesso } from '@/features/auth/ContestoAccesso'
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
const PaginaObiettivi = lazy(() =>
  import('@/pages/PaginaObiettivi').then((m) => ({ default: m.PaginaObiettivi })),
)
const PaginaListone = lazy(() =>
  import('@/pages/PaginaListone').then((m) => ({ default: m.PaginaListone })),
)
const PaginaImportazione = lazy(() =>
  import('@/pages/PaginaImportazione').then((m) => ({ default: m.PaginaImportazione })),
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

/** Lascia passare solo chi ha una sessione. Il resto torna all'accesso. */
function SoloAutenticati({ children }: { children: React.ReactNode }) {
  const { inCaricamento, sessione } = useAccesso()
  const posizione = useLocation()

  if (inCaricamento) return <Caricamento />
  if (!sessione) {
    ricordaDestinazione(posizione.pathname + posizione.search)
    return <Navigate to="/accesso" replace />
  }
  return <>{children}</>
}

/** Chi e' gia' dentro non deve rivedere la schermata di accesso. */
function SoloOspiti({ children }: { children: React.ReactNode }) {
  const { inCaricamento, sessione } = useAccesso()

  if (inCaricamento) return <Caricamento />
  if (sessione) return <Navigate to={raccogliDestinazione() ?? '/leghe'} replace />
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

      <Route path="*" element={<Navigate to="/leghe" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!backendConfigurato) return <PaginaBackendNonConfigurato />

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FornitoreAccesso>
          <Suspense fallback={<Caricamento />}>
            <Rotte />
          </Suspense>
        </FornitoreAccesso>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
