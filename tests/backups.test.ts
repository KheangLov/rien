import { describe, expect, it } from 'vitest'
import { autoBackupDate, autoBackupDue, autoBackupName, backupAgeLabel, backupReminderDue, staleAutoBackups } from '#shared/utils/backups'

const now = new Date(2026, 10, 20, 10, 0)
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

describe('automatic backups', () => {
  it('keeps a copy weekly, and straight away the first time', () => {
    expect(autoBackupDue(undefined, now)).toBe(true)
    expect(autoBackupDue(daysAgo(6), now)).toBe(false)
    expect(autoBackupDue(daysAgo(7), now)).toBe(true)
  })

  it('names copies by date and keeps the newest four', () => {
    expect(autoBackupName(now)).toBe('rien-auto-2026-11-20.json')
    expect(autoBackupDate('rien-auto-2026-11-20.json')).toEqual(new Date(2026, 10, 20))
    const names = ['rien-auto-2026-10-01.json', 'rien-auto-2026-11-15.json', 'notes.txt', 'rien-auto-2026-10-23.json', 'rien-auto-2026-11-08.json', 'rien-auto-2026-10-30.json']
    expect(staleAutoBackups(names)).toEqual(['rien-auto-2026-10-01.json'])
  })
})

describe('web backup reminder', () => {
  it('waits for a few words, then reminds when the last backup is two weeks old', () => {
    expect(backupReminderDue(undefined, 2, now)).toBe(false)
    expect(backupReminderDue(undefined, 5, now)).toBe(true)
    expect(backupReminderDue(daysAgo(13), 50, now)).toBe(false)
    expect(backupReminderDue(daysAgo(14), 50, now)).toBe(true)
  })

  it('says how long ago in words', () => {
    expect(backupAgeLabel(undefined, now)).toBe('Never')
    expect(backupAgeLabel(daysAgo(0), now)).toBe('Today')
    expect(backupAgeLabel(daysAgo(1), now)).toBe('Yesterday')
    expect(backupAgeLabel(daysAgo(9), now)).toBe('9 days ago')
  })
})
