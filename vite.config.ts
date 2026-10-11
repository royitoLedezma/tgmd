import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// La app se publica en https://<usuario>.github.io/tgmd/
export default defineConfig({
  base: '/tgmd/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'TGMD-2 Evaluación motora',
        short_name: 'TGMD-2',
        description: 'Graba, puntúa y genera informes del TGMD-2',
        lang: 'es',
        theme_color: '#0A6FA8',
        background_color: '#F4F7FA',
        display: 'standalone',
        start_url: '/tgmd/',
        scope: '/tgmd/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
