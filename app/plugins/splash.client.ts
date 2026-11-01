import { Capacitor } from '@capacitor/core'

// The animated opening screen (#rien-splash, from app/spa-loading-template.html)
// is already showing when this runs. On the phone apps it sits under the
// system's static launch screen, drawn identically, so that one is hidden
// straight away and the logo simply comes alive. Once the first screen is ready
// and the splash has had MIN_SHOWN_MS to play, it hands over: the logo grows
// and fades while the app fades in behind it.
const MIN_SHOWN_MS = 1300
const LEAVE_MS = 650

export default defineNuxtPlugin((nuxtApp) => {
  const splash = document.getElementById('rien-splash')

  if (Capacitor.isNativePlatform()) {
    // Two frames: the web splash has painted before the native one goes.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      void import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 150 }))
        .catch(() => {})
    }))
  }

  if (!splash) return
  nuxtApp.hook('app:suspense:resolve', () => {
    setTimeout(() => {
      const root = document.documentElement
      root.classList.add('rien-revealing')
      splash.classList.add('is-leaving')
      setTimeout(() => {
        splash.remove()
        root.classList.remove('rien-revealing')
      }, LEAVE_MS)
    }, Math.max(0, MIN_SHOWN_MS - performance.now()))
  })
})
