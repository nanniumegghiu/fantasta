import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { backendConfigurato } from '@/lib/supabase'
import { FornitoreAccesso, useAccesso } from '@/features/auth/ContestoAccesso'
import { PaginaAccesso } from '@/pages/PaginaAccesso'
import { PaginaLeghe } from '@/pages/PaginaLeghe'
import { PaginaBackendNonConfigurato } from '@/pages/PaginaBackendNonConfigurato'

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
  if (inCaricamento) return <Caricamento />
  if (!sessione) return <Navigate to="/accesso" replace />
  return <>{children}</>
}

/** Chi e' gia' dentro non deve rivedere la schermata di accesso. */
function SoloOspiti({ children }: { children: React.ReactNode }) {
  const { inCaricamento, sessione } = useAccesso()
  if (inCaricamento) return <Caricamento />
  if (sessione) return <Navigate to="/leghe" replace />
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
          <Rotte />
        </FornitoreAccesso>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
