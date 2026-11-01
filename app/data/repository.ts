import type { AttemptRow, Backup, Book, BossResult, CardRow, GrammarRow, MistakeRow, MistakeType, NewWordInput, ReviewRow, SessionRow, Settings, TalkResult } from '#shared/schemas/db'
import type { GradedAnswer } from '#shared/utils/scheduler'

// All storage goes through this interface: Dexie on the web now,
// SQLite in the native iPhone app later.
export interface StudyRepository {
  getSettings(): Promise<Settings>
  saveSettings(patch: Partial<Settings>): Promise<Settings>

  addWord(input: NewWordInput, now?: Date): Promise<CardRow>
  deleteCard(id: string): Promise<void>
  // Adds, replaces or (with undefined) removes a word's picture.
  setCardImage(id: string, image: string | undefined): Promise<void>
  recentCards(limit: number): Promise<CardRow[]>
  dueCards(now: Date, limit: number): Promise<CardRow[]>
  countDue(now: Date): Promise<number>
  countCards(): Promise<number>
  // Words past the learning steps (FSRS state Review).
  countLearned(): Promise<number>
  cardsInFile(book: Book, file: number): Promise<CardRow[]>
  allCards(): Promise<CardRow[]>
  // Words reviewed for the first time since this moment (the daily new-word cap).
  countIntroducedSince(since: Date): Promise<number>

  // Stores the rescheduled card, its review and any mistake in one transaction.
  saveAnswer(graded: GradedAnswer): Promise<void>

  grammarStates(): Promise<GrammarRow[]>
  // The rescheduled item, any slip and the answer for the skill model, together.
  saveGrammarAnswer(row: GrammarRow, mistake?: MistakeRow, attempt?: AttemptRow): Promise<void>
  // Answers in games with no review schedule (quick games, File Boss, Say It).
  saveAttempts(attempts: AttemptRow[]): Promise<void>
  // The skill model and FSRS fitting learn from these.
  attemptsSince(since: Date): Promise<AttemptRow[]>
  reviewsSince(since: Date): Promise<ReviewRow[]>
  mistakeCounts(since: Date): Promise<Partial<Record<MistakeType, number>>>
  mistakesSince(since: Date): Promise<MistakeRow[]>
  // A slip with no review schedule of its own (Say It).
  saveMistake(mistake: MistakeRow): Promise<void>

  saveBossResult(result: BossResult): Promise<void>
  bossResults(): Promise<BossResult[]>

  saveTalk(result: TalkResult): Promise<void>
  talkResults(): Promise<TalkResult[]>

  // Adds a finished activity to that day's session row.
  recordActivity(date: string, game: string, minutes: number, score?: { clean: number, total: number }): Promise<void>
  studyDays(): Promise<string[]>
  sessions(): Promise<SessionRow[]>
  gamesOn(date: string): Promise<string[]>

  exportAll(now?: Date): Promise<Backup>
  // Replaces everything on this device with the backup (its parsed JSON, or
  // the file's text, which the web app reads in a background thread).
  importAll(backup: unknown): Promise<{ cards: number }>
}

export class DuplicateWordError extends Error {
  constructor(public readonly existing: CardRow) {
    super(`"${existing.answer}" is already in your words`)
    this.name = 'DuplicateWordError'
  }
}
