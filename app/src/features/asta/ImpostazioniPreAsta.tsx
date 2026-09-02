import { useState } from 'react'
import { Bottone } from '@/components/Bottone'
import { CampoNumero } from '@/components/CampoNumero'
import {
  useApriAsta,
  useConfiguraAsta,
  type Asta,
  type BudgetSquadra,
  type ImpostazioniAsta,
} from './api'

/**
 * Le impostazioni che l'amministratore fissa prima di aprire.
 *
 * Si cambiano solo prima dell'apertura, e il server lo fa rispettare: cambiare
 * il metodo a metà asta falserebbe la gara, e fra amici sarebbe l'inizio di una
 * discussione che l'app dovrebbe proprio evitare.
 */
export function ImpostazioniPreAsta({
  idLega,
  asta,
  squadre,
}: {
  idLega: string | undefined
  asta: Asta | null | undefined
  squadre: BudgetSquadra[]
}) {
  const configura = useConfiguraAsta(idLega)
  const apri = useApriAsta(idLega)

  const [v, setV] = useState<ImpostazioniAsta>({
    metodo: asta?.method ?? 'chiamata',
    variante: asta?.variant ?? 'totale',
    conduzione: asta?.conduction ?? 'app',
    tipoChiamata: asta?.bid_type ?? 'libera',
    secondiInattivita: asta?.inactivity_seconds ?? 8,
    secondiCountdown: asta?.countdown_seconds ?? 5,
    quotazioneMinima: asta?.random_pool_filter?.quotazione_minima ?? null,
  })
  const [sorteggia, setSorteggia] = useState(true)
  const [messaggio, setMessaggio] = useState<string | null>(null)

  function cambia<K extends keyof ImpostazioniAsta>(chiave: K, valore: ImpostazioniAsta[K]) {
    setV((p) => {
      const n = { ...p, [chiave]: valore }
      // L'ibrida esiste solo a chiamata: nei metodi automatici coincide con
      // la divisione per ruoli, e il server la rifiuterebbe.
      if (chiave === 'metodo' && valore !== 'chiamata' && n.variante === 'ibrida') {
        n.variante = 'per_ruolo'
      }
      return n
    })
  }

  const varianti: Array<{ valore: ImpostazioniAsta['variante']; nome: string; spiega: string }> =
    v.metodo === 'chiamata'
      ? [
          { valore: 'totale', nome: 'Libera totale', spiega: 'Si chiama chiunque, in qualsiasi momento.' },
          { valore: 'per_ruolo', nome: 'Divisa per ruoli', spiega: 'Prima tutti i portieri, poi i difensori, e così via.' },
          { valore: 'ibrida', nome: 'Ibrida', spiega: 'Prima i portieri di tutti, poi movimento libero.' },
        ]
      : [
          { valore: 'totale', nome: 'Tutti insieme', spiega: 'Un unico elenco, senza divisione per reparto.' },
          { valore: 'per_ruolo', nome: 'Divisa per ruoli', spiega: 'Un reparto per volta, dai portieri agli attaccanti.' },
        ]

  return (
    <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
      <h2 className="text-base font-bold text-nebbia">Impostazioni dell&apos;asta</h2>
      <p className="mt-0.5 mb-4 text-xs text-fumo">
        Si cambiano solo prima di aprire. Dopo l&apos;apertura si congelano.
      </p>

      <div className="flex flex-col gap-5">
        <Scelta
          titolo="Come si sceglie chi va all'asta"
          valore={v.metodo}
          onChange={(x) => cambia('metodo', x)}
          opzioni={[
            { valore: 'chiamata', nome: 'A chiamata', spiega: 'A turno ognuno nomina un calciatore e apre le offerte.' },
            { valore: 'alfabetico', nome: 'Ordine alfabetico', spiega: 'Il server mette all\'asta tutti, dalla A alla Z.' },
            { valore: 'random', nome: 'Estrazione casuale', spiega: 'Il server estrae a sorte. Imprevedibile.' },
          ]}
        />

        <Scelta
          titolo="Come è divisa"
          valore={v.variante}
          onChange={(x) => cambia('variante', x)}
          opzioni={varianti}
        />

        {v.metodo === 'random' && (
          <div>
            <CampoNumero
              etichetta="Estrai solo sopra questa quotazione"
              valore={v.quotazioneMinima ?? 0}
              onChange={(x) => cambia('quotazioneMinima', x === 0 ? null : x)}
              minimo={0}
              massimo={100}
              aiuto="Zero significa nessun filtro: si estrae da tutto il listone."
            />
            <p className="mt-2 rounded-xl border border-oro/30 bg-oro/10 px-3 py-2 text-xs text-oro">
              Senza filtro, l&apos;estrazione pesca anche fra centinaia di calciatori che non
              interessano a nessuno, e l&apos;asta si allunga con decine di passaggi a vuoto.
            </p>
          </div>
        )}

        <Scelta
          titolo="Chi conduce"
          valore={v.conduzione}
          onChange={(x) => cambia('conduzione', x)}
          opzioni={[
            { valore: 'app', nome: 'Dall\'app', spiega: 'Si rilancia dal telefono e il timer aggiudica da solo.' },
            { valore: 'live', nome: 'Dal vivo', spiega: 'Si urla al tavolo. L\'app fa da tabellone e chiudi tu.' },
          ]}
        />

        <Scelta
          titolo="Si può passare?"
          valore={v.tipoChiamata}
          onChange={(x) => cambia('tipoChiamata', x)}
          opzioni={[
            { valore: 'libera', nome: 'Chiamata libera', spiega: 'Si può rilanciare fino alla fine, sempre.' },
            { valore: 'con_passo', nome: 'Con passo', spiega: 'Chi passa è fuori da quel calciatore. Irreversibile.' },
          ]}
        />

        {v.conduzione === 'app' ? (
          <>
            <CampoNumero
              etichetta="Secondi di attesa dopo l'ultimo rilancio"
              valore={v.secondiInattivita}
              onChange={(x) => cambia('secondiInattivita', x)}
              minimo={3}
              massimo={120}
              aiuto="Passati questi senza offerte, parte il countdown."
            />
            <CampoNumero
              etichetta="Durata del countdown"
              valore={v.secondiCountdown}
              onChange={(x) => cambia('secondiCountdown', x)}
              minimo={3}
              massimo={60}
              aiuto="A zero il calciatore va al miglior offerente."
            />
          </>
        ) : (
          <p className="rounded-xl border border-verde-acceso/30 bg-verde-notte p-3 text-xs text-fumo">
            Dal vivo il timer è spento: i lotti li chiudi tu quando al tavolo avete finito di
            rilanciare.
          </p>
        )}

        {v.metodo === 'chiamata' && (
          <label className="flex items-center gap-3 text-sm text-nebbia">
            <input
              type="checkbox"
              checked={sorteggia}
              onChange={(e) => setSorteggia(e.target.checked)}
              className="size-5 accent-[var(--color-verde-acceso)]"
            />
            Sorteggia l&apos;ordine di chiamata
          </label>
        )}

        {messaggio && (
          <p className="rounded-xl border border-oro/40 bg-oro/10 px-4 py-3 text-sm text-oro">
            {messaggio}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Bottone
            aspetto="secondario"
            inCorso={configura.isPending}
            onClick={() =>
              configura.mutate(v, {
                onSuccess: (e) => setMessaggio(e.messaggio),
                onError: (e) => setMessaggio(e.message),
              })
            }
          >
            Salva le impostazioni
          </Bottone>

          <Bottone
            misura="grande"
            inCorso={apri.isPending}
            disabilitato={squadre.length < 2}
            onClick={() =>
              // Si salva e si apre in un gesto solo: dimenticare di salvare
              // prima di aprire sarebbe un errore irreversibile.
              configura.mutate(v, {
                onSuccess: () =>
                  apri.mutate(sorteggia, {
                    onSuccess: (e) => setMessaggio(e.messaggio),
                    onError: (e) => setMessaggio(e.message),
                  }),
                onError: (e) => setMessaggio(e.message),
              })
            }
          >
            Salva e apri l&apos;asta
          </Bottone>
        </div>

        {squadre.length < 2 && (
          <p className="text-xs text-oro">Servono almeno due squadre per aprire l&apos;asta.</p>
        )}
      </div>
    </section>
  )
}

function Scelta<T extends string>({
  titolo,
  valore,
  onChange,
  opzioni,
}: {
  titolo: string
  valore: T
  onChange: (v: T) => void
  opzioni: Array<{ valore: T; nome: string; spiega: string }>
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-nebbia">{titolo}</legend>
      <div className="flex flex-col gap-2">
        {opzioni.map((o) => {
          const scelto = o.valore === valore
          return (
            <button
              key={o.valore}
              type="button"
              onClick={() => onChange(o.valore)}
              aria-pressed={scelto}
              className={[
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                scelto
                  ? 'border-arancio bg-arancio/10'
                  : 'border-verde-campo bg-verde-notte hover:border-verde-acceso/50',
              ].join(' ')}
            >
              <span className={`block text-sm font-bold ${scelto ? 'text-arancio' : 'text-nebbia'}`}>
                {o.nome}
              </span>
              <span className="block text-xs text-fumo">{o.spiega}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
