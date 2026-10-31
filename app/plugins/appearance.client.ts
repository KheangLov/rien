import { Capacitor } from '@capacitor/core'
import { useTheme } from '@squirkle-ui/ui'

// Light or dark following the phone (brand colours are set in nuxt.config.ts),
// and on iPhone a status bar and keyboard that behave like a native app.
export default defineNuxtPlugin(() => {
  const theme = useTheme()

  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    theme.name.value = dark.matches ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark.matches ? '#0b1220' : '#f7f7f5')
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/status-bar').then(({ StatusBar, Style }) =>
        StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light })).catch(() => {})
    }
  }
  apply()
  dark.addEventListener('change', apply)

  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/keyboard').then(({ Keyboard }) =>
      Keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {})
  }
})
