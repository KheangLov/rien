import { Capacitor } from '@capacitor/core'
import { useTheme } from '@squirkle-ui/ui'

// Appearance (system, light or dark), Liquid Glass and motion from her
// settings (brand colours are set in nuxt.config.ts). Applied as classes on
// <html>, plus the Squirkle theme, the browser theme colour and, on iPhone,
// the status bar. Motion also stays off when the phone asks for reduced motion.
export default defineNuxtPlugin(() => {
  const theme = useTheme()
  const db = useDb()
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  root.classList.add('rien-glass', 'rien-motion')

  const sync = async () => {
    const settings = await db.getSettings()
    const dark = settings.appearance === 'dark' || (settings.appearance === 'system' && systemDark.matches)
    theme.name.value = dark ? 'dark' : 'light'
    root.classList.toggle('rien-dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1220' : '#f7f7f5')
    root.classList.toggle('rien-glass', settings.liquidGlass)
    root.classList.toggle('rien-motion', settings.motion && !reduce.matches)
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/status-bar').then(({ StatusBar, Style }) =>
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })).catch(() => {})
    }
  }
  void sync()
  db.subscribe(() => void sync())
  systemDark.addEventListener('change', () => void sync())
  reduce.addEventListener('change', () => void sync())

  // iPhone: tapping the status bar scrolls back to the top, as in native apps.
  window.addEventListener('statusTap', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/keyboard').then(({ Keyboard }) =>
      Keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {})
  }
})
