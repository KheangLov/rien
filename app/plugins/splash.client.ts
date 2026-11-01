import { Capacitor } from '@capacitor/core'

// Native apps: hide the launch logo once the first screen has drawn, with a short
// fade, instead of a fixed wait (capacitor.config.ts keeps it up until then).
export default defineNuxtPlugin((nuxtApp) => {
  if (!Capacitor.isNativePlatform()) return
  nuxtApp.hook('app:suspense:resolve', () => {
    requestAnimationFrame(() => {
      void import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
        .catch(() => {})
    })
  })
})
