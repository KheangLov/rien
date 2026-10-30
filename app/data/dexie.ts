import Dexie, { type EntityTable } from 'dexie'
import {
  backupSchema,
  cardSchema,
  newWordSchema,
  settingsSchema,
  type CardRow,
  type MistakeRow,
  type ReviewRow,
  type SessionRow,
  type Settings,
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

  constructor(name = 'rien') {
    super(name)
    this.version(1).stores({
      cards: 'id, due, type, answerKey, createdAt, [book+file]',
      reviews: '++id, cardId, at',
      mistakes: '++id, type, itemId, at',
      sessions: 'date',
      settings: 'key',
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

    async saveAnswer({ card, review, mistake }) {
      await db.transaction('rw', db.cards, db.reviews, db.mistakes, async () => {
        await db.cards.put(card)
        await db.reviews.add(review)
        if (mistake) await db.mistakes.add(mistake)
      })
    },

    async exportAll(now = new Date()) {
      const [cards, reviews, mistakes, sessions, settings] = await Promise.all([
        db.cards.toArray(),
        db.reviews.toArray(),
        db.mistakes.toArray(),
        db.sessions.toArray(),
        getSettings(),
      ])
      return { app: 'rien', version: 1, exportedAt: now, cards, reviews, mistakes, sessions, settings }
    },

    async importAll(raw) {
      const backup = backupSchema.parse(raw)
      await db.transaction('rw', [db.cards, db.reviews, db.mistakes, db.sessions, db.settings], async () => {
        await Promise.all([db.cards.clear(), db.reviews.clear(), db.mistakes.clear(), db.sessions.clear()])
        await db.cards.bulkAdd(backup.cards)
        await db.reviews.bulkAdd(backup.reviews)
        await db.mistakes.bulkAdd(backup.mistakes)
        await db.sessions.bulkAdd(backup.sessions)
        await db.settings.put({ key: 'settings', ...backup.settings })
      })
      return { cards: backup.cards.length }
    },
  }
}
