import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/**
 * Il percorso da cui l'app viene servita.
 *
 * In locale e' la radice. Su GitHub Pages un progetto sta sotto il nome del
 * repository, `/fantasta/`, e ogni indirizzo assoluto scritto senza tenerne
 * conto porta a una pagina bianca senza spiegazioni: il file c'e', ma un
 * livello piu' su.
 *
 * Sta in una variabile d'ambiente perche' cambia con la destinazione e non con
 * il codice: lo stesso ramo si pubblica sotto un sottocartella o su un dominio
 * proprio senza toccare niente.
 */
const BASE = process.env.VITE_BASE ?? '/'

/**
 * La ricaduta per le rotte del client.
 *
 * Le rotte le gestisce il browser: `/lega/abc/asta` non e' un file, e un
 * servizio di file statici come GitHub Pages risponde 404. Pages pero' serve
 * `404.html` per ogni indirizzo che non trova: se quel file e' una copia
 * dell'indice, l'applicazione parte e il router riconosce l'indirizzo da solo.
 *
 * Sta qui e non in un passaggio del flusso di pubblicazione perche' serve a
 * chiunque compili, non solo a chi pubblica: una compilazione locale che si
 * comporta diversamente da quella vera e' una trappola.
 */
function ricadutaPerLeRotte() {
  return {
    name: 'fantasta-ricaduta-404',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url))
      copyFileSync(`${dist}/index.html`, `${dist}/404.html`)
    },
  }
}

// Configurazione di Fantasta.
// Le tre estensioni sono quelle autorizzate da docs/adr/0006-dipendenze-iniziali.md.
export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Fantasta',
        short_name: 'Fantasta',
        description: "L'asta del fantacalcio Classic, fra amici",
        lang: 'it',
        // Anche il manifesto va sotto il percorso base, altrimenti
        // l'applicazione installata parte da un indirizzo che non esiste.
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        // I colori vengono dal logo: vedi .claude/skills/design-system/SKILL.md
        theme_color: '#082B1D',
        background_color: '#082B1D',
        icons: [
          { src: 'icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icona-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // L'asta ha bisogno di dati freschi: non si mette in cache nulla del backend.
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // Le rotte sono del client: qualunque indirizzo deve tornare l'indice.
        navigateFallback: `${BASE}index.html`.replace('//', '/'),
      },
    }),
    ricadutaPerLeRotte(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Serve per aprire l'app dal telefono sulla stessa rete durante le prove.
    host: true,
  },
})
