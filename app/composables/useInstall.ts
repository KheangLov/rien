// Installing Rien from the browser. Android and desktop Chrome offer their own
// install prompt (kept by @vite-pwa/nuxt until we ask for it); iPhone browsers
// have none, so there a sheet shows the Share → Add to Home Screen steps.
const DISMISSED_KEY = 'rien-install-dismissed'
// "Not now" hides the Today card for two weeks; Settings always offers it.
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000

export function useInstall() {
  const { $pwa } = useNuxtApp()
  const guideOpen = useState('rien-install-guide', () => false)
  const standalone = useState('rien-standalone', () => false)
  const ios = useState('rien-ios-browser', () => false)
  const dismissedAt = useState('rien-install-dismissed', () => 0)

  if (import.meta.client && !isNativeApp()) {
    onMounted(() => {
      standalone.value =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
      // iPadOS reports itself as a Mac, so also check for touch.
      ios.value = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
      try {
        dismissedAt.value = Number(localStorage.getItem(DISMISSED_KEY)) || 0
      }
      catch {}
    })
  }

  // Installing is possible here: the browser's prompt is ready, or this is an
  // iPhone or iPad not yet opened from the home screen.
  const canInstall = computed(() =>
    !isNativeApp() && !standalone.value && !$pwa?.isPWAInstalled && (Boolean($pwa?.showInstallPrompt) || ios.value))
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

  return { canInstall, showCard, install, dismiss, guideOpen, ios }
}
