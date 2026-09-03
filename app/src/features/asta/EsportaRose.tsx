import { useMemo, useState } from 'react'
import { Bottone } from '@/components/Bottone'
import { useAccesso } from '@/features/auth/ContestoAccesso'
import { useBudgetSquadre, useRose } from '@/features/asta/api'
import { CLASSE_RUOLO } from '@/features/obiettivi/tipi'
import {
  componiCsv,
  controlla,
  nomeFile,
  ordina,
  type Separatore,
} from '@/domain/esportazione'
import type { Ruolo } from '@/domain/listone'

/**
 * L'esportazione delle rose, nel formato che l'app Fantacalcio sa caricare.
 *
 * PERCHE' SI VEDE PRIMA DI SCARICARE
 * Un file che non si carica si scopre dall'altra parte, a serata finita,
 * quando nessuno ha più voglia di capire perché. Qui si vede l'anteprima delle
 * righe e gli avvertimenti — squadre incomplete, nomi con caratteri che nei
 * fogli danno noia — **prima** che il file esista. Il momento in cui un errore
 * costa poco è questo.
 *
 * PERCHE' IL SEPARATORE E' UNA SCELTA
 * Le istruzioni ufficiali dicono quali colonne servono, non con che carattere
 * separarle. In Italia Excel apre i CSV col punto e virgola, ed è quello il
 * valore predefinito; se il caricamento lo rifiuta, la virgola è a un tocco.
 * Indovinare per l'utente e sbagliare vorrebbe dire lasciarlo fermo senza
 * sapere cosa provare.
 */
export function EsportaRose({
  idLega,
  nomeLega,
  stagione,
}: {
  idLega: string
  nomeLega: string
  stagione: string
}) {
  const { utente } = useAccesso()
  const { data: rose } = useRose(idLega)
  const { data: budget } = useBudgetSquadre(idLega)

  const [soloMia, setSoloMia] = useState(false)
  const [separatore, setSeparatore] = useState<Separatore>(';')
  const [anteprima, setAnteprima] = useState(false)

  const miaSquadra = budget?.find((b) => b.user_id === utente?.id)?.team_id ?? null
  const nomeDi = (id: string) => budget?.find((b) => b.team_id === id)?.name ?? '—'

  const righe = useMemo(() => {
    const tutte = (rose ?? [])
      .filter((r) => !soloMia || r.team_id === miaSquadra)
      .map((r) => ({
        id: r.player_id,
        calciatore: r.players.name,
        fantasquadra: nomeDi(r.team_id),
        prezzo: r.price,
        ruolo: r.players.role as Ruolo,
      }))
    return ordina(tutte)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rose, budget, soloMia, miaSquadra])

  const avvisi = useMemo(
    () =>
      controlla(
        righe,
        (budget ?? [])
          .filter((b) => !soloMia || b.team_id === miaSquadra)
          .map((b) => ({ nome: b.name, slotMancanti: b.slot_rimanenti })),
      ),
    [righe, budget, soloMia, miaSquadra],
  )

  const bloccante = avvisi.some((a) => a.grave)

  function scarica() {
    const contenuto = componiCsv(righe, separatore)
    // Il segno d'ordine dei byte serve a Excel: senza, apre gli accenti come
    // caratteri strani e chi guarda pensa che il file sia rotto.
    const blob = new Blob(['﻿' + contenuto], { type: 'text/csv;charset=utf-8' })
    const indirizzo = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = indirizzo
    a.download = nomeFile(nomeLega, stagione, soloMia)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(indirizzo)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Pillola attiva={!soloMia} onClick={() => setSoloMia(false)}>
          Tutte le rose
        </Pillola>
        <Pillola attiva={soloMia} onClick={() => setSoloMia(true)}>
          Solo la mia
        </Pillola>
      </div>

      <p className="cifre-fisse text-sm text-fumo">
        {righe.length} {righe.length === 1 ? 'riga' : 'righe'} ·{' '}
        {new Set(righe.map((r) => r.fantasquadra)).size}{' '}
        {soloMia ? 'squadra' : 'squadre'}
      </p>

      {avvisi.map((a, i) => (
        <p
          key={i}
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            a.grave
              ? 'border-errore/40 bg-errore/10 text-errore'
              : 'border-oro/40 bg-oro/10 text-nebbia',
          ].join(' ')}
        >
          {a.testo}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Bottone misura="grande" disabilitato={bloccante} onClick={scarica}>
          Scarica il file
        </Bottone>
        <Bottone aspetto="fantasma" onClick={() => setAnteprima((v) => !v)}>
          {anteprima ? 'Nascondi' : 'Guarda prima'}
        </Bottone>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-fumo">Separatore:</span>
        <Pillola attiva={separatore === ';'} onClick={() => setSeparatore(';')}>
          punto e virgola
        </Pillola>
        <Pillola attiva={separatore === ','} onClick={() => setSeparatore(',')}>
          virgola
        </Pillola>
      </div>
      <p className="text-xs text-fumo">
        Il punto e virgola è quello che Excel in italiano si aspetta. Se il caricamento
        nell&apos;app Fantacalcio non accetta il file, riscaricalo con la virgola.
      </p>

      {anteprima && (
        <div className="overflow-x-auto rounded-xl border border-verde-campo bg-verde-notte p-3">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-fumo">
                <th className="pb-1 pr-3 font-semibold">Id</th>
                <th className="pb-1 pr-3 font-semibold">Calciatore</th>
                <th className="pb-1 pr-3 font-semibold">Fantasquadra</th>
                <th className="pb-1 font-semibold">Prezzo</th>
              </tr>
            </thead>
            <tbody>
              {righe.slice(0, 12).map((r) => (
                <tr key={`${r.fantasquadra}-${r.id}`} className="border-t border-verde-campo/60">
                  <td className="cifre-fisse py-1 pr-3 text-fumo">{r.id}</td>
                  <td className="py-1 pr-3 text-nebbia">
                    <span
                      className={`mr-1.5 inline-flex size-4 items-center justify-center rounded text-[9px] font-bold ${CLASSE_RUOLO[r.ruolo]}`}
                    >
                      {r.ruolo}
                    </span>
                    {r.calciatore}
                  </td>
                  <td className="py-1 pr-3 text-fumo">{r.fantasquadra}</td>
                  <td className="cifre-fisse py-1 font-bold text-oro">{r.prezzo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {righe.length > 12 && (
            <p className="mt-2 text-xs text-fumo">…e altre {righe.length - 12} righe.</p>
          )}
        </div>
      )}

      <p className="text-xs text-fumo">
        Le quattro colonne sono quelle delle istruzioni ufficiali. L&apos;identificativo è
        facoltativo per loro e obbligatorio per noi: senza, due calciatori omonimi finirebbero
        nella rosa sbagliata.
      </p>
    </div>
  )
}

function Pillola({
  attiva,
  onClick,
  children,
}: {
  attiva: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-9 rounded-full px-3 text-xs font-semibold transition-colors',
        attiva ? 'bg-arancio text-carbone' : 'bg-verde-campo text-fumo hover:text-nebbia',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

