import type { Backup, CardRow, NewWordInput, Settings } from '#shared/schemas/db'
import type { GradedAnswer } from '#shared/utils/scheduler'

// All storage goes through this interface: Dexie on the web now,
// SQLite in the native iPhone app later.
export interface StudyRepository {
  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>

  addWord(input: NewWordInput, now?: Date): Promise<CardRow>
  deleteCard(id: string): Promise<void>
  recentCards(limit: number): Promise<CardRow[]>
  dueCards(now: Date, limit: number): Promise<CardRow[]>
  countDue(now: Date): Promise<number>
  countCards(): Promise<number>

  // Stores the rescheduled card, its review and any mistake in one transaction.
  saveAnswer(graded: GradedAnswer): Promise<void>

  exportAll(now?: Date): Promise<Backup>
  // Replaces everything on this device with the backup.
  importAll(backup: unknown): Promise<{ cards: number }>
}

export class DuplicateWordError extends Error {
  constructor(public readonly existing: CardRow) {
    super(`"${existing.answer}" is already in your words`)
    this.name = 'DuplicateWordError'
  }
}
