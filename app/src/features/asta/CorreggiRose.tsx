import { useState } from 'react'
import { Bottone } from '@/components/Bottone'
import { CampoNumero } from '@/components/CampoNumero'
import { CLASSE_RUOLO, NOME_RUOLO, ORDINE_RUOLI } from '@/features/obiettivi/tipi'
import { useCorreggiPrezzo, useRimuoviDallaRosa, type AcquistoInRosa, type BudgetSquadra } from './api'
import type { Ruolo } from '@/domain/listone'

/**
 * Le correzioni sulle rose già fatte: togliere un calciatore, cambiarne il
 * prezzo.
 *
 * PERCHE' IL MOTIVO E' UN CAMPO E NON UN PENSIERO
 *
 * Sono i due poteri più delicati che esistano nell'app: chi conduce gioca
 * anche, e con questi potrebbe decidere la serata. Il motivo è obbligatorio —
 * lo rifiuta il server, non solo questa schermata — e finisce nel registro che
 * leggono tutti, con il nome di chi ha corretto.
 *
 * Non è un ostacolo burocratico: è quello che permette di **avere** questi
 * poteri senza che nessuno debba fidarsi sulla parola. Per questo la schermata
 * lo dice prima, non dopo.
 */
export function CorreggiRose({
  idLega,
  squadre,
  rose,
}: {
  idLega: string | undefined
  squadre: BudgetSquadra[]
  rose: AcquistoInRosa[]
}) {
  const rimuovi = useRimuoviDallaRosa(idLega)
  const correggi = useCorreggiPrezzo(idLega)

  const [scelto, setScelto] = useState<AcquistoInRosa | null>(null)
  const [motivo, setMotivo] = useState('')
  const [prezzo, setPrezzo] = useState(1)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [filtroSquadra, setFiltroSquadra] = useState('')
  const [filtroRuolo, setFiltroRuolo] = useState<Ruolo | ''>('')

  const nomeSquadra = (id: string) => squadre.find((s) => s.team_id === id)?.name ?? '—'
  const motivoValido = motivo.trim().length >= 3

  function apri(a: AcquistoInRosa) {
    setScelto(a)
    setPrezzo(a.price)
    setMotivo('')
    setMessaggio(null)
  }

  function chiudi(esito: { esito: string; messaggio: string }) {
    setMessaggio(esito.messaggio)
    if (esito.esito === 'ok') setScelto(null)
  }

  const visibili = rose
    .filter((a) => !filtroSquadra || a.team_id === filtroSquadra)
    .filter((a) => !filtroRuolo || a.players.role === filtroRuolo)
    .sort(
      (a, b) =>
        nomeSquadra(a.team_id).localeCompare(nomeSquadra(b.team_id), 'it') ||
        ORDINE_RUOLI.indexOf(a.players.role) - ORDINE_RUOLI.indexOf(b.players.role) ||
        b.price - a.price,
    )

  return (
    <div className="mt-3 rounded-xl border border-verde-campo bg-verde-notte p-3">
      <p className="text-sm font-semibold text-nebbia">Correggi le rose</p>
      <p className="mt-0.5 text-xs text-fumo">
        Togli un calciatore o cambia il prezzo che è stato pagato. Serve un motivo, e finisce nel
        <strong className="text-oro"> registro che vedono tutti</strong>.
      </p>

      {messaggio && (
        <p className="mt-3 rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-3 py-2 text-sm text-nebbia">
          {messaggio}
        </p>
      )}

      {rose.length === 0 ? (
        <p className="mt-3 text-xs text-fumo">Non è ancora stato comprato nessuno.</p>
      ) : scelto ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="rounded-lg bg-verde-campo/50 px-3 py-2">
            <p className="text-sm font-bold text-nebbia">{scelto.players.name}</p>
            <p className="cifre-fisse text-xs text-fumo">
              {nomeSquadra(scelto.team_id)} · pagato {scelto.price}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-nebbia">
              Perché lo stai correggendo <span className="text-oro">*</span>
            </span>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Es. aggiudicato a chi non aveva rilanciato"
              className="rounded-xl border border-verde-acceso/30 bg-verde-campo/60 p-3 text-sm text-nebbia outline-none placeholder:text-fumo/60 focus:border-verde-acceso"
            />
            <span className="text-xs text-fumo">
              Lo leggeranno tutti, insieme al tuo nome. Almeno tre caratteri.
            </span>
          </label>

          <CampoNumero
            etichetta="Nuovo prezzo"
            valore={prezzo}
            onChange={setPrezzo}
            minimo={0}
            massimo={99999}
          />

          <div className="flex flex-wrap gap-2">
            <Bottone
              inCorso={correggi.isPending}
              disabilitato={!motivoValido || prezzo === scelto.price}
              onClick={() =>
                correggi.mutate(
                  { idCalciatore: scelto.player_id, prezzo, motivo: motivo.trim() },
                  { onSuccess: chiudi, onError: (e) => setMessaggio(e.message) },
                )
              }
            >
              Correggi il prezzo
            </Bottone>

            <Bottone
              aspetto="secondario"
              inCorso={rimuovi.isPending}
              disabilitato={!motivoValido}
              onClick={() =>
                rimuovi.mutate(
                  { idCalciatore: scelto.player_id, motivo: motivo.trim() },
                  { onSuccess: chiudi, onError: (e) => setMessaggio(e.message) },
                )
              }
            >
              Togli dalla rosa
            </Bottone>

            <Bottone aspetto="fantasma" onClick={() => setScelto(null)}>
              Lascia stare
            </Bottone>
          </div>

          {!motivoValido && (
            <p className="text-xs text-oro">Senza motivo il server non accetta la correzione.</p>
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <select
              value={filtroSquadra}
              onChange={(e) => setFiltroSquadra(e.target.value)}
              aria-label="Filtra per squadra"
              className="h-10 min-w-0 flex-1 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-xs text-nebbia outline-none"
            >
              <option value="">Quale squadra?</option>
              {squadre.map((s) => (
                <option key={s.team_id} value={s.team_id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={filtroRuolo}
              onChange={(e) => setFiltroRuolo(e.target.value as Ruolo | '')}
              aria-label="Filtra per ruolo"
              className="h-10 rounded-lg border border-verde-acceso/30 bg-verde-campo/60 px-2 text-xs text-nebbia outline-none"
            >
              <option value="">Quale reparto?</option>
              {ORDINE_RUOLI.map((r) => (
                <option key={r} value={r}>
                  {NOME_RUOLO[r]}
                </option>
              ))}
            </select>
          </div>

          {/* ───────────────────────────────────────────────────────────────
              L'ELENCO NON PARTE PIENO

              Duecento acquisti sono un muro: si scorre, si perde il segno, e
              per correggere un prezzo si finisce a cercare un nome dentro una
              lista di tutte le squadre. Chi apre questa schermata **sa già chi
              cerca** — «il portiere di Marco», «quell'attaccante lì» — quindi
              i filtri non servono a restringere: servono a **partire**.

              Finché non si sceglie, non si mostra niente. Non è una lista
              vuota per pigrizia: è la domanda «di chi stiamo parlando?» posta
              con il mezzo giusto. */}
          {!filtroSquadra && !filtroRuolo ? (
            <p className="mt-3 rounded-xl border border-dashed border-verde-campo px-4 py-6 text-center text-sm text-fumo">
              Scegli una squadra o un reparto qui sopra: {rose.length} acquisti tutti insieme
              non si guardano.
            </p>
          ) : visibili.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-verde-campo px-4 py-6 text-center text-sm text-fumo">
              Nessun acquisto con questi filtri.
            </p>
          ) : (
          <ul className="mt-2 max-h-64 overflow-y-auto">
            {visibili.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => apri(a)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-verde-campo/50"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CLASSE_RUOLO[a.players.role]}`}
                  >
                    {a.players.role}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-nebbia">{a.players.name}</span>
                    <span className="block truncate text-xs text-fumo">
                      {nomeSquadra(a.team_id)}
                    </span>
                  </span>
                  <span className="cifre-fisse shrink-0 text-sm font-bold text-oro">{a.price}</span>
                </button>
              </li>
            ))}
          </ul>
          )}
        </>
      )}
    </div>
  )
}
