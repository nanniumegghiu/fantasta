import { useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { CampoNumero } from '@/components/CampoNumero'
import { SelettoreCalciatore } from '@/features/obiettivi/SelettoreCalciatore'
import { CorreggiRose } from './CorreggiRose'
import {
  useAggiudicaOra,
  useAnnullaUltima,
  useApriLottoScelto,
  useApriProssimoLotto,
  useAssegnaRapido,
  useChiudiAsta,
  usePassaLotto,
  usePausaAsta,
  type AcquistoInRosa,
  type Asta,
  type BudgetSquadra,
  type Lotto,
} from './api'

/**
 * I poteri di conduzione, visibili **solo nella vista personale
 * dell'amministratore** e mai sullo schermo condiviso.
 *
 * COME SONO DISPOSTI, E PERCHE'
 *
 * Chi conduce è anche uno che gioca. Prima questi comandi occupavano mezza
 * schermata sempre, e la sua asta finiva schiacciata sotto pulsanti che gli
 * servono tre volte in una serata. Parole dell'utente: «la visuale
 * dell'amministratore privata è troppo sacrificata a causa dei comandi di
 * gestione asta».
 *
 * Quindi due piani. **Sopra, sempre visibile, solo l'azione del momento**:
 * aggiudicare quando c'è un'offerta, passare quando non c'è nessuno, estrarre
 * quando non c'è nessuno in asta. È una alla volta, ed è quella che serve
 * adesso. **Sotto, a scomparsa, tutto il resto**: le cose che si fanno di rado
 * e con calma.
 *
 * Nascondere anche l'azione del momento sarebbe stato più pulito da guardare e
 * peggio da usare: costringerebbe ad aprire un pannello ogni volta che la
 * stanza aspetta una decisione.
 */
export function PannelloAmministratore({
  idLega,
  asta,
  lotto,
  squadre,
  acquistati,
  rose,
}: {
  idLega: string | undefined
  asta: Asta
  lotto: Lotto | null | undefined
  squadre: BudgetSquadra[]
  acquistati: Set<number>
  rose: AcquistoInRosa[]
}) {
  const apriProssimo = useApriProssimoLotto(idLega)
  const apriScelto = useApriLottoScelto(idLega)
  const aggiudica = useAggiudicaOra(idLega)
  const passaLotto = usePassaLotto(idLega)
  const assegna = useAssegnaRapido(idLega)
  const annulla = useAnnullaUltima(idLega)
  const chiudiAsta = useChiudiAsta(idLega)
  const pausa = usePausaAsta(idLega)

  const [aperto, setAperto] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [selettore, setSelettore] = useState<'assegna' | 'riempi' | null>(null)
  const [daAssegnare, setDaAssegnare] = useState<number | null>(null)
  const [aChi, setAChi] = useState<string>('')
  const [prezzo, setPrezzo] = useState(1)
  const [confermaAnnullo, setConfermaAnnullo] = useState(false)
  const [confermaChiusura, setConfermaChiusura] = useState(false)

  const dice = (e: { messaggio: string }) => setMessaggio(e.messaggio)
  const sbaglia = (e: Error) => setMessaggio(e.message)
  const inPausa = asta.status === 'paused'
  const automatica = asta.method !== 'chiamata'
  const massimoDiChi = squadre.find((s) => s.team_id === aChi)?.massimo_offribile ?? 1
  const slotVuoti = squadre.reduce((n, s) => n + s.slot_rimanenti, 0)

  // Senza nessuno in asta e con l'asta aperta si è in uno di due momenti: o
  // non è ancora partita, o il listone è finito. In tutti e due i casi la
  // cosa da fare sta qui sopra.
  const fermo = !lotto && asta.status === 'open'

  return (
    <section className="rounded-2xl border border-oro/40 bg-oro/5">
      {/* ─── Il piano di sopra: l'azione del momento ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span aria-hidden className="text-lg">
          🎙️
        </span>

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

        {automatica && fermo && (
          <Bottone
            inCorso={apriProssimo.isPending}
            onClick={() => apriProssimo.mutate(undefined, { onSuccess: dice, onError: sbaglia })}
          >
            {asta.method === 'random' ? 'Estrai il prossimo' : 'Apri il prossimo'}
          </Bottone>
        )}

        {fermo && (
          <Bottone
            aspetto="secondario"
            inCorso={apriScelto.isPending}
            onClick={() => setSelettore('riempi')}
          >
            Metti all&apos;asta un nome
          </Bottone>
        )}

        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          aria-expanded={aperto}
          className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-oro hover:bg-oro/10"
        >
          Conduzione
          <span aria-hidden className={`transition-transform ${aperto ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
      </div>

      {messaggio && (
        <p className="mx-3 mb-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
          {messaggio}
        </p>
      )}

      {/* ─── Il piano di sotto: quello che serve di rado ─────────────────── */}
      {aperto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-oro/20"
        >
          <div className="p-3">
            <p className="mb-3 text-xs text-fumo">
              Lo vedi solo tu. Non compare sullo schermo condiviso.
            </p>

            <div className="flex flex-wrap gap-2">
              <Bottone
                aspetto="fantasma"
                inCorso={pausa.isPending}
                onClick={() => pausa.mutate(!inPausa, { onSuccess: dice, onError: sbaglia })}
              >
                {inPausa ? 'Riprendi' : 'Metti in pausa'}
              </Bottone>
            </div>
            {automatica && !inPausa && (
              <p className="mt-2 text-xs text-fumo">
                In un&apos;asta a estrazione il calciatore successivo si apre da solo. La pausa è
                quello che ferma la catena, se ti serve un momento.
              </p>
            )}

            {/* Riempimento per nome. */}
            <div className="mt-4 rounded-xl border border-verde-campo bg-verde-notte p-3">
              <p className="text-sm font-semibold text-nebbia">Metti all&apos;asta un nome</p>
              <p className="mt-0.5 text-xs text-fumo">
                Quando il listone è finito e restano slot vuoti: cerchi il calciatore e lo rimetti
                all&apos;asta, anche se era già stato passato.{' '}
                {slotVuoti > 0 && (
                  <strong className="text-oro">
                    Slot ancora da riempire in tutta la lega: {slotVuoti}.
                  </strong>
                )}
              </p>
              <div className="mt-3">
                <Bottone
                  aspetto="secondario"
                  disabilitato={Boolean(lotto)}
                  onClick={() => setSelettore('riempi')}
                >
                  Cerca un calciatore
                </Bottone>
                {lotto && (
                  <p className="mt-2 text-xs text-fumo">
                    Prima si chiude quello che è in asta adesso.
                  </p>
                )}
              </div>
            </div>

            {/* Assegnazione rapida: un solo pretendente, niente asta. */}
            <div className="mt-3 rounded-xl border border-verde-campo bg-verde-notte p-3">
              <p className="text-sm font-semibold text-nebbia">Assegna senza fare l&apos;asta</p>
              <p className="mt-0.5 text-xs text-fumo">
                Quando c&apos;è un solo pretendente e mettersi a rilanciare non ha senso.
              </p>

              {daAssegnare == null ? (
                <div className="mt-3">
                  <Bottone
                    aspetto="secondario"
                    disabilitato={Boolean(lotto)}
                    onClick={() => setSelettore('assegna')}
                  >
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

            {/* Correzioni sulle rose già fatte: il motivo è obbligatorio. */}
            <CorreggiRose idLega={idLega} squadre={squadre} rose={rose} />

            {/* Annullamento: conferma esplicita, perché tocca crediti e rose. */}
            <div className="mt-3">
              {confermaAnnullo ? (
                <div className="rounded-xl border border-errore/40 bg-errore/10 p-3">
                  <p className="text-sm text-nebbia">
                    Annullo l&apos;ultima aggiudicazione: i crediti tornano indietro, lo slot si
                    libera e il calciatore torna disponibile. Il registro conserva tutte e due le
                    cose.
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

            {/* Chiusura dell'asta. */}
            <div className="mt-3 border-t border-oro/20 pt-3">
              {confermaChiusura ? (
                <div className="rounded-xl border border-errore/40 bg-errore/10 p-3">
                  <p className="text-sm text-nebbia">
                    Chiudo l&apos;asta.{' '}
                    {slotVuoti > 0 ? (
                      <>
                        Restano <strong className="text-oro">{slotVuoti} slot vuoti</strong>: quelle
                        squadre resteranno incomplete.
                      </>
                    ) : (
                      'Tutte le rose sono complete.'
                    )}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Bottone
                      aspetto="secondario"
                      inCorso={chiudiAsta.isPending}
                      onClick={() =>
                        chiudiAsta.mutate(undefined, {
                          onSuccess: (e) => {
                            dice(e)
                            setConfermaChiusura(false)
                          },
                          onError: sbaglia,
                        })
                      }
                    >
                      Sì, chiudi l&apos;asta
                    </Bottone>
                    <Bottone aspetto="fantasma" onClick={() => setConfermaChiusura(false)}>
                      Lascia stare
                    </Bottone>
                  </div>
                </div>
              ) : (
                <Bottone
                  aspetto="fantasma"
                  disabilitato={Boolean(lotto)}
                  onClick={() => setConfermaChiusura(true)}
                >
                  Chiudi l&apos;asta
                </Bottone>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {selettore && (
        <SelettoreCalciatore
          titolo={selettore === 'riempi' ? 'Chi vuoi mettere all’asta' : 'Chi vuoi assegnare'}
          giaPresenti={acquistati}
          inCorso={apriScelto.isPending}
          onChiudi={() => setSelettore(null)}
          onConferma={(ids) => {
            const scelto = ids[0] ?? null
            if (selettore === 'assegna') {
              setDaAssegnare(scelto)
              setSelettore(null)
              return
            }
            if (scelto == null) return setSelettore(null)
            apriScelto.mutate(scelto, {
              onSuccess: (e) => {
                dice(e)
                setSelettore(null)
              },
              onError: (e) => {
                sbaglia(e)
                setSelettore(null)
              },
            })
          }}
        />
      )}
    </section>
  )
}
