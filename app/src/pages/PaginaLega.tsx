import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Campo } from '@/components/Campo'
import { Intestazione } from '@/components/Intestazione'
import { EsportaRose } from '@/features/asta/EsportaRose'
import { Scambi } from '@/features/scambi/Scambi'
import { useAffidaSquadra, useLiberaSquadra } from '@/features/leghe/partecipanti'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import {
  indirizzoRegolamento,
  useCaricaRegolamento,
  useEliminaLega,
  useImpostaInvitoAttivo,
  useLega,
  useProfili,
  useRigeneraCodice,
  useRinominaSquadra,
} from '@/features/leghe/api'
import { totaleSlot, type LegaCompleta } from '@/features/leghe/tipi'

export function PaginaLega() {
  const { id } = useParams()
  const { utente } = useAccesso()
  const { data: lega, isPending, error } = useLega(id)

  if (isPending) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="Lega" indietroA="/leghe" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-40 animate-pulse rounded-2xl border border-verde-campo bg-verde-campo/30" />
        </div>
      </div>
    )
  }

  if (error || !lega) {
    return (
      <div className="min-h-dvh">
        <Intestazione titolo="Lega" indietroA="/leghe" />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p
            role="alert"
            className="rounded-2xl border border-errore/40 bg-errore/10 p-5 text-sm text-errore"
          >
            {error
              ? error.message
              : 'Questa lega non esiste, oppure non ne fai parte.'}
          </p>
        </div>
      </div>
    )
  }

  const sonoAdmin = lega.admin_user_id === utente?.id

  return (
    <div className="min-h-dvh">
      <Intestazione
        titolo={lega.name}
        sottotitolo={`Stagione ${lega.season}`}
        indietroA="/leghe"
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <RiquadroAsta lega={lega} sonoAdmin={sonoAdmin} />
        <RiquadroObiettivi idLega={lega.id} />
        <RiquadroListone />
        {sonoAdmin && <RiquadroInvito lega={lega} />}
        <RiquadroPartecipanti lega={lega} idUtente={utente?.id} sonoAdmin={sonoAdmin} />
        <RiquadroMiaSquadra lega={lega} idUtente={utente?.id} />
        <RiquadroRegole lega={lega} />
        <RiquadroRegolamento lega={lega} sonoAdmin={sonoAdmin} />
        {lega.trades_enabled && <RiquadroScambi lega={lega} />}
        <RiquadroEsportazione lega={lega} />
        {sonoAdmin && <ZonaPericolosa lega={lega} />}
      </main>
    </div>
  )
}

// ─── Scambi ─────────────────────────────────────────────────────────────────

/**
 * Compare solo se la lega li ha abilitati: una sezione che spiega una funzione
 * che quella lega non usa e' rumore in mezzo a cose che servono.
 */
function RiquadroScambi({ lega }: { lega: LegaCompleta }) {
  return (
    <Riquadro
      titolo="Scambi"
      sottotitolo={
        lega.trades_with_credits_enabled
          ? 'Con conguaglio in crediti. Ogni reparto deve pareggiare.'
          : 'Solo scambi secchi. Ogni reparto deve pareggiare.'
      }
    >
      <Scambi idLega={lega.id} scambiConCrediti={lega.trades_with_credits_enabled} />
    </Riquadro>
  )
}

// ─── Esportazione ───────────────────────────────────────────────────────────

/**
 * Il file da caricare nell'app Fantacalcio.
 *
 * Sta qui e non nella schermata dell'asta perche' non lo si scarica una volta
 * sola: lo si riscarica il giorno dopo, quando serve davvero, e la schermata
 * dell'asta a quel punto e' chiusa.
 */
function RiquadroEsportazione({ lega }: { lega: LegaCompleta }) {
  return (
    <Riquadro
      titolo="Esporta le rose"
      sottotitolo="Il file per l'app Fantacalcio, nel formato delle istruzioni ufficiali"
    >
      <EsportaRose idLega={lega.id} nomeLega={lega.name} stagione={lega.season} />
    </Riquadro>
  )
}

// ─── Asta ───────────────────────────────────────────────────────────────────

