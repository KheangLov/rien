// Installing Rien from the browser. When the browser offers its own install
// prompt (Chrome and Edge, kept by @vite-pwa/nuxt until we ask for it), Install
// opens it. Otherwise (iPhone and iPad, Samsung Internet, Firefox, or Chrome
// before it decides to offer) a sheet shows the steps for this browser.
// Browsers only install from a secure (https) address, so the sheet says so
// when this page is not on one, for example opened over the local network.
const DISMISSED_KEY = 'rien-install-dismissed'
// "Not now" hides the Today card for two weeks; Settings always offers it.
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000

export function useInstall() {
  const { $pwa } = useNuxtApp()
  const guideOpen = useState('rien-install-guide', () => false)
  const standalone = useState('rien-standalone', () => false)
  const platform = useState<'ios' | 'android' | 'desktop'>('rien-platform', () => 'desktop')
  const ios = computed(() => platform.value === 'ios')
  const secure = useState('rien-secure', () => true)
  const dismissedAt = useState('rien-install-dismissed', () => 0)

  if (import.meta.client && !isNativeApp()) {
    onMounted(() => {
      standalone.value =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      // iPadOS reports itself as a Mac, so also check for touch.
      const ua = navigator.userAgent
      platform.value = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
        ? 'ios'
        : /Android/.test(ua) ? 'android' : 'desktop'
      secure.value = window.isSecureContext
      try {
        dismissedAt.value = Number(localStorage.getItem(DISMISSED_KEY)) || 0
      }
      catch {}
    })
  }

  // Offered whenever Rien is open in a browser rather than installed.
  const canInstall = computed(() => !isNativeApp() && !standalone.value && !$pwa?.isPWAInstalled)
  // The browser's own one-tap install is ready.
  const promptReady = computed(() => Boolean($pwa?.showInstallPrompt))
  const showCard = computed(() => canInstall.value && Date.now() - dismissedAt.value > DISMISS_FOR_MS)

  async function install() {
    haptic('tap')
    if ($pwa?.showInstallPrompt) await $pwa.install()
    else guideOpen.value = true
  }

  function dismiss() {
    dismissedAt.value = Date.now()
    try {
      localStorage.setItem(DISMISSED_KEY, String(dismissedAt.value))
    }
    catch {}
  }

  return { canInstall, promptReady, showCard, install, dismiss, guideOpen, platform, ios, secure }
}
