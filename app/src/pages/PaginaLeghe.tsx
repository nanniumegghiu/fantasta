import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Bottone } from '@/components/Bottone'
import { Intestazione } from '@/components/Intestazione'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import { useMieLeghe } from '@/features/leghe/api'
import { totaleSlot, type LegaCompleta } from '@/features/leghe/tipi'

export function PaginaLeghe() {
  const { nomeMostrato, utente, esci } = useAccesso()
  const { data: leghe, isPending, error, refetch } = useMieLeghe()

  return (
    <div className="min-h-dvh">
      <Intestazione
        conMarchio
        sottotitolo={nomeMostrato ? `Ciao, ${nomeMostrato}` : undefined}
        azione={
          <Bottone aspetto="fantasma" onClick={() => void esci()}>
            Esci
          </Bottone>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <h1 className="text-2xl font-extrabold tracking-tight text-nebbia">Le mie leghe</h1>

        {isPending && <Scheletro />}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm"
          >
            <p className="font-semibold text-errore">Non riesco a caricare le tue leghe.</p>
            <p className="mt-1 text-fumo">{error.message}</p>
            <div className="mt-4">
              <Bottone aspetto="secondario" onClick={() => void refetch()}>
                Riprova
              </Bottone>
            </div>
          </div>
        )}

        {leghe && leghe.length === 0 && <NessunaLega />}

        {leghe && leghe.length > 0 && (
          <ul className="mt-5 flex flex-col gap-3">
            {leghe.map((lega, i) => (
              <SchedaLega key={lega.id} lega={lega} idUtente={utente?.id} posizione={i} />
            ))}
          </ul>
        )}
      </main>

      {/* Barra fissa in basso: le due azioni principali restano sempre sotto il
          pollice, anche con l'elenco lungo. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-verde-campo bg-verde-notte/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link to="/leghe/nuova" className="flex-1">
            <Bottone misura="grande" larghezzaPiena>
              Crea una lega
            </Bottone>
          </Link>
          <Link to="/leghe/entra" className="flex-1">
            <Bottone aspetto="secondario" misura="grande" larghezzaPiena>
              Entra con un codice
            </Bottone>
          </Link>
        </div>
      </div>
    </div>
  )
}

function SchedaLega({
  lega,
  idUtente,
  posizione,
}: {
  lega: LegaCompleta
  idUtente: string | undefined
  posizione: number
}) {
  const miaSquadra = lega.teams.find((t) => t.user_id === idUtente)
  const sonoAdmin = lega.admin_user_id === idUtente
  const partecipanti = lega.league_members.length

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(posizione * 0.04, 0.2) }}
    >
      <Link
        to={`/lega/${lega.id}`}
        className="block rounded-2xl border border-verde-campo bg-verde-campo/40 p-4 transition-colors hover:border-verde-acceso/60"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-nebbia">{lega.name}</h2>
              <StatoLega stato={lega.status} />
              {sonoAdmin && (
                <span className="rounded-full bg-oro/20 px-2 py-0.5 text-[11px] font-semibold text-oro">
                  Amministri tu
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-fumo">
              Stagione {lega.season} · {partecipanti} di {lega.max_members} partecipanti
            </p>

            {miaSquadra && (
              <p className="mt-2 text-sm text-nebbia">
                La tua squadra: <span className="font-semibold">{miaSquadra.name}</span>
                <span className="cifre-fisse text-fumo">
                  {' '}
                  · {miaSquadra.credits_remaining} crediti · rosa da {totaleSlot(lega)}
                </span>
              </p>
            )}
          </div>

          <svg viewBox="0 0 24 24" fill="none" aria-hidden className="mt-1 size-5 shrink-0 text-fumo">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Link>
    </motion.li>
  )
}

function StatoLega({ stato }: { stato: LegaCompleta['status'] }) {
  const aspetto = {
    setup: { testo: 'In preparazione', classe: 'bg-verde-acceso/20 text-verde-acceso' },
    auction: { testo: 'Asta in corso', classe: 'bg-arancio/20 text-arancio' },
    done: { testo: 'Conclusa', classe: 'bg-fumo/20 text-fumo' },
  }[stato]

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${aspetto.classe}`}>
      {aspetto.testo}
    </span>
  )
}

function NessunaLega() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
      className="mt-6 rounded-3xl border border-verde-campo bg-verde-campo/40 p-6 text-center"
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-verde-campo text-2xl">
        <span aria-hidden>🏆</span>
      </div>
      <h2 className="text-lg font-bold text-nebbia">Non sei ancora in nessuna lega</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-fumo">
        Crea la tua lega e invita gli amici con un codice da mandare su WhatsApp, oppure entra in
        una lega con il codice che ti hanno girato.
      </p>
    </motion.section>
  )
}

function Scheletro() {
  return (
    <div className="mt-5 flex flex-col gap-3" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
      ))}
      <span className="sr-only">Caricamento delle leghe</span>
    </div>
  )
}
