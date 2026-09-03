import { useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import { useBudgetSquadre, useRose, type AcquistoInRosa } from '@/features/asta/api'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from '@/features/obiettivi/tipi'
import { useProponiScambio, useRispondiScambio, useScambi, type Scambio } from './api'
import type { Ruolo } from '@/domain/listone'

/**
 * Gli scambi fra squadre.
 *
 * LA REGOLA CHE L'INTERFACCIA DEVE RENDERE OVVIA
 * Uno scambio deve lasciare valide tutte e due le rose: ogni reparto deve
 * pareggiare, un difensore per un difensore. Il server la fa rispettare
 * comunque, ma scoprirla con un rifiuto dopo aver composto la proposta è un
 * modo pessimo di impararla. Qui il conto dei reparti si vede **mentre** si
 * sceglie, e il pulsante resta spento finché non torna.
 *
 * PERCHE' SI VEDONO TUTTI GLI SCAMBI E NON SOLO I PROPRI
 * Uno scambio cambia gli equilibri della lega intera. Vederli tutti è la stessa
 * scelta del registro dell'asta: quello che è successo lo sanno tutti, e non
 * c'è niente da discutere dopo.
 */
export function Scambi({
  idLega,
  scambiConCrediti,
}: {
  idLega: string
  scambiConCrediti: boolean
}) {
  const { utente } = useAccesso()
  const { data: squadre } = useBudgetSquadre(idLega)
  const { data: rose } = useRose(idLega)
  const { data: scambi } = useScambi(idLega)
  const rispondi = useRispondiScambio(idLega)

  const [componi, setComponi] = useState(false)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  const miaSquadra = squadre?.find((s) => s.user_id === utente?.id)?.team_id ?? null
  const daRispondere = (scambi ?? []).filter(
    (s) => s.status === 'proposto' && s.to_team_id === miaSquadra,
  )
  const inAttesa = (scambi ?? []).filter(
    (s) => s.status === 'proposto' && s.from_team_id === miaSquadra,
  )
  const altri = (scambi ?? []).filter((s) => s.status !== 'proposto')

  if (!miaSquadra) {
    return <p className="text-sm text-fumo">Non hai una squadra in questa lega.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {messaggio && (
        <p className="rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
          {messaggio}
        </p>
      )}

      {componi ? (
        <ComponiScambio
          idLega={idLega}
          miaSquadra={miaSquadra}
          squadre={squadre ?? []}
          rose={rose ?? []}
          scambiConCrediti={scambiConCrediti}
          onFatto={(m) => {
            setMessaggio(m)
            setComponi(false)
          }}
          onAnnulla={() => setComponi(false)}
        />
      ) : (
        <Bottone onClick={() => setComponi(true)}>Proponi uno scambio</Bottone>
      )}

      {daRispondere.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-oro">
            {daRispondere.length === 1
              ? 'Una proposta aspetta te'
              : `${daRispondere.length} proposte aspettano te`}
          </h3>
          <div className="flex flex-col gap-2">
            {daRispondere.map((s) => (
              <SchedaScambio
                key={s.id}
                scambio={s}
                miaSquadra={miaSquadra}
                azioni={
                  <div className="mt-2 flex gap-2">
                    <Bottone
                      inCorso={rispondi.isPending}
                      onClick={() =>
                        rispondi.mutate(
                          { idScambio: s.id, accetto: true },
                          {
                            onSuccess: (e) => setMessaggio(e.messaggio),
                            onError: (e) => setMessaggio(e.message),
                          },
                        )
                      }
                    >
                      Accetto
                    </Bottone>
                    <Bottone
                      aspetto="fantasma"
                      onClick={() =>
                        rispondi.mutate(
                          { idScambio: s.id, accetto: false },
                          {
                            onSuccess: (e) => setMessaggio(e.messaggio),
                            onError: (e) => setMessaggio(e.message),
                          },
                        )
                      }
                    >
                      No, grazie
                    </Bottone>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {inAttesa.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-fumo">In attesa di risposta</h3>
          <div className="flex flex-col gap-2">
            {inAttesa.map((s) => (
              <SchedaScambio
                key={s.id}
                scambio={s}
                miaSquadra={miaSquadra}
                azioni={
                  <div className="mt-2">
                    <Bottone
                      aspetto="fantasma"
                      onClick={() =>
                        rispondi.mutate(
                          { idScambio: s.id, accetto: false },
                          {
                            onSuccess: (e) => setMessaggio(e.messaggio),
                            onError: (e) => setMessaggio(e.message),
                          },
                        )
                      }
                    >
                      Ritira la proposta
                    </Bottone>
                  </div>
                }
              />
            ))}
          </div>
        </div>
      )}

      {altri.length > 0 && (
        <details className="rounded-xl border border-verde-campo bg-verde-notte p-3">
          <summary className="cursor-pointer text-sm font-semibold text-nebbia">
            Gli scambi già chiusi ({altri.length})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {altri.map((s) => (
              <SchedaScambio key={s.id} scambio={s} miaSquadra={miaSquadra} />
            ))}
          </div>
        </details>
      )}

      {(scambi ?? []).length === 0 && !componi && (
        <p className="text-xs text-fumo">
          Nessuno scambio, per ora. Uno scambio deve lasciare valide tutte e due le rose: ogni
          reparto deve pareggiare, un difensore per un difensore.
        </p>
      )}
    </div>
  )
}

// ─── Una proposta, letta ────────────────────────────────────────────────────

const PAROLA_STATO: Record<Scambio['status'], { testo: string; classe: string }> = {
  proposto: { testo: 'in attesa', classe: 'bg-oro/20 text-oro' },
  accettato: { testo: 'fatto', classe: 'bg-verde-acceso/20 text-verde-acceso' },
  rifiutato: { testo: 'rifiutato', classe: 'bg-errore/15 text-errore' },
  ritirato: { testo: 'ritirato', classe: 'bg-fumo/20 text-fumo' },
  decaduto: { testo: 'decaduto', classe: 'bg-fumo/20 text-fumo' },
}

function SchedaScambio({
  scambio,
  miaSquadra,
  azioni,
}: {
  scambio: Scambio
  miaSquadra: string
  azioni?: React.ReactNode
}) {
  const ioPropongo = scambio.from_team_id === miaSquadra
  const stato = PAROLA_STATO[scambio.status]

  // Si racconta sempre dal punto di vista di chi guarda: «dai» e «prendi»,
  // non «la squadra A dà alla squadra B». Con sei squadre in lega, capire da
  // che parte si sta richiede un attimo di troppo mentre si decide.
  const dai = ioPropongo ? scambio.danno : scambio.ricevono
  const prendi = ioPropongo ? scambio.ricevono : scambio.danno
  const creditiPerMe = ioPropongo ? -scambio.credits : scambio.credits
  const controparte = ioPropongo ? scambio.squadra_riceve : scambio.squadra_propone

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-verde-campo bg-verde-notte p-3"
    >
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm text-nebbia">
          {ioPropongo ? 'A ' : 'Da '}
          <strong>{controparte}</strong>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${stato.classe}`}>
          {stato.testo}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3">
        <Colonna titolo="Dai" calciatori={dai} />
        <Colonna titolo="Prendi" calciatori={prendi} />
      </div>

      {creditiPerMe !== 0 && (
        <p className="cifre-fisse mt-2 text-sm text-nebbia">
          {creditiPerMe > 0 ? 'Ricevi' : 'Paghi'}{' '}
          <strong className="text-oro">{Math.abs(creditiPerMe)}</strong> crediti
        </p>
      )}

      {scambio.note && <p className="mt-2 text-sm italic text-fumo">«{scambio.note}»</p>}

      {azioni}
    </motion.div>
  )
}

function Colonna({
  titolo,
  calciatori,
}: {
  titolo: string
  calciatori: Scambio['danno']
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-fumo">{titolo}</p>
      {calciatori.length === 0 ? (
        <p className="text-xs text-fumo">—</p>
      ) : (
        <ul className="mt-0.5">
          {calciatori.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold ${CLASSE_RUOLO[c.ruolo]}`}
              >
                {c.ruolo}
              </span>
              <span className="min-w-0 truncate text-sm text-nebbia">{c.nome}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Comporre una proposta ──────────────────────────────────────────────────

function ComponiScambio({
  idLega,
  miaSquadra,
  squadre,
  rose,
  scambiConCrediti,
  onFatto,
  onAnnulla,
}: {
  idLega: string
  miaSquadra: string
  squadre: Array<{ team_id: string; name: string }>
  rose: AcquistoInRosa[]
  scambiConCrediti: boolean
  onFatto: (messaggio: string) => void
  onAnnulla: () => void
}) {
  const proponi = useProponiScambio(idLega)

  const [conChi, setConChi] = useState('')
  const [miei, setMiei] = useState<Set<number>>(new Set())
  const [suoi, setSuoi] = useState<Set<number>>(new Set())
  const [crediti, setCrediti] = useState(0)
  const [nota, setNota] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  const mieiCalciatori = rose.filter((r) => r.team_id === miaSquadra)
  const suoiCalciatori = rose.filter((r) => r.team_id === conChi)

  function commuta(insieme: Set<number>, imposta: (s: Set<number>) => void, id: number) {
    const n = new Set(insieme)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    imposta(n)
  }

  /**
   * Il conto dei reparti, mostrato mentre si sceglie.
   *
   * È la regola che decide se lo scambio si può fare, e vederla solo nel
   * rifiuto del server vorrebbe dire comporre la proposta due volte.
   */
  const conta = (elenco: AcquistoInRosa[], scelti: Set<number>) => {
    const c: Record<Ruolo, number> = { P: 0, D: 0, C: 0, A: 0 }
    for (const r of elenco) if (scelti.has(r.player_id)) c[r.players.role]++
    return c
  }
  const contoMiei = conta(mieiCalciatori, miei)
  const contoSuoi = conta(suoiCalciatori, suoi)
  const repartiPari = ORDINE_RUOLI.every((r) => contoMiei[r] === contoSuoi[r])
  const qualcuno = miei.size + suoi.size > 0

  return (
    <div className="rounded-xl border border-verde-acceso/30 bg-verde-notte p-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-nebbia">Con quale squadra</span>
        <select
          value={conChi}
          onChange={(e) => {
            setConChi(e.target.value)
            setSuoi(new Set())
          }}
          className="h-11 rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm text-nebbia outline-none"
        >
          <option value="">Scegli…</option>
          {squadre
            .filter((s) => s.team_id !== miaSquadra)
            .map((s) => (
              <option key={s.team_id} value={s.team_id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>

      {conChi && (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SceltaCalciatori
              titolo="Cosa dai"
              calciatori={mieiCalciatori}
              scelti={miei}
              onCommuta={(id) => commuta(miei, setMiei, id)}
            />
            <SceltaCalciatori
              titolo="Cosa prendi"
              calciatori={suoiCalciatori}
              scelti={suoi}
              onCommuta={(id) => commuta(suoi, setSuoi, id)}
            />
          </div>

          <div
            className={[
              'mt-3 rounded-xl border px-3 py-2 text-sm',
              repartiPari && qualcuno
                ? 'border-verde-acceso/40 bg-verde-acceso/10 text-nebbia'
                : 'border-oro/40 bg-oro/10 text-nebbia',
            ].join(' ')}
          >
            <p className="font-semibold">
              {!qualcuno
                ? 'Scegli almeno un calciatore per parte.'
                : repartiPari
                  ? 'I reparti pareggiano: le rose restano valide.'
                  : 'I reparti non pareggiano.'}
            </p>
            <p className="cifre-fisse mt-1 text-xs text-fumo">
              {ORDINE_RUOLI.filter((r) => contoMiei[r] || contoSuoi[r])
                .map((r) => `${NOME_RUOLO[r]}: ${contoMiei[r]} contro ${contoSuoi[r]}`)
                .join(' · ') || 'niente scelto'}
            </p>
          </div>

          {scambiConCrediti && (
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-nebbia">
                Conguaglio in crediti{' '}
                <span className="text-xs font-normal text-fumo">
                  (positivo: li dai tu · negativo: li ricevi)
                </span>
              </span>
              <input
                type="number"
                value={crediti}
                onChange={(e) => setCrediti(Math.trunc(Number(e.target.value) || 0))}
                className="cifre-fisse h-11 rounded-xl border border-verde-acceso/30 bg-verde-campo/60 px-3 text-sm text-nebbia outline-none"
              />
            </label>
          )}

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-nebbia">Due parole per convincerlo</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="Es. ho tre terzini e mi manca un centrale"
              className="rounded-xl border border-verde-acceso/30 bg-verde-campo/60 p-3 text-sm text-nebbia outline-none placeholder:text-fumo/60"
            />
          </label>
        </>
      )}

      {errore && (
        <p className="mt-3 rounded-xl border border-errore/40 bg-errore/10 px-3 py-2 text-sm text-errore">
          {errore}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Bottone
          inCorso={proponi.isPending}
          disabilitato={!conChi || !qualcuno || !repartiPari}
          onClick={() => {
            setErrore(null)
            proponi.mutate(
              {
                aSquadra: conChi,
                miei: [...miei],
                suoi: [...suoi],
                crediti: scambiConCrediti ? crediti : 0,
                nota,
              },
              {
                onSuccess: (e) => {
                  if (e.esito === 'ok') onFatto(e.messaggio)
                  else setErrore(e.messaggio)
                },
                onError: (e) => setErrore(e.message),
              },
            )
          }}
        >
          Manda la proposta
        </Bottone>
        <Bottone aspetto="fantasma" onClick={onAnnulla}>
          Lascia stare
        </Bottone>
      </div>
    </div>
  )
}

function SceltaCalciatori({
  titolo,
  calciatori,
  scelti,
  onCommuta,
}: {
  titolo: string
  calciatori: AcquistoInRosa[]
  scelti: Set<number>
  onCommuta: (id: number) => void
}) {
  const ordinati = [...calciatori].sort(
    (a, b) =>
      ORDINE_RUOLI.indexOf(a.players.role) - ORDINE_RUOLI.indexOf(b.players.role) ||
      b.price - a.price,
  )

  return (
    <div className="min-w-0 rounded-xl border border-verde-campo bg-verde-campo/30 p-2">
      <p className="mb-1 text-xs font-semibold text-fumo">{titolo}</p>
      {ordinati.length === 0 ? (
        <p className="text-xs text-fumo">Rosa vuota.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto">
          {ordinati.map((r) => {
            const scelto = scelti.has(r.player_id)
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onCommuta(r.player_id)}
                  aria-pressed={scelto}
                  className={[
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                    scelto ? 'bg-arancio/20' : 'hover:bg-verde-campo/60',
                  ].join(' ')}
                >
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CLASSE_RUOLO[r.players.role]}`}
                  >
                    {r.players.role}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-nebbia">
                    {r.players.name}
                  </span>
                  <span className="cifre-fisse shrink-0 text-xs text-fumo">{r.price}</span>
                  {scelto && <span aria-hidden className="text-xs text-arancio">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
