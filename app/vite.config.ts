/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { registryCheck } from './build/registryCheck.ts'
import { screenIcons } from './build/screenIcons.ts'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const lucideIconsDir = fileURLToPath(
  new URL('./node_modules/lucide-react/dist/esm/icons', import.meta.url),
)

export default defineConfig({
  plugins: [
    registryCheck(srcDir),
    screenIcons(srcDir, lucideIconsDir),
    react(),
    tailwindcss(),
    VitePWA({
      // A new deploy installs a new service worker, which takes over and reloads open tabs.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ophiuchus',
        short_name: 'Ophiuchus',
        description: 'Astronaut health console: read your health indicators and know when to act.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#07090F',
        theme_color: '#07090F',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@': srcDir },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
