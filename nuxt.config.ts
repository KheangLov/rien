// The native iPhone app bundles its files, so it needs no service worker.
const native = process.env.RIEN_NATIVE === '1'
// Test builds only: plays every game through the real screens (e2e/runner.client.ts).
const e2e = process.env.RIEN_E2E === '1'

// Client-only static build: no server rendering, no backend (see plan "Technical plan").
export default defineNuxtConfig({
  compatibilityDate: '2026-10-31',
  ssr: false,
  devtools: { enabled: true },

  modules: ['@squirkle-ui/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  plugins: e2e ? ['~~/e2e/runner.client.ts'] : [],

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Rien',
      meta: [
        // viewport-fit=cover is required for env(safe-area-inset-*) on iPhone.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f7f7f5' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'color-scheme', content: 'light dark' },
        { name: 'apple-mobile-web-app-title', content: 'Rien' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  squirkle: {
    addons: ['charts', 'calendar'],
    prefix: 'Sq',
    css: true,
    // Brand colours go in here, not through useTheme().setBrand() at runtime: the
    // module writes the theme CSS into the page head once, and the head manager
    // puts that version back, overwriting runtime changes.
    theme: {
      defaultTheme: 'light',
      themes: {
        light: { colors: { primary: '#0f766e' } },
        // A lighter teal so buttons and links stay readable on dark surfaces.
        dark: { dark: true, colors: { primary: '#2dd4bf' } },
      },
    },
    squircle: { mode: 'auto' },
    // The app must work offline, so no Iconify API and no web fonts.
    icons: { api: false },
    locale: { code: 'en' },
  },

  pwa: {
    disable: native,
    registerType: 'prompt',
    manifest: {
      name: 'Rien: English study',
      short_name: 'Rien',
      description: 'Daily English practice, ACE Level 6 to Level 12.',
      lang: 'en',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      theme_color: '#0f766e',
      background_color: '#f7f7f5',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Client-only app: every route is the same shell, so precache only index.html
      // and serve it for all navigations. Precaching the other prerendered pages
      // added extension-less URLs (/settings, /404) that some hosts cannot serve,
      // and one failed download aborts the whole offline install.
      navigateFallback: '/',
      globPatterns: ['index.html', '**/*.{js,css,png,svg,ico,json,woff2,mp3}'],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
})
