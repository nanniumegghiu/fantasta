import { useState } from 'react'
import { Bottone } from '@/components/Bottone'
import { CampoNumero } from '@/components/CampoNumero'
import { SelettoreCalciatore } from '@/features/obiettivi/SelettoreCalciatore'
import {
  useAggiudicaOra,
  useAnnullaUltima,
  useApriProssimoLotto,
  useAssegnaRapido,
  usePassaLotto,
  usePausaAsta,
  type Asta,
  type BudgetSquadra,
  type Lotto,
} from './api'

/**
 * I poteri di conduzione, visibili **solo nella vista personale
 * dell'amministratore** e mai sullo schermo condiviso.
 *
 * Servono ai momenti che un'asta ha sempre: un calciatore che non vuole
 * nessuno, un solo pretendente, un nome battuto per sbaglio.
 */
export function PannelloAmministratore({
  idLega,
  asta,
  lotto,
  squadre,
  acquistati,
}: {
  idLega: string | undefined
  asta: Asta
  lotto: Lotto | null | undefined
  squadre: BudgetSquadra[]
  acquistati: Set<number>
}) {
  const apriProssimo = useApriProssimoLotto(idLega)
  const aggiudica = useAggiudicaOra(idLega)
  const passaLotto = usePassaLotto(idLega)
  const assegna = useAssegnaRapido(idLega)
  const annulla = useAnnullaUltima(idLega)
  const pausa = usePausaAsta(idLega)

  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [selettore, setSelettore] = useState(false)
  const [daAssegnare, setDaAssegnare] = useState<number | null>(null)
  const [aChi, setAChi] = useState<string>('')
  const [prezzo, setPrezzo] = useState(1)
  const [confermaAnnullo, setConfermaAnnullo] = useState(false)

  const dice = (e: { messaggio: string }) => setMessaggio(e.messaggio)
  const sbaglia = (e: Error) => setMessaggio(e.message)
  const inPausa = asta.status === 'paused'
  const automatica = asta.method !== 'chiamata'
  const massimoDiChi = squadre.find((s) => s.team_id === aChi)?.massimo_offribile ?? 1

  return (
    <section className="rounded-2xl border border-oro/40 bg-oro/5 p-4">
      <h2 className="text-base font-bold text-oro">Conduzione</h2>
      <p className="mt-0.5 mb-3 text-xs text-fumo">
        Lo vedi solo tu. Non compare sullo schermo condiviso.
      </p>

      {messaggio && (
        <p className="mb-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
          {messaggio}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {automatica && !lotto && asta.status === 'open' && (
          <Bottone
            misura="grande"
            inCorso={apriProssimo.isPending}
            onClick={() => apriProssimo.mutate(undefined, { onSuccess: dice, onError: sbaglia })}
          >
            {asta.method === 'random' ? 'Estrai il prossimo' : 'Apri il prossimo'}
          </Bottone>
        )}

        {lotto && lotto.current_bidder_team_id && (
          <Bottone
            aspetto="oro"
            inCorso={aggiudica.isPending}
            onClick={() => aggiudica.mutate(lotto.id, { onSuccess: dice, onError: sbaglia })}
          >
            Aggiudica adesso
          </Bottone>
        )}

        {lotto && !lotto.current_bidder_team_id && (
          <Bottone
            aspetto="secondario"
            inCorso={passaLotto.isPending}
            onClick={() => passaLotto.mutate(lotto.id, { onSuccess: dice, onError: sbaglia })}
          >
            Nessuno lo vuole: passa
          </Bottone>
        )}

        <Bottone
          aspetto="fantasma"
          inCorso={pausa.isPending}
          onClick={() => pausa.mutate(!inPausa, { onSuccess: dice, onError: sbaglia })}
        >
          {inPausa ? 'Riprendi' : 'Metti in pausa'}
        </Bottone>
      </div>

      {/* Assegnazione rapida: un solo pretendente, niente asta. */}
      <div className="mt-4 rounded-xl border border-verde-campo bg-verde-notte p-3">
        <p className="text-sm font-semibold text-nebbia">Assegna senza fare l&apos;asta</p>
        <p className="mt-0.5 text-xs text-fumo">
          Quando c&apos;è un solo pretendente e mettersi a rilanciare non ha senso.
        </p>

        {daAssegnare == null ? (
          <div className="mt-3">
            <Bottone aspetto="secondario" onClick={() => setSelettore(true)}>
              Scegli il calciatore
            </Bottone>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-nebbia">A quale squadra</span>
              <select
                value={aChi}
                onChange={(e) => setAChi(e.target.value)}
                className="h-11 rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm text-nebbia outline-none"
              >
                <option value="">Scegli…</option>
                {squadre.map((s) => (
                  <option key={s.team_id} value={s.team_id}>
                    {s.name} · max {s.massimo_offribile}
                  </option>
                ))}
              </select>
            </label>

            <CampoNumero
              etichetta="Prezzo"
              valore={prezzo}
              onChange={setPrezzo}
              minimo={1}
              massimo={Math.max(1, massimoDiChi)}
            />

            <div className="flex gap-2">
              <Bottone
                inCorso={assegna.isPending}
                disabilitato={!aChi}
                onClick={() =>
                  assegna.mutate(
                    { idCalciatore: daAssegnare, idSquadra: aChi, prezzo },
                    {
                      onSuccess: (e) => {
                        dice(e)
                        if (e.esito === 'ok') {
                          setDaAssegnare(null)
                          setAChi('')
                          setPrezzo(1)
                        }
                      },
                      onError: sbaglia,
                    },
                  )
                }
              >
                Assegna
              </Bottone>
              <Bottone aspetto="fantasma" onClick={() => setDaAssegnare(null)}>
                Annulla
              </Bottone>
            </div>
          </div>
        )}
      </div>

      {/* Annullamento: conferma esplicita, perché tocca crediti e rose. */}
      <div className="mt-3">
        {confermaAnnullo ? (
          <div className="rounded-xl border border-errore/40 bg-errore/10 p-3">
            <p className="text-sm text-nebbia">
              Annullo l&apos;ultima aggiudicazione: i crediti tornano indietro, lo slot si libera e
              il calciatore torna disponibile. Il registro conserva tutte e due le cose.
            </p>
            <div className="mt-3 flex gap-2">
              <Bottone
                aspetto="secondario"
                inCorso={annulla.isPending}
                onClick={() =>
                  annulla.mutate(undefined, {
                    onSuccess: (e) => {
                      dice(e)
                      setConfermaAnnullo(false)
                    },
                    onError: sbaglia,
                  })
                }
              >
                Sì, annulla
              </Bottone>
              <Bottone aspetto="fantasma" onClick={() => setConfermaAnnullo(false)}>
                Lascia stare
              </Bottone>
            </div>
          </div>
        ) : (
          <Bottone aspetto="fantasma" onClick={() => setConfermaAnnullo(true)}>
            Annulla l&apos;ultima aggiudicazione
          </Bottone>
        )}
      </div>

      {selettore && (
        <SelettoreCalciatore
          titolo="Chi vuoi assegnare"
          giaPresenti={acquistati}
          onChiudi={() => setSelettore(false)}
          onConferma={(ids) => {
            setDaAssegnare(ids[0] ?? null)
            setSelettore(false)
          }}
        />
      )}
    </section>
  )
}
