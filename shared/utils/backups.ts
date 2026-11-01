// When to keep a copy of her words, so a lost phone, a cleared browser or a
// slip of the finger never costs months of study.
// - The Rien app keeps its own copy every AUTO_BACKUP_DAYS, the newest
//   AUTO_BACKUPS_KEPT of them, inside the app. Phone backups (Google on Android,
//   iCloud on iPhone) include app data, so the copies leave the phone too.
// - A web page cannot save files by itself, so the web app reminds her once
//   her last backup is REMIND_AFTER_DAYS old.
export const AUTO_BACKUP_DAYS = 7
export const AUTO_BACKUPS_KEPT = 4
export const REMIND_AFTER_DAYS = 14
// Nothing worth reminding about before she has saved a few words.
export const REMIND_FROM_WORDS = 5

const DAY_MS = 86_400_000

export function daysSince(at: Date | undefined, now: Date): number | null {
  return at ? Math.floor((now.getTime() - at.getTime()) / DAY_MS) : null
}

export function autoBackupDue(last: Date | undefined, now: Date): boolean {
  const days = daysSince(last, now)
  return days === null || days >= AUTO_BACKUP_DAYS
}

export function backupReminderDue(last: Date | undefined, words: number, now: Date): boolean {
  if (words < REMIND_FROM_WORDS) return false
  const days = daysSince(last, now)
  return days === null || days >= REMIND_AFTER_DAYS
}

export function backupAgeLabel(last: Date | undefined, now: Date): string {
  const days = daysSince(last, now)
  if (days === null) return 'Never'
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// rien-auto-2026-11-01.json: dates in the name sort oldest to newest.
export function autoBackupName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `rien-auto-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

export function autoBackupDate(name: string): Date | undefined {
  const match = name.match(/^rien-auto-(\d{4})-(\d{2})-(\d{2})\.json$/)
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined
}

// Automatic copies past the newest few, to delete.
export function staleAutoBackups(names: readonly string[], keep = AUTO_BACKUPS_KEPT): string[] {
  return names.filter(name => autoBackupDate(name)).sort().reverse().slice(keep)
}