function RiquadroAsta({ lega, sonoAdmin }: { lega: LegaCompleta; sonoAdmin: boolean }) {
  const pronti = lega.league_members.length

  const testo = {
    setup: 'Quando siete tutti dentro, si aprono le impostazioni e si comincia.',
    auction: "L'asta è in corso.",
    done: 'Asta conclusa: le rose sono complete.',
  }[lega.status]

  return (
    <Riquadro titolo="L'asta" sottotitolo={`Siete in ${pronti}`}>
      <p className="mb-3 text-sm text-fumo">{testo}</p>

      <div className="flex flex-wrap gap-2">
        <Link to={`/lega/${lega.id}/asta`}>
          <Bottone misura="grande">
            {lega.status === 'auction' ? "Entra nell'asta" : "Vai all'asta"}
          </Bottone>
        </Link>
        {sonoAdmin && (
          <Link to={`/lega/${lega.id}/asta/schermo`} target="_blank">
            <Bottone aspetto="secondario" misura="grande">
              Schermo condiviso
            </Bottone>
          </Link>
        )}
      </div>

      {sonoAdmin && (
        <p className="mt-3 text-xs text-fumo">
          Lo schermo condiviso si apre in una scheda a parte: è la pagina da proiettare sul
          televisore. Non mostra nessun dato privato, nemmeno i tuoi obiettivi.
        </p>
      )}
    </Riquadro>
  )
}

function RiquadroObiettivi({ idLega }: { idLega: string }) {
  return (
    <Riquadro
      titolo="I miei obiettivi"
      sottotitolo="La tua preparazione all'asta. La vedi solo tu."
    >
      <p className="mb-3 text-sm text-fumo">
        Fasce, tetti di spesa, slot della rosa ideale e incroci fra portieri: accendi solo i metodi
        che usi davvero.
      </p>
      <Link to={`/lega/${idLega}/obiettivi`}>
        <Bottone>Apri la mia lista</Bottone>
      </Link>
    </Riquadro>
  )
}

function RiquadroListone() {
  return (
    <Riquadro titolo="Il listone" sottotitolo="Chi c'è, quanto vale, come sta andando.">
      <Link to="/listone">
        <Bottone aspetto="secondario">Apri il listone</Bottone>
      </Link>
    </Riquadro>
  )
}

// ─── Invito ─────────────────────────────────────────────────────────────────

