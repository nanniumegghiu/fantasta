import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Campo } from '@/components/Campo'
import { Intestazione } from '@/components/Intestazione'
import { useAnteprimaInvito, useEntraInLega } from '@/features/leghe/api'

export function PaginaEntraInLega() {
  const naviga = useNavigate()
  // Se si arriva da un link WhatsApp del tipo /invito/ABC123, il codice
  // e' gia' scritto: l'utente deve solo dare un nome alla squadra.
  const { codice: codiceDalLink } = useParams()

  const [codice, setCodice] = useState((codiceDalLink ?? '').toUpperCase())
  const [nomeSquadra, setNomeSquadra] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  const anteprima = useAnteprimaInvito(codice)
  const entra = useEntraInLega()

  useEffect(() => {
    if (codiceDalLink) setCodice(codiceDalLink.toUpperCase())
  }, [codiceDalLink])

  const lega = anteprima.data
  const codiceCompleto = codice.trim().length === 6
  const codiceSconosciuto = codiceCompleto && !anteprima.isFetching && anteprima.data === null
  // Chi è già dentro non deve rifare niente: il link di invito viene riaperto
  // di continuo, anche solo per ritrovare la lega.
  const giaDentro = Boolean(lega?.sono_gia_dentro)

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    setErrore(null)

    if (!codiceCompleto) return setErrore('Il codice è di sei caratteri.')
    if (nomeSquadra.trim().length < 2) return setErrore('Dai un nome alla tua squadra.')

    try {
      const risultato = await entra.mutateAsync({ codice, nomeSquadra })
      if (risultato.esito === 'ok') {
        naviga(`/lega/${risultato.lega}`, { replace: true })
        return
      }
      if (risultato.esito === 'gia_dentro') {
        // Non si porta dentro in silenzio: si dice che non è stato creato
        // niente di nuovo, e si lascia decidere a chi guarda.
        setErrore(`${risultato.messaggio} Non ho creato una seconda squadra.`)
        void anteprima.refetch()
        return
      }
      // Ogni altro esito è previsto e porta con sé il suo messaggio in italiano.
      setErrore(risultato.messaggio)
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Non sono riuscito a farti entrare.')
    }
  }

  return (
    <div className="min-h-dvh">
      <Intestazione titolo="Entra in una lega" indietroA="/leghe" />

      <form onSubmit={invia} className="mx-auto max-w-md px-4 py-6">
        <p className="text-sm text-fumo">
          Inserisci il codice di sei caratteri che ti hanno mandato. Non ci sono lettere O né
          numeri zero: se ne vedi uno, è una D o una Q.
        </p>

        <div className="mt-5">
          <label htmlFor="codice" className="text-sm font-medium text-nebbia">
            Codice di invito
          </label>
          <input
            id="codice"
            value={codice}
            onChange={(e) => setCodice(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="cifre-fisse mt-1.5 h-16 w-full rounded-2xl border border-verde-acceso/30 bg-verde-campo/60 text-center text-3xl font-extrabold tracking-[0.35em] text-nebbia outline-none placeholder:text-fumo/40 focus:border-verde-acceso"
          />
        </div>

        {anteprima.isFetching && codiceCompleto && (
          <p className="mt-3 text-center text-sm text-fumo">Cerco la lega…</p>
        )}

        {codiceSconosciuto && (
          <p className="mt-3 rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore">
            Nessuna lega con questo codice. Controlla le lettere.
          </p>
        )}

        {lega && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            className="mt-4 rounded-2xl border border-verde-acceso/40 bg-verde-acceso/10 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-verde-acceso">
              {giaDentro ? 'Fai già parte di' : 'Stai per entrare in'}
            </p>
            <p className="mt-1 text-lg font-bold text-nebbia">{lega.nome}</p>
            <p className="cifre-fisse text-sm text-fumo">
              Stagione {lega.stagione} · {lega.partecipanti} di {lega.massimo} partecipanti
            </p>
            {giaDentro && (
              <p className="mt-2 text-sm text-nebbia">
                {lega.mia_squadra
                  ? `La tua squadra è «${lega.mia_squadra}».`
                  : 'Sei già fra i partecipanti.'}{' '}
                Non devi rientrare.
              </p>
            )}
            {!giaDentro && !lega.aperta && (
              <p className="mt-2 text-sm font-semibold text-oro">
                Questa lega non accetta più ingressi.
              </p>
            )}
          </motion.div>
        )}

        {errore && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore"
          >
            {errore}
          </p>
        )}

        {giaDentro ? (
          <div className="mt-6">
            <Link to={`/lega/${lega?.lega}`}>
              <Bottone misura="grande" larghezzaPiena>
                Vai alla lega
              </Bottone>
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <Campo
                etichetta="Il nome della tua squadra"
                valore={nomeSquadra}
                onChange={setNomeSquadra}
                placeholder="Es. F.C. Pirlo"
                aiuto="Lo vedranno tutti gli altri durante l'asta."
                richiesto
              />
            </div>

            <div className="mt-6">
              <Bottone
                type="submit"
                misura="grande"
                larghezzaPiena
                inCorso={entra.isPending}
                disabilitato={Boolean(lega && !lega.aperta)}
              >
                Entra nella lega
              </Bottone>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
