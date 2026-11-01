import { Capacitor, registerPlugin } from '@capacitor/core'
import { useTheme } from '@squirkle-ui/ui'
import type { Settings } from '#shared/schemas/db'

// Appearance (system, light or dark), Liquid Glass and motion from her
// settings (brand colours are set in nuxt.config.ts). Applied as classes on
// <html>, plus the Squirkle theme, the browser theme colour and, on iPhone,
// the status bar. Motion also stays off when the phone asks for reduced motion.
// Settings applies a change at once through $setAppearance (animated for
// light ↔ dark); saved settings reach here too, through sync.
// Android only (android/…/RienLookPlugin.java): her Appearance for the
// system's own splash screen at launch.
const RienLook = registerPlugin<{ setAppearance: (options: { appearance: Settings['appearance'] }) => Promise<void> }>('RienLook')

type Look = Pick<Settings, 'appearance' | 'liquidGlass' | 'motion' | 'accent'>

export default defineNuxtPlugin(() => {
  const theme = useTheme()
  const db = useDb()
  const root = document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  root.classList.add('rien-glass', 'rien-motion')

  const isDark = (look: Look) => look.appearance === 'dark' || (look.appearance === 'system' && systemDark.matches)
  const keyOf = (look: Look) => `${look.appearance}${isDark(look)}${look.liquidGlass}${look.motion && !reduce.matches}${look.accent}`
  let painted = ''

  // Applies a look in one pass, and only when something changed (every save
  // to the database calls sync, and most saves are answers, not settings).
  // Squirkle's theme class is set here too, not on its watcher's next tick,
  // so the page restyles once instead of twice.
  function paint(look: Look) {
    const key = keyOf(look)
    if (key === painted) return
    painted = key
    const dark = isDark(look)
    const motion = look.motion && !reduce.matches
    theme.name.value = dark ? 'dark' : 'light'
    for (const c of [...root.classList]) if (c.startsWith('sq-theme--')) root.classList.remove(c)
    root.classList.add(`sq-theme--${dark ? 'dark' : 'light'}`)
    root.classList.toggle('rien-dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    // Her setting wins over the light/dark pair in nuxt.config.ts: the bar
    // takes the page's own background, tinted by her colour.
    const background = backgroundOf(look.accent)
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', dark ? background.dark : background.light)
      meta.removeAttribute('media')
    }
    root.classList.toggle('rien-glass', look.liquidGlass)
    // Her main colour (Settings), as a stylesheet of its own.
    let accent = document.getElementById('rien-accent')
    if (!accent) {
      accent = document.createElement('style')
      accent.id = 'rien-accent'
      document.head.append(accent)
    }
    accent.textContent = accentCss(look.accent)
    saveSplashColours(look.accent, look.appearance)
    if (!Capacitor.isNativePlatform()) setTabIcon(look.accent)
    root.classList.toggle('rien-motion', motion)
    if (Capacitor.getPlatform() === 'android') void RienLook.setAppearance({ appearance: look.appearance }).catch(() => {})
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/status-bar').then(({ StatusBar, Style }) =>
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })).catch(() => {})
    }
  }

  // Without this, every card, button and field fades its own colours on its
  // own timer while the glass repaints each frame: the switch drags.
  // Reading offsetWidth applies the new styles while transitions are off, so
  // nothing is left to fade once the class goes (and no frame is waited for,
  // which a page in the background would never get).
  function instantly(change: () => void) {
    root.classList.add('rien-theme-switching')
    change()
    void root.offsetWidth
    root.classList.remove('rien-theme-switching')
  }

  // Where she last touched, so a light/dark switch spreads from her finger.
  let tap = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  window.addEventListener('pointerdown', (e) => { tap = { x: e.clientX, y: e.clientY } }, { capture: true, passive: true })

  // Settings calls this as soon as she taps, before saving, so the change is
  // immediate. Light ↔ dark is revealed as a circle growing from the tap.
  function setAppearance(look: Look) {
    const animate = isDark(look) !== root.classList.contains('rien-dark') &&
      look.motion && !reduce.matches && 'startViewTransition' in document
    if (!animate) return instantly(() => paint(look))
    // In percentages of the screen: px in the transition's layer do not match
    // CSS px on every screen. A circle's % radius is of √((w² + h²) / 2).
    const w = window.innerWidth
    const h = window.innerHeight
    const radius = Math.hypot(Math.max(tap.x, w - tap.x), Math.max(tap.y, h - tap.y))
    root.style.setProperty('--rien-reveal-x', `${(tap.x / w) * 100}%`)
    root.style.setProperty('--rien-reveal-y', `${(tap.y / h) * 100}%`)
    root.style.setProperty('--rien-reveal-r', `${Math.ceil((radius / Math.sqrt((w * w + h * h) / 2)) * 100) + 1}%`)
    root.classList.add('rien-theme-switching')
    document.startViewTransition(() => paint(look)).finished
      .finally(() => root.classList.remove('rien-theme-switching'))
  }

  const sync = async () => {
    const settings = await db.getSettings()
    if (keyOf(settings) !== painted) instantly(() => paint(settings))
  }
  void sync()
  db.subscribe(() => void sync())
  systemDark.addEventListener('change', () => void sync())
  reduce.addEventListener('change', () => void sync())

  // iPhone: tapping the status bar scrolls back to the top, as in native apps.
  window.addEventListener('statusTap', () => window.scrollTo({ top: 0, behavior: 'smooth' }))

  // Native apps: holding a link or button opens no menu (Android's web view
  // offers "open link" and copy otherwise). Text fields keep theirs.
  window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null
    if (!target?.closest('input, textarea, [contenteditable="true"]')) e.preventDefault()
  })

  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/keyboard').then(({ Keyboard }) =>
      Keyboard.setAccessoryBarVisible({ isVisible: false })).catch(() => {})
  }

  return { provide: { setAppearance } }
})