function RiquadroInvito({ lega }: { lega: LegaCompleta }) {
  const rigenera = useRigeneraCodice()
  const attiva = useImpostaInvitoAttivo()
  const [copiato, setCopiato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  // ─── Il link d'invito, e il percorso base ─────────────────────────────────
  //
  // `window.location.origin` è **solo** «https://nanniumegghiu.github.io»:
  // l'applicazione online sta sotto `/fantasta/`, e un indirizzo costruito
  // dalla sola origine porta alla radice del dominio, dove non c'è niente.
  //
  // Il link finiva su WhatsApp e dava «404 not found» a chi lo apriva — cioè
  // falliva nell'unico posto in cui non lo si può provare da soli: sul telefono
  // di qualcun altro, dopo averlo mandato.
  //
  // È la terza volta che il percorso base morde in questo progetto: il ritorno
  // da Google, il codice della TV, e adesso l'invito. La regola, ogni volta che
  // si costruisce un indirizzo assoluto: **origine più `BASE_URL`**, mai
  // l'origine da sola.
  const link = new URL(
    `${import.meta.env.BASE_URL}invito/${lega.invite_code}`,
    window.location.origin,
  ).toString()
  const testo =
    `Ti aspetto nella lega "${lega.name}" su Fantasta.\n` +
    `Codice: ${lega.invite_code}\n${link}`

  async function copia() {
    try {
      await navigator.clipboard.writeText(testo)
      setCopiato(true)
      setTimeout(() => setCopiato(false), 2500)
    } catch {
      // Alcuni browser bloccano gli appunti se la pagina non è sicura.
      setErrore('Il browser non mi lascia copiare. Seleziona il codice a mano.')
    }
  }

  return (
    <Riquadro titolo="Invita gli amici" sottotitolo="Solo tu vedi questo codice.">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-verde-acceso/30 bg-verde-notte px-4 py-5">
        <p className="text-xs uppercase tracking-wide text-fumo">Codice di invito</p>
        <p className="cifre-fisse text-4xl font-extrabold tracking-[0.3em] text-oro">
          {lega.invite_code}
        </p>
        {!lega.invite_active && (
          <p className="text-sm font-semibold text-errore">Disattivato: nessuno può entrare.</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(testo)}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
        >
          <Bottone misura="grande" larghezzaPiena icona={<IconaWhatsApp />}>
            Manda su WhatsApp
          </Bottone>
        </a>
        <Bottone aspetto="secondario" misura="grande" onClick={() => void copia()}>
          {copiato ? 'Copiato' : 'Copia il link'}
        </Bottone>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Bottone
          aspetto="fantasma"
          inCorso={rigenera.isPending}
          onClick={() => {
            setErrore(null)
            rigenera.mutate(lega.id, {
              onError: (e) => setErrore(e.message),
            })
          }}
        >
          Genera un codice nuovo
        </Bottone>
        <Bottone
          aspetto="fantasma"
          inCorso={attiva.isPending}
          onClick={() => {
            setErrore(null)
            attiva.mutate(
              { idLega: lega.id, attivo: !lega.invite_active },
              { onError: (e) => setErrore(e.message) },
            )
          }}
        >
          {lega.invite_active ? 'Disattiva il codice' : 'Riattiva il codice'}
        </Bottone>
      </div>

      <p className="mt-3 text-xs text-fumo">
        Se generi un codice nuovo, il vecchio smette di funzionare all&apos;istante. Utile se è
        finito nella chat sbagliata.
      </p>

      {errore && <p className="mt-2 text-sm text-errore">{errore}</p>}
    </Riquadro>
  )
}

// ─── Partecipanti ───────────────────────────────────────────────────────────

function RiquadroPartecipanti({
  lega,
  idUtente,
  sonoAdmin,
}: {
  lega: LegaCompleta
  idUtente: string | undefined
  sonoAdmin: boolean
}) {
  const { data: profili } = useProfili(lega.league_members.map((m) => m.user_id))
  const libera = useLiberaSquadra(lega.id)
  const [daLiberare, setDaLiberare] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [messaggio, setMessaggio] = useState<string | null>(null)

  // Una squadra senza proprietario non compare fra i partecipanti — nessuno la
  // guida — ma esiste, con la sua rosa e i suoi crediti, e va mostrata o
  // sembrerebbe sparita.
  const libere = lega.teams.filter((t) => !t.user_id)

  return (
    <Riquadro
      titolo="Partecipanti"
      sottotitolo={`${lega.league_members.length} di ${lega.max_members}`}
    >
      <ul className="flex flex-col divide-y divide-verde-campo">
        {lega.league_members.map((m) => {
          const squadra = lega.teams.find((t) => t.user_id === m.user_id)
          const profilo = profili?.[m.user_id]
          const iniziali = (profilo?.display_name ?? '?').slice(0, 2).toUpperCase()

          return (
            <li key={m.user_id} className="flex items-center gap-3 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-verde-campo text-sm font-bold text-nebbia">
                {iniziali}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-nebbia">
                  {squadra?.name ?? 'Squadra senza nome'}
                  {m.user_id === idUtente && <span className="text-fumo"> · tu</span>}
                </p>
                <p className="truncate text-xs text-fumo">
                  {profilo?.display_name ?? 'Partecipante'}
                  {m.role === 'admin' && ' · amministratore'}
                </p>
              </div>
              <span className="cifre-fisse shrink-0 text-sm font-bold text-oro">
                {squadra?.credits_remaining ?? lega.credits_initial}
              </span>

              {/* Chi amministra può togliere qualcuno, ma non se stesso: una
                  lega senza amministratore non si sblocca più. */}
              {sonoAdmin && m.role !== 'admin' && squadra && (
                <button
                  type="button"
                  onClick={() => {
                    setDaLiberare(squadra.id)
                    setMotivo('')
                    setMessaggio(null)
                  }}
                  aria-label={`Togli ${profilo?.display_name ?? 'questo partecipante'} dalla lega`}
                  title="Togli dalla lega, lasciando la squadra"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fumo hover:bg-errore/15 hover:text-errore"
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {messaggio && (
        <p className="mt-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
          {messaggio}
        </p>
      )}

      {daLiberare && (
        <div className="mt-3 rounded-xl border border-errore/40 bg-errore/10 p-3">
          <p className="text-sm text-nebbia">
            Tolgo <strong>{lega.teams.find((t) => t.id === daLiberare)?.name}</strong> a chi la
            guida adesso. <strong>La squadra resta</strong>: rosa, crediti e nome non si toccano, e
            potrai affidarla a qualcun altro. Se ne va solo la sua lista obiettivi, che era sua e
            privata.
          </p>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-nebbia">
              Perché <span className="text-oro">*</span>
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Es. ha lasciato il gruppo"
              className="rounded-xl border border-verde-acceso/30 bg-verde-notte p-3 text-sm text-nebbia outline-none placeholder:text-fumo/60"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <Bottone
              aspetto="secondario"
              inCorso={libera.isPending}
              disabilitato={motivo.trim().length < 3}
              onClick={() =>
                libera.mutate(
                  { idSquadra: daLiberare, motivo: motivo.trim() },
                  {
                    onSuccess: (e) => {
                      setMessaggio(e.messaggio)
                      if (e.esito === 'ok') setDaLiberare(null)
                    },
                    onError: (e) => setMessaggio(e.message),
                  },
                )
              }
            >
              Sì, toglilo
            </Bottone>
            <Bottone aspetto="fantasma" onClick={() => setDaLiberare(null)}>
              Lascia stare
            </Bottone>
          </div>
        </div>
      )}

      {libere.length > 0 && (
        <div className="mt-4 border-t border-verde-campo pt-3">
          <p className="text-sm font-bold text-oro">
            {libere.length === 1 ? 'Una squadra aspetta qualcuno' : `${libere.length} squadre aspettano qualcuno`}
          </p>
          <p className="mt-0.5 mb-2 text-xs text-fumo">
            Hanno la loro rosa e i loro crediti: manca chi le guida.
          </p>
          <div className="flex flex-col gap-2">
            {libere.map((t) => (
              <SquadraLibera key={t.id} idLega={lega.id} squadra={t} sonoAdmin={sonoAdmin} />
            ))}
          </div>
        </div>
      )}

      {lega.league_members.length < lega.max_members && (
        <p className="mt-3 text-xs text-fumo">
          Mancano ancora {lega.max_members - lega.league_members.length} partecipanti al numero
          massimo. Si può fare l&apos;asta anche in meno.
        </p>
      )}
    </Riquadro>
  )
}

/**
 * Una squadra rimasta senza nessuno, e il modo di affidarla.
 *
 * PERCHE' SI CHIEDE L'INDIRIZZO EMAIL
 * È l'unica cosa che si sa di una persona prima che sia in lega. Deve avere
 * già un account: l'alternativa sarebbe creare account per conto di altri, che
 * è esattamente il genere di cosa che un'applicazione non deve fare.
 */
function SquadraLibera({
  idLega,
  squadra,
  sonoAdmin,
}: {
  idLega: string
  squadra: { id: string; name: string; credits_remaining: number }
  sonoAdmin: boolean
}) {
  const affida = useAffidaSquadra(idLega)
  const [email, setEmail] = useState('')
  const [messaggio, setMessaggio] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-oro/40 bg-oro/5 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-nebbia">{squadra.name}</p>
        <p className="cifre-fisse shrink-0 text-sm font-bold text-oro">
          {squadra.credits_remaining}
        </p>
      </div>

      {sonoAdmin && (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="email di chi la prende"
              className="h-10 min-w-0 flex-1 rounded-lg border border-verde-acceso/30 bg-verde-notte px-3 text-sm text-nebbia outline-none placeholder:text-fumo/60"
            />
            <Bottone
              aspetto="secondario"
              inCorso={affida.isPending}
              disabilitato={!email.includes('@')}
              onClick={() =>
                affida.mutate(
                  { idSquadra: squadra.id, email: email.trim() },
                  {
                    onSuccess: (e) => {
                      setMessaggio(e.messaggio)
                      if (e.esito === 'ok') setEmail('')
                    },
                    onError: (e) => setMessaggio(e.message),
                  },
                )
              }
            >
              Affidala
            </Bottone>
          </div>
          <p className="mt-1 text-xs text-fumo">
            Deve essersi già registrata all&apos;app con quell&apos;indirizzo.
          </p>
        </>
      )}

      {messaggio && <p className="mt-2 text-sm text-nebbia">{messaggio}</p>}
    </div>
  )
}

// ─── La mia squadra ─────────────────────────────────────────────────────────

function RiquadroMiaSquadra({
  lega,
  idUtente,
}: {
  lega: LegaCompleta
  idUtente: string | undefined
}) {
  const squadra = lega.teams.find((t) => t.user_id === idUtente)
  const rinomina = useRinominaSquadra()
  const [modifica, setModifica] = useState(false)
  const [nome, setNome] = useState(squadra?.name ?? '')
  const [errore, setErrore] = useState<string | null>(null)

  if (!squadra) return null

  async function salva() {
    setErrore(null)
    if (nome.trim().length < 2) return setErrore('Il nome deve avere almeno due caratteri.')
    try {
      await rinomina.mutateAsync({ idSquadra: squadra!.id, nome })
      setModifica(false)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non sono riuscito a cambiare il nome.')
    }
  }

  return (
    <Riquadro titolo="La mia squadra">
      {modifica ? (
        <div className="flex flex-col gap-3">
          <Campo etichetta="Nome della squadra" valore={nome} onChange={setNome} richiesto />
          {errore && <p className="text-sm text-errore">{errore}</p>}
          <div className="flex gap-2">
            <Bottone onClick={() => void salva()} inCorso={rinomina.isPending}>
              Salva
            </Bottone>
            <Bottone
              aspetto="fantasma"
              onClick={() => {
                setNome(squadra.name)
                setErrore(null)
                setModifica(false)
              }}
            >
              Annulla
            </Bottone>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-nebbia">{squadra.name}</p>
            <p className="cifre-fisse text-sm text-fumo">
              {squadra.credits_remaining} crediti · rosa da {totaleSlot(lega)} calciatori
            </p>
          </div>
          <Bottone aspetto="secondario" onClick={() => setModifica(true)}>
            Rinomina
          </Bottone>
        </div>
      )}
    </Riquadro>
  )
}

// ─── Regole ─────────────────────────────────────────────────────────────────

function RiquadroRegole({ lega }: { lega: LegaCompleta }) {
  const righe: Array<[string, string]> = [
    ['Crediti a testa', String(lega.credits_initial)],
    ['Offerta minima', String(lega.min_bid)],
    ['Rosa', `${lega.slots_p}-${lega.slots_d}-${lega.slots_c}-${lega.slots_a}, ${totaleSlot(lega)} calciatori`],
    ['Scambi', lega.trades_enabled ? 'permessi' : 'non permessi'],
    [
      'Scambi con crediti',
      lega.trades_with_credits_enabled ? 'permessi' : 'non permessi',
    ],
  ]

  return (
    <Riquadro titolo="Le regole">
      <dl className="divide-y divide-verde-campo">
        {righe.map(([voce, valore]) => (
          <div key={voce} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-fumo">{voce}</dt>
            <dd className="cifre-fisse text-right text-sm font-semibold text-nebbia">{valore}</dd>
          </div>
        ))}
      </dl>
    </Riquadro>
  )
}

// ─── Regolamento in PDF ─────────────────────────────────────────────────────

function RiquadroRegolamento({ lega, sonoAdmin }: { lega: LegaCompleta; sonoAdmin: boolean }) {
  const carica = useCaricaRegolamento()
  const input = useRef<HTMLInputElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [apertura, setApertura] = useState(false)

  async function apri() {
    if (!lega.rules_pdf_path) return
    setErrore(null)
    setApertura(true)
    try {
      const url = await indirizzoRegolamento(lega.rules_pdf_path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco ad aprire il regolamento.')
    } finally {
      setApertura(false)
    }
  }

  async function scegli(file: File | undefined) {
    if (!file) return
    setErrore(null)
    try {
      await carica.mutateAsync({ idLega: lega.id, file })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito.')
    }
  }

  return (
    <Riquadro titolo="Il regolamento" sottotitolo="Un PDF, fino a 10 MB.">
      {lega.rules_pdf_path ? (
        <Bottone aspetto="secondario" onClick={() => void apri()} inCorso={apertura}>
          Apri il regolamento
        </Bottone>
      ) : (
        <p className="text-sm text-fumo">
          {sonoAdmin
            ? 'Non hai ancora caricato il regolamento della lega.'
            : "L'amministratore non ha ancora caricato il regolamento."}
        </p>
      )}

      {sonoAdmin && (
        <div className="mt-3">
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => void scegli(e.target.files?.[0])}
          />
          <Bottone
            aspetto="fantasma"
            inCorso={carica.isPending}
            onClick={() => input.current?.click()}
          >
            {lega.rules_pdf_path ? 'Sostituisci il PDF' : 'Carica il PDF'}
          </Bottone>
        </div>
      )}

      {errore && <p className="mt-2 text-sm text-errore">{errore}</p>}
    </Riquadro>
  )
}

// ─── Zona pericolosa ────────────────────────────────────────────────────────

/**
 * L'eliminazione della lega.
 *
 * È l'unica azione dell'app che non si può annullare, e porta via anche il
 * lavoro degli altri: le loro rose e le loro liste obiettivi. Per questo non è
 * un pulsante ma un percorso: si apre, si legge cosa sparisce, si riscrive il
 * nome della lega. Il server chiede comunque il nome, quindi non basta un
 * difetto dell'interfaccia per cancellare una serata.
 */
function ZonaPericolosa({ lega }: { lega: LegaCompleta }) {
  const naviga = useNavigate()
  const elimina = useEliminaLega()
  const [aperta, setAperta] = useState(false)
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  const coincide = conferma.trim().toLowerCase() === lega.name.trim().toLowerCase()
  const astaInCorso = lega.status === 'auction'

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="rounded-2xl border border-errore/30 bg-errore/5 p-4"
    >
      <h2 className="text-base font-bold text-errore">Elimina la lega</h2>
      <p className="mt-0.5 text-xs text-fumo">
        Solo tu che l&apos;hai creata puoi farlo. Non si torna indietro.
      </p>

      {!aperta ? (
        <div className="mt-3">
          <Bottone aspetto="fantasma" onClick={() => setAperta(true)}>
            Voglio eliminare questa lega
          </Bottone>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-xl border border-errore/40 bg-verde-notte p-3">
            <p className="text-sm font-semibold text-nebbia">Sparisce tutto questo, per sempre:</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-fumo">
              <li>
                <span className="cifre-fisse text-nebbia">{lega.league_members.length}</span>{' '}
                partecipanti e le loro squadre
              </li>
              <li>le rose costruite finora, con i crediti spesi</li>
              <li>
                <strong className="text-nebbia">le liste obiettivi di tutti</strong>, con tetti e
                note che ognuno si è scritto
              </li>
              <li>l&apos;asta, il suo registro e il regolamento caricato</li>
            </ul>
            {astaInCorso && (
              <p className="mt-3 rounded-lg border border-oro/40 bg-oro/10 px-3 py-2 text-sm text-oro">
                Attenzione: l&apos;asta è in corso. Quello che avete costruito stasera se ne va con
                la lega.
              </p>
            )}
          </div>

          <Campo
            etichetta={`Riscrivi il nome della lega: ${lega.name}`}
            valore={conferma}
            onChange={setConferma}
            nome="conferma-eliminazione"
            autoComplete="off"
            placeholder={lega.name}
            aiuto="Serve a essere sicuri che non sia un tocco sbagliato."
          />

          {errore && (
            <p role="alert" className="rounded-xl border border-errore/40 bg-errore/10 px-4 py-3 text-sm text-errore">
              {errore}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Bottone
              aspetto="secondario"
              disabilitato={!coincide}
              inCorso={elimina.isPending}
              onClick={() => {
                setErrore(null)
                elimina.mutate(
                  { idLega: lega.id, conferma, percorsoPdf: lega.rules_pdf_path },
                  {
                    onSuccess: (e) => {
                      if (e.esito === 'ok') naviga('/leghe', { replace: true })
                      else setErrore(e.messaggio)
                    },
                    onError: (e) => setErrore(e.message),
                  },
                )
              }}
            >
              Elimina definitivamente
            </Bottone>
            <Bottone
              aspetto="fantasma"
              onClick={() => {
                setAperta(false)
                setConferma('')
                setErrore(null)
              }}
            >
              Lascia stare
            </Bottone>
          </div>
        </div>
      )}
    </motion.section>
  )
}

// ─── Contenitore comune ─────────────────────────────────────────────────────

function Riquadro({
  titolo,
  sottotitolo,
  children,
}: {
  titolo: string
  sottotitolo?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26 }}
      className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4"
    >
      <h2 className="text-base font-bold text-nebbia">{titolo}</h2>
      {sottotitolo && <p className="mt-0.5 text-xs text-fumo">{sottotitolo}</p>}
      <div className="mt-3">{children}</div>
    </motion.section>
  )
}

function IconaWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.87 9.87 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 01-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24z" />
    </svg>
  )
}
