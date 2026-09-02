import { useState } from 'react'
import { motion } from 'motion/react'
import { Bottone } from '@/components/Bottone'
import { Interruttore } from '@/components/Interruttore'
import { useImpostaOpzione, useScegliMetodo } from './api'
import type { ListaObiettivi, MetodoLista } from './tipi'

/**
 * La prima cosa che si vede: come vuoi prepararti.
 *
 * Fasce e slot rispondono alla stessa domanda, «in che ordine provo a
 * comprare», in due modi diversi. Tenerli accesi insieme non aiuta a
 * decidere: raddoppia il lavoro e lascia due elenchi da mantenere allineati.
 * Per questo qui si sceglie, non si accende.
 *
 * Il tetto di spesa e l'incrocio portieri sono un'altra cosa: si aggiungono a
 * quello che hai scelto, e si accendono e spengono quando vuoi.
 */
export function SceltaMetodo({
  lista,
  idLega,
  primaVolta,
  onAnnulla,
}: {
  lista: ListaObiettivi
  idLega: string | undefined
  primaVolta: boolean
  onAnnulla?: () => void
}) {
  const scegli = useScegliMetodo(idLega)
  const opzione = useImpostaOpzione(idLega)
  const [metodo, setMetodo] = useState<MetodoLista>(lista.metodo)

  const quantiInFasce = lista.targets.length
  const quantiInSlot = lista.roster_slots.reduce((s, x) => s + x.slot_candidates.length, 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-nebbia">
          {primaVolta ? 'Come vuoi prepararti?' : 'Cambia metodo'}
        </h1>
        <p className="mt-1 text-sm text-fumo">
          Due modi diversi di rispondere alla stessa domanda: in che ordine provi a comprare. Se ne
          sceglie uno.
        </p>
      </div>

      <Scheda
        scelto={metodo === 'fasce'}
        onClick={() => setMetodo('fasce')}
        titolo="Le fasce"
        sottotitolo="Gruppi di valore equivalente"
        icona="🪜"
      >
        Raggruppi i calciatori per quanto valgono <em>per te</em>, non in classifica. Se durante
        l&apos;asta un avversario ti porta via il tuo obiettivo, sai subito chi pescare dallo stesso
        livello senza perdere qualità.
      </Scheda>

      <Scheda
        scelto={metodo === 'slot'}
        onClick={() => setMetodo('slot')}
        titolo="Gli slot"
        sottotitolo="La rosa ideale, casella per casella"
        icona="🎯"
      >
        Immagini la rosa già divisa in posti: il primo attaccante, il secondo, la scommessa. Per
        ogni casella metti i candidati in ordine di preferenza, e durante l&apos;asta sai sempre
        quale posto stai riempiendo.
      </Scheda>

      {/* Onestà: cambiare metodo non cancella niente, e va detto prima. */}
      {!primaVolta && metodo !== lista.metodo && (
        <p className="rounded-xl border border-verde-acceso/40 bg-verde-acceso/10 px-4 py-3 text-sm text-nebbia">
          Passando a <strong>{metodo === 'fasce' ? 'fasce' : 'slot'}</strong> non perdi niente:
          {metodo === 'slot'
            ? ` le tue ${lista.tiers.length} fasce e i ${quantiInFasce} calciatori restano dove sono, e li ritrovi tornando indietro.`
            : ` i tuoi slot e i ${quantiInSlot} candidati restano dove sono, e li ritrovi tornando indietro.`}
        </p>
      )}

      <section className="rounded-2xl border border-verde-campo bg-verde-campo/30 p-4">
        <h2 className="text-base font-bold text-nebbia">Da aggiungere, se ti servono</h2>
        <p className="mt-0.5 mb-4 text-xs text-fumo">
          Funzionano con tutti e due i metodi e si accendono quando vuoi.
        </p>
        <div className="flex flex-col gap-4">
          <Interruttore
            etichetta="Tetto di spesa"
            descrizione="Il prezzo massimo che ti imponi su ogni calciatore, per non farti prendere dai rilanci."
            acceso={lista.usa_tetti}
            onChange={(acceso) =>
              opzione.mutate({ idLista: lista.id, campo: 'usa_tetti', acceso })
            }
          />
          <Interruttore
            etichetta="Incrocio portieri"
            descrizione="Coppie di portieri con i calendari che si alternano, per averne sempre uno con la partita facile."
            acceso={lista.usa_incroci}
            onChange={(acceso) =>
              opzione.mutate({ idLista: lista.id, campo: 'usa_incroci', acceso })
            }
          />
        </div>
        <p className="mt-4 text-xs text-fumo">
          La <strong className="text-nebbia">nota</strong> su ogni calciatore c&apos;è sempre, in
          tutti e due i metodi: è quella che ti ricompare sul telefono quando quel nome viene
          chiamato all&apos;asta.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Bottone
          misura="grande"
          inCorso={scegli.isPending}
          onClick={() => scegli.mutate({ idLista: lista.id, metodo })}
        >
          {primaVolta ? 'Comincia con questo metodo' : 'Usa questo metodo'}
        </Bottone>
        {!primaVolta && onAnnulla && (
          <Bottone aspetto="fantasma" misura="grande" onClick={onAnnulla}>
            Lascia stare
          </Bottone>
        )}
      </div>
    </div>
  )
}

function Scheda({
  scelto,
  onClick,
  titolo,
  sottotitolo,
  icona,
  children,
}: {
  scelto: boolean
  onClick: () => void
  titolo: string
  sottotitolo: string
  icona: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-pressed={scelto}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.12 }}
      className={[
        'rounded-2xl border p-4 text-left transition-colors',
        scelto
          ? 'border-arancio bg-arancio/10'
          : 'border-verde-campo bg-verde-campo/30 hover:border-verde-acceso/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-3xl">
          {icona}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-lg font-bold ${scelto ? 'text-arancio' : 'text-nebbia'}`}>{titolo}</p>
          <p className="text-xs uppercase tracking-wide text-fumo">{sottotitolo}</p>
          <p className="mt-2 text-sm text-fumo">{children}</p>
        </div>
        <span
          aria-hidden
          className={[
            'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs',
            scelto ? 'border-arancio bg-arancio text-carbone' : 'border-fumo/40 text-transparent',
          ].join(' ')}
        >
          ✓
        </span>
      </div>
    </motion.button>
  )
}
