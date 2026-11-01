import Dexie, { type EntityTable } from 'dexie'
import { State } from 'ts-fsrs'
import {
  attemptSchema,
  writingSchema,
  backupSchema,
  cardSchema,
  newWordSchema,
  settingsSchema,
  type AttemptRow,
  type WritingRow,
  type BossResult,
  type CardRow,
  type GrammarRow,
  type MistakeRow,
  type MistakeType,
  type ReviewRow,
  type SessionRow,
  type Settings,
  type TalkResult,
} from '#shared/schemas/db'
import { normalizeAnswer } from '#shared/utils/answer'
import { newFsrsState } from '#shared/utils/scheduler'
import { DuplicateWordError, type StudyRepository } from './repository'

type SettingsRow = Settings & { key: 'settings' }

export class RienDexie extends Dexie {
  cards!: EntityTable<CardRow, 'id'>
  reviews!: EntityTable<ReviewRow, 'id'>
  mistakes!: EntityTable<MistakeRow, 'id'>
  sessions!: EntityTable<SessionRow, 'date'>
  settings!: EntityTable<SettingsRow, 'key'>
  grammar!: EntityTable<GrammarRow, 'itemId'>
  bosses!: EntityTable<BossResult, 'id'>
  talks!: EntityTable<TalkResult, 'id'>
  attempts!: EntityTable<AttemptRow, 'id'>
  writings!: EntityTable<WritingRow, 'promptId'>

  constructor(name = 'rien') {
    super(name)
    this.version(1).stores({
      cards: 'id, due, type, answerKey, createdAt, [book+file]',
      reviews: '++id, cardId, at',
      mistakes: '++id, type, itemId, at',
      sessions: 'date',
      settings: 'key',
    })
    this.version(2).stores({
      grammar: 'itemId, due, type',
    })
    this.version(3).stores({
      bosses: '++id, at, [book+file]',
    })
    this.version(4).stores({
      talks: '++id, talkId, at',
    })
    this.version(5).stores({
      attempts: '++id, at, itemId, skill',
    })
    this.version(6).stores({
      writings: 'promptId',
    })
  }
}

