import { Capacitor } from '@capacitor/core'

// Long-press shortcuts on the app icon (Today's session, Word Recall, Add a
// word, IELTS). In the Android app they arrive as a route: when a shortcut
// started the app, it is collected once the app is up; when Rien was already
// open, RienActivity sends it as a "rien-shortcut" event. The installed web
// app's shortcuts (nuxt.config.ts manifest) open their pages directly.
const ROUTES = new Set(['/session', '/games/word-recall', '/add-words', '/ielts'])

export default defineNuxtPlugin((nuxtApp) => {
  if (Capacitor.getPlatform() !== 'android') return
  const open = (route?: string | null) => {
    if (route && ROUTES.has(route)) void navigateTo(route)
  }
  window.addEventListener('rien-shortcut', event => open((event as CustomEvent<string>).detail))
  nuxtApp.hook('app:mounted', () => {
    void RienLook.takeLaunchRoute().then(({ route }) => open(route)).catch(() => {})
  })
})
