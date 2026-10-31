import { Capacitor } from '@capacitor/core'
import type { Settings } from '#shared/schemas/db'

const REMINDER_ID = 1

// One daily study reminder, native app only. Returns false if she has not
// allowed notifications.
export async function applyReminder(reminder: Settings['reminder']): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] })
  if (!reminder.enabled) return true

  let permission = await LocalNotifications.checkPermissions()
  if (permission.display === 'prompt' || permission.display === 'prompt-with-rationale') {
    permission = await LocalNotifications.requestPermissions()
  }
  if (permission.display !== 'granted') return false

  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: 'Rien · រៀន',
      body: 'Ten minutes of English? Your words are waiting.',
      // Repeats every day at this time.
      schedule: { on: { hour: reminder.hour, minute: reminder.minute }, allowWhileIdle: true },
    }],
  })
  return true
}