export function createDexieRepository(db = new RienDexie()): StudyRepository {
  async function getSettings(): Promise<Settings> {
    const { key: _key, ...stored } = (await db.settings.get('settings')) ?? { key: 'settings' }
    return settingsSchema.parse(stored)
  }

  return {
    getSettings,

    async saveSettings(patch) {
      const next = settingsSchema.parse({ ...(await getSettings()), ...patch })
      await db.settings.put({ key: 'settings', ...next })
      return next
    },

    async addWord(input, now = new Date()) {
      const word = newWordSchema.parse(input)
      const answerKey = normalizeAnswer(word.answer)
      const existing = await db.cards.where('answerKey').equals(answerKey).first()
      if (existing) throw new DuplicateWordError(existing)

      const fsrs = newFsrsState(now)
      const card = cardSchema.parse({
        id: crypto.randomUUID(),
        type: 'word',
        ...word,
        answerKey,
        fsrs,
        due: fsrs.due,
        createdAt: now,
      })
      await db.cards.add(card)
      return card
    },

    async setCardImage(id, image) {
      const card = await db.cards.get(id)
      if (card) await db.cards.put(cardSchema.parse({ ...card, image }))
    },

    async deleteCard(id) {
      await db.transaction('rw', db.cards, db.reviews, db.mistakes, async () => {
        await db.cards.delete(id)
        await db.reviews.where('cardId').equals(id).delete()
        await db.mistakes.where('itemId').equals(id).delete()
      })
    },

    recentCards(limit) {
      return db.cards.orderBy('createdAt').reverse().limit(limit).toArray()
    },

    dueCards(now, limit) {
      return db.cards.where('due').belowOrEqual(now).limit(limit).toArray()
    },

    countDue(now) {
      return db.cards.where('due').belowOrEqual(now).count()
    },

    countCards() {
      return db.cards.count()
    },

    countLearned() {
      return db.cards.filter(card => card.fsrs.state === State.Review).count()
    },

    allCards() {
      return db.cards.orderBy('createdAt').reverse().toArray()
    },

    countIntroducedSince(since) {
      return db.cards.filter(card => Boolean(card.introducedAt && card.introducedAt >= since)).count()
    },

    cardsInFile(book, file) {
      return db.cards.where('[book+file]').equals([book, file]).toArray()
    },

    async saveAnswer({ card, review, mistake }) {
      await db.transaction('rw', db.cards, db.reviews, db.mistakes, async () => {
        await db.cards.put(card)
        await db.reviews.add(review)
        if (mistake) await db.mistakes.add(mistake)
      })
    },

    grammarStates() {
      return db.grammar.toArray()
    },

    async saveGrammarAnswer(row, mistake, attempt) {
      await db.transaction('rw', db.grammar, db.mistakes, db.attempts, async () => {
        await db.grammar.put(row)
        if (mistake) await db.mistakes.add(mistake)
        if (attempt) await db.attempts.add(attemptSchema.parse(attempt))
      })
    },

    async saveAttempts(attempts) {
      await db.attempts.bulkAdd(attempts.map(a => attemptSchema.parse(a)))
    },

    async saveWriting(row) {
      await db.writings.put(writingSchema.parse(row))
    },
    writing: promptId => db.writings.get(promptId),

    attemptsSince: since => db.attempts.where('at').aboveOrEqual(since).sortBy('at'),
    reviewsSince: since => db.reviews.where('at').aboveOrEqual(since).sortBy('at'),

    async mistakeCounts(since) {
      const counts: Partial<Record<MistakeType, number>> = {}
      await db.mistakes.where('at').aboveOrEqual(since).each((m) => {
        counts[m.type] = (counts[m.type] ?? 0) + 1
      })
      return counts
    },

    async saveMistake(mistake) {
      await db.mistakes.add(mistake)
    },

    mistakesSince(since) {
      return db.mistakes.where('at').aboveOrEqual(since).toArray()
    },

    async saveBossResult(result) {
      await db.bosses.add(result)
    },

    bossResults() {
      return db.bosses.orderBy('at').reverse().toArray()
    },

    async saveTalk(result) {
      await db.talks.add(result)
    },

    talkResults() {
      return db.talks.orderBy('at').reverse().toArray()
    },

    sessions() {
      return db.sessions.toArray()
    },

    async recordActivity(date, game, minutes, score) {
      await db.transaction('rw', db.sessions, async () => {
        const row = (await db.sessions.get(date)) ?? { date, games: [], minutes: 0, rounds: [] }
        await db.sessions.put({
          date,
          games: [...row.games, game],
          minutes: Math.round((row.minutes + Math.max(0, minutes)) * 10) / 10,
          rounds: [...(row.rounds ?? []), ...(score ? [{ game, ...score }] : [])],
        })
      })
    },

    async studyDays() {
      const rows = await db.sessions.toArray()
      return rows.filter(row => row.games.length > 0).map(row => row.date)
    },

    async gamesOn(date) {
      return (await db.sessions.get(date))?.games ?? []
    },

    async exportAll(now = new Date()) {
      const [cards, reviews, mistakes, sessions, grammar, bosses, talks, attempts, writings, settings] = await Promise.all([
        db.cards.toArray(),
        db.reviews.toArray(),
        db.mistakes.toArray(),
        db.sessions.toArray(),
        db.grammar.toArray(),
        db.bosses.toArray(),
        db.talks.toArray(),
        db.attempts.toArray(),
        db.writings.toArray(),
        getSettings(),
      ])
      return { app: 'rien', version: 1, exportedAt: now, cards, reviews, mistakes, sessions, grammar, bosses, talks, attempts, writings, settings }
    },

    async importAll(raw) {
      const backup = backupSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw)
      await db.transaction('rw', [db.cards, db.reviews, db.mistakes, db.sessions, db.grammar, db.bosses, db.talks, db.attempts, db.writings, db.settings], async () => {
        await Promise.all([db.cards.clear(), db.reviews.clear(), db.mistakes.clear(), db.sessions.clear(), db.grammar.clear(), db.bosses.clear(), db.talks.clear(), db.attempts.clear(), db.writings.clear()])
        await db.cards.bulkAdd(backup.cards)
        await db.reviews.bulkAdd(backup.reviews)
        await db.mistakes.bulkAdd(backup.mistakes)
        await db.sessions.bulkAdd(backup.sessions)
        await db.grammar.bulkAdd(backup.grammar)
        await db.bosses.bulkAdd(backup.bosses)
        await db.talks.bulkAdd(backup.talks)
        await db.attempts.bulkAdd(backup.attempts)
        await db.writings.bulkAdd(backup.writings)
        await db.settings.put({ key: 'settings', ...backup.settings })
      })
      return { cards: backup.cards.length }
    },
  }
}
