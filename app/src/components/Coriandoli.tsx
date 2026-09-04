import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useMovimentoRidotto } from '@/lib/movimento'

/**
 * I coriandoli dell'aggiudicazione.
 *
 * PERCHE' SCRITTI A MANO E NON PRESI DA UNA LIBRERIA
 *
 * ADR-0006 tiene chiuso l'elenco delle dipendenze: ogni pacchetto entra con un
 * motivo scritto. Un pacchetto di coriandoli pesa piu' di questo file, va
 * aggiornato, e serve per novecento millisecondi ogni due minuti. Trenta
 * rettangoli che cadono sono meno codice di quanto ne servirebbe per
 * giustificare il pacchetto che li eviterebbe.
 *
 * PERCHE' I COLORI SONO QUELLI DEL LOGO
 *
 * Perche' l'app e il marchio devono essere la stessa cosa: la palette e' stata
 * estratta dai pixel del logo apposta, e un coriandolo rosa qui dentro
 * sarebbe la prima cosa che non viene da li'.
 *
 * PERCHE' SI SMONTANO DA SOLI
 *
 * Nessun timer, nessuna pulizia da ricordare: il componente si monta quando
 * serve, `AnimatePresence` lo smonta, e con lui se ne vanno i trenta elementi.
 * Una festa che deve essere spenta a mano prima o poi resta accesa.
 */

const COLORI = [
  'var(--color-oro)',
  'var(--color-arancio)',
  'var(--color-verde-acceso)',
  'var(--color-oro-scuro)',
  'var(--color-nebbia)',
]

export function Coriandoli({ quanti = 34, durata = 0.9 }: { quanti?: number; durata?: number }) {
  const ridotto = useMovimentoRidotto()

  // Le posizioni si estraggono una volta sola: ricalcolarle a ogni fotogramma
  // farebbe saltellare i coriandoli invece di farli cadere.
  const pezzi = useMemo(
    () =>
      Array.from({ length: quanti }, (_, i) => ({
        id: i,
        sinistra: Math.random() * 100,
        ritardo: Math.random() * 0.25,
        larghezza: 5 + Math.random() * 7,
        altezza: 8 + Math.random() * 10,
        giro: (Math.random() - 0.5) * 720,
        deriva: (Math.random() - 0.5) * 160,
        colore: COLORI[i % COLORI.length],
      })),
    [quanti],
  )

  // Chi ha chiesto meno movimento riceve l'informazione senza la festa: il
  // nome della squadra che cresce basta a dire che e' stato aggiudicato.
  if (ridotto) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pezzi.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-10%', x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '115%', x: p.deriva, opacity: [1, 1, 0], rotate: p.giro }}
          transition={{ duration: durata, delay: p.ritardo, ease: [0.2, 0.6, 0.5, 1] }}
          style={{
            left: `${p.sinistra}%`,
            width: p.larghezza,
            height: p.altezza,
            background: p.colore,
          }}
          className="absolute top-0 rounded-[2px]"
        />
      ))}
    </div>
  )
}
