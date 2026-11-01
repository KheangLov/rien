import { IOS_SCREENS, SPLASH_DARK, SPLASH_LIGHT, splashFile } from './scripts/brand'

// The native iPhone app bundles its files, so it needs no service worker.
const native = process.env.RIEN_NATIVE === '1'
// Test builds only: plays every game through the real screens (e2e/runner.client.ts).
const e2e = process.env.RIEN_E2E === '1'
// Profiling builds (RIEN_PROFILE=1): source maps, so slow frames can be traced
// back to the code that caused them.
const profile = process.env.RIEN_PROFILE === '1'

// Client-only static build: no server rendering, no backend (see plan "Technical plan").
export default defineNuxtConfig({
  compatibilityDate: '2026-10-31',
  ssr: false,
  devtools: { enabled: true },

  modules: ['@squirkle-ui/nuxt', '@vite-pwa/nuxt'],

  css: ['~/assets/css/main.css'],

  plugins: e2e ? ['~~/e2e/runner.client.ts'] : [],
  sourcemap: { client: profile ? 'hidden' : false },

  app: {
    // Overridden per navigation by middleware/transition.global.ts.
    pageTransition: { name: 'fade', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Rien',
      meta: [
        // viewport-fit=cover is required for env(safe-area-inset-*) on iPhone.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // Set again by plugins/appearance.client.ts from her appearance setting.
        { name: 'theme-color', content: SPLASH_LIGHT, media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: SPLASH_DARK, media: '(prefers-color-scheme: dark)' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'color-scheme', content: 'light dark' },
        { name: 'apple-mobile-web-app-title', content: 'Rien' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // The web app's manifest (from pwa.manifest below). Browsers only offer to
        // install a site whose page links one; @vite-pwa/nuxt does not add it.
        ...(native ? [] : [{ rel: 'manifest' as const, href: '/manifest.webmanifest' }]),
        // iPhone home-screen splash screens, light and dark (scripts/build-brand.mjs).
        ...IOS_SCREENS.flatMap(screen => (['light', 'dark'] as const).map(mode => ({
          rel: 'apple-touch-startup-image' as const,
          href: splashFile(screen, mode),
          media: `(device-width: ${screen[0]}px) and (device-height: ${screen[1]}px) and (-webkit-device-pixel-ratio: ${screen[2]}) and (orientation: portrait) and (prefers-color-scheme: ${mode})`,
        }))),
      ],
    },
  },

  squirkle: {
    addons: ['charts'],
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
    // The system font (SF Pro on Apple devices), as native apps use.
    appearance: { font: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, 'Khmer Sangam MN', 'Noto Sans Khmer', sans-serif" },
    // The app must work offline, so no Iconify API and no web fonts.
    icons: {
      api: false,
      // Squirkle's own controls (clear buttons, chevrons, alerts, checkboxes) draw
      // Solar too, from the same bundled subset (scripts/build-icons.mjs). Built-in
      // names need patches/@squirkle-ui__ui@0.1.1.patch (upstream issue 12).
      aliases: {
        close: 'solar:close-circle-bold',
        check: 'solar:rien-check-linear',
        plus: 'solar:rien-plus-linear',
        minus: 'solar:rien-minus-linear',
        chevronDown: 'solar:alt-arrow-down-linear',
        chevronUp: 'solar:alt-arrow-up-linear',
        chevronLeft: 'solar:alt-arrow-left-linear',
        chevronRight: 'solar:alt-arrow-right-linear',
        search: 'solar:magnifer-linear',
        info: 'solar:info-circle-bold',
        success: 'solar:check-circle-bold',
        warning: 'solar:danger-triangle-bold',
        error: 'solar:danger-circle-bold',
        calendar: 'solar:calendar-linear',
        clock: 'solar:clock-circle-linear',
        attach: 'solar:paperclip-linear',
        eye: 'solar:eye-linear',
        eyeOff: 'solar:eye-closed-linear',
        delete: 'solar:trash-bin-minimalistic-linear',
        edit: 'solar:pen-linear',
      },
    },
    locale: { code: 'en' },
  },

  pwa: {
    disable: native,
    registerType: 'prompt',
    manifest: {
      id: '/',
      name: 'Rien: English study',
      short_name: 'Rien',
      description: 'Daily English practice, ACE Level 6 to Level 12.',
      lang: 'en',
      display: 'standalone',
      display_override: ['standalone'],
      categories: ['education'],
      orientation: 'portrait',
      start_url: '/',
      scope: '/',
      theme_color: '#0f766e',
      // Android's launch screen for the installed app: this colour and the icon.
      background_color: SPLASH_LIGHT,
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        // Full-bleed, so the phone's own icon shape cuts it cleanly.
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      // Long-press the app icon (Android): straight to these screens. The
      // Android app has the same (RienShortcuts.java); icons from build-brand.mjs.
      shortcuts: [
        { name: 'Today\'s session', short_name: 'Session', url: '/session', icons: [{ src: '/shortcuts/session.png', sizes: '96x96', type: 'image/png' }] },
        { name: 'Word Recall', short_name: 'Words', url: '/games/word-recall', icons: [{ src: '/shortcuts/words.png', sizes: '96x96', type: 'image/png' }] },
        { name: 'Add a word', short_name: 'Add word', url: '/add-words', icons: [{ src: '/shortcuts/add.png', sizes: '96x96', type: 'image/png' }] },
        { name: 'IELTS practice', short_name: 'IELTS', url: '/ielts', icons: [{ src: '/shortcuts/ielts.png', sizes: '96x96', type: 'image/png' }] },
      ],
    },
    workbox: {
      // Client-only app: every route is the same shell, so precache only index.html
      // and serve it for all navigations. Precaching the other prerendered pages
      // added extension-less URLs (/settings, /404) that some hosts cannot serve,
      // and one failed download aborts the whole offline install.
      navigateFallback: '/',
      globPatterns: ['index.html', '**/*.{js,css,png,svg,ico,json,woff2,mp3}'],
      // iOS keeps its own copy of the splash images when the app is added to
      // the home screen; precaching all twenty would only slow the offline install.
      // Icons in each main colour are fetched only if she chooses one.
      globIgnores: ['splash/**', 'icons/**'],
      // Serves the manifest in her colours (public/sw-look.js).
      importScripts: ['sw-look.js'],
      cleanupOutdatedCaches: true,
    },
    client: { installPrompt: true },
    devOptions: { enabled: false },
  },
})
