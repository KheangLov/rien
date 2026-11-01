import { Capacitor } from '@capacitor/core'

// Native apps: the launch logo stays until the first screen has drawn and for
// at least MIN_SHOWN_MS (Rien draws in about 0.4 s, which only flashed the logo),
// then fades. capacitor.config.ts keeps it up until then.
const MIN_SHOWN_MS = 1000

export default defineNuxtPlugin((nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return
  nuxtApp.hook('app:suspense:resolve', () => {
    requestAnimationFrame(() => {
      const wait = Math.max(0, MIN_SHOWN_MS - performance.now())
      setTimeout(() => {
        void import('@capacitor/splash-screen')
          .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 300 }))
          .catch(() => {})
      }, wait)
    })
  })
})
