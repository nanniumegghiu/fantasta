// Confronta i pacchetti dichiarati in package.json con l'elenco autorizzato
// dagli ADR 0006 e 0007. Serve a far rispettare la regola "nessuna dipendenza
// senza motivo scritto" anche quando un comando ne installa una di nascosto.
//
// Si esegue alla fine di ogni fetta: `npm run controlla-dipendenze`.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const qui = dirname(fileURLToPath(import.meta.url))
const pacchetto = JSON.parse(readFileSync(join(qui, '..', 'package.json'), 'utf8'))

// Elenco autorizzato. Aggiungere una voce qui senza il corrispondente ADR
// significa aggirare la regola: non farlo.
const AUTORIZZATI = new Set([
  // ADR-0006, base
  'vite',
  'typescript',
  'react',
  'react-dom',
  '@vitejs/plugin-react',
  // ADR-0006, applicazione
  'react-router-dom',
  '@supabase/supabase-js',
  '@tanstack/react-query',
  '@tanstack/react-virtual',
  'motion',
  'tailwindcss',
  '@tailwindcss/vite',
  'vite-plugin-pwa',
  // ADR-0007, pacchetti di soli tipi
  '@types/node',
  '@types/react',
  '@types/react-dom',
])

const dichiarati = [
  ...Object.keys(pacchetto.dependencies ?? {}),
  ...Object.keys(pacchetto.devDependencies ?? {}),
].sort()

const estranei = dichiarati.filter((n) => !AUTORIZZATI.has(n))
const mancanti = [...AUTORIZZATI].filter((n) => !dichiarati.includes(n)).sort()

console.log(`Pacchetti dichiarati: ${dichiarati.length} · autorizzati: ${AUTORIZZATI.size}`)

if (mancanti.length > 0) {
  console.log('\nAutorizzati ma non installati (va bene se la fetta non li usa ancora):')
  for (const n of mancanti) console.log(`  - ${n}`)
}

if (estranei.length > 0) {
  console.error('\nNON AUTORIZZATI: o si tolgono, o si scrive un ADR che li motiva.')
  for (const n of estranei) console.error(`  - ${n}`)
  process.exit(1)
}

console.log('\nNessun pacchetto estraneo. Elenco allineato agli ADR 0006 e 0007.')
