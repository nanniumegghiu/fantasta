import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { useAccesso } from '@/features/auth/ContestoAccesso'

export function PaginaLeghe() {
  const { nomeMostrato, utente, esci } = useAccesso()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-verde-campo bg-verde-notte/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <img src="/icona-512.png" alt="" width={36} height={36} className="size-9 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-nebbia">
              Ciao, {nomeMostrato ?? 'fantallenatore'}
            </p>
            <p className="truncate text-xs text-fumo">{utente?.email}</p>
          </div>
          <Bottone aspetto="fantasma" onClick={() => void esci()}>
            Esci
          </Bottone>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-nebbia">Le mie leghe</h1>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
          className="mt-6 rounded-3xl border border-verde-campo bg-verde-campo/40 p-6 text-center"
        >
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-verde-campo">
            <span aria-hidden className="text-2xl">
              🏆
            </span>
          </div>

          <h2 className="text-lg font-bold text-nebbia">Non sei ancora in nessuna lega</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fumo">
            Crea la tua lega e invita gli amici con un codice, oppure entra in una lega usando il
            codice che ti hanno mandato.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Bottone misura="grande" disabilitato>
              Crea una lega
            </Bottone>
            <Bottone aspetto="secondario" misura="grande" disabilitato>
              Entra con un codice
            </Bottone>
          </div>

          {/* Onesta': queste funzioni non esistono ancora e l'interfaccia lo dice,
              invece di far cliccare a vuoto. Vedi CLAUDE.md, regola 5. */}
          <p className="mt-4 text-xs text-fumo/70">
            Creazione e ingresso nelle leghe arrivano nel prossimo passo dello sviluppo.
          </p>
        </motion.section>
      </main>
    </div>
  )
}
