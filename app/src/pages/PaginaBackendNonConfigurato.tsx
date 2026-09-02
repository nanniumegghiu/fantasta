/**
 * Schermata mostrata quando mancano le variabili d'ambiente del backend.
 *
 * Esiste per la regola "niente bugie all'utente": senza di essa l'app
 * mostrerebbe il modulo di accesso e ogni tentativo fallirebbe con un errore
 * incomprensibile. Meglio dire subito cosa manca e come si sistema.
 */
export function PaginaBackendNonConfigurato() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-oro/40 bg-verde-campo/40 p-6">
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="text-2xl">
            🔧
          </span>
          <h1 className="text-xl font-extrabold text-nebbia">Fantasta non è ancora collegata</h1>
        </div>

        <p className="text-sm text-fumo">
          Mancano le due chiavi del backend. Finché non ci sono, l&apos;accesso non può funzionare,
          quindi non lo mostriamo.
        </p>

        <ol className="mt-5 flex flex-col gap-3 text-sm text-nebbia">
          <li>
            <span className="font-semibold text-oro">1.</span> Crea il file{' '}
            <code className="rounded bg-verde-notte px-1.5 py-0.5 text-xs">app/.env.local</code>{' '}
            copiando <code className="rounded bg-verde-notte px-1.5 py-0.5 text-xs">app/.env.example</code>.
          </li>
          <li>
            <span className="font-semibold text-oro">2.</span> Nel pannello Supabase apri il
            progetto, poi <em>Project Settings</em> e <em>API</em>.
          </li>
          <li>
            <span className="font-semibold text-oro">3.</span> Copia <em>Project URL</em> e la
            chiave <em>anon public</em> nelle due righe del file.
          </li>
          <li>
            <span className="font-semibold text-oro">4.</span> Riavvia il server di sviluppo.
          </li>
        </ol>

        <p className="mt-5 text-xs text-fumo/80">
          Le due chiavi sono di categoria pubblica: sono progettate per stare nel browser. La
          protezione dei dati viene dalle regole di accesso del database.
        </p>
      </div>
    </div>
  )
}
