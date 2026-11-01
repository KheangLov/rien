import { Capacitor } from '@capacitor/core'
import { autoBackupDue } from '#shared/utils/backups'

// Keeps her words safe without her thinking about it (shared/utils/backups.ts).
// The Rien app saves its own weekly copy, a little after start so it never
// slows opening. The web app asks the browser to keep its storage for good,
// so it is not cleared when the phone runs low on space.
const START_DELAY_MS = 8000

export default defineNuxtPlugin(() => {
  if (!Capacitor.isNativePlatform()) {
    void navigator.storage?.persisted?.().then(kept => kept || navigator.storage.persist()).catch(() => {})
    return
  }
  setTimeout(() => {
    void (async () => {
      const db = useDb()
      const now = new Date()
      const settings = await db.getSettings()
      if (!autoBackupDue(settings.lastAutoBackupAt, now)) return
      // Nothing to keep yet: no words and no study days.
      if ((await db.countCards()) === 0 && (await db.studyDays()).length === 0) return
      await saveAutoBackup(now)
    })().catch(error => console.error('[rien] automatic backup failed', error))
  }, START_DELAY_MS)
})
