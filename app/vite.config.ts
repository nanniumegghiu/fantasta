import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// Configurazione di Fantasta.
// Le tre estensioni sono quelle autorizzate da docs/adr/0006-dipendenze-iniziali.md.
export default defineConfig({
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
        start_url: '/',
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
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Serve per aprire l'app dal telefono sulla stessa rete durante le prove.
    host: true,
  },
})
