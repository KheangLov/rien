import { Capacitor } from '@capacitor/core'

type Feel = 'success' | 'warning' | 'error' | 'tap'

// A short vibration that confirms an answer, like native learning apps.
// iPhone only (through Capacitor); Android browsers get navigator.vibrate.
export function haptic(feel: Feel) {
  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
      if (feel === 'tap') return Haptics.impact({ style: ImpactStyle.Light })
      const type = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error }[feel]
      return Haptics.notification({ type })
    }).catch(() => {})
    return
  }
  navigator.vibrate?.(feel === 'error' ? [30, 40, 30] : 15)
}
