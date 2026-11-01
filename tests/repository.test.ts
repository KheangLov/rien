import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MistakeRow } from '#shared/schemas/db'
import { gradeFixIt, type FixItCard } from '#shared/utils/fixit'
import { gradeAnswer } from '#shared/utils/scheduler'
import { createDexieRepository, RienDexie } from '~/data/dexie'
import { DuplicateWordError, type StudyRepository } from '~/data/repository'
import { openSqlRepository } from '~/data/sql'
import { nodeSqliteDriver } from './node-sqlite-driver'

const now = new Date('2026-11-02T08:00:00Z')
const word = {
  answer: 'borrow',
  meaning: 'to take something and give it back later',
  book: 'english-file-pre-intermediate-4e' as const,
  file: 7,
}
const item: FixItCard = { itemId: 'core:a', id: 'a', text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type: 'tense', explain: '', skill: 'past-simple', level: 'A2' }

interface Store {
  repo: StudyRepository
  // Number of stored reviews, which the repository does not expose itself.
  reviewCount(): Promise<number>
  close(): Promise<void>
}

// The same behaviour is required of IndexedDB on the web and SQLite in the native app.
const stores: Record<string, () => Promise<Store>> = {
  dexie: async () => {
    const db = new RienDexie(`test-${crypto.randomUUID()}`)
    return { repo: createDexieRepository(db), reviewCount: () => db.reviews.count(), close: () => db.delete() }
  },
  sqlite: async () => {
    const driver = nodeSqliteDriver()
    const repo = await openSqlRepository(driver)
    const reviewCount = async () => (await driver.all<{ n: number }>('SELECT COUNT(*) AS n FROM reviews'))[0]!.n
    return { repo, reviewCount, close: async () => {} }
  },
}

async function addMistake(repo: StudyRepository, mistake: MistakeRow) {
  await repo.saveGrammarAnswer(gradeFixIt(item, undefined, { wrongTaps: 0, wrongChoice: false }, mistake.at).row, mistake)
}

describe.each(Object.entries(stores))('%s repository', (_, open) => {
  let store: Store
  let repo: StudyRepository

  beforeEach(async () => {
    store = await open()
    repo = store.repo
  })

  afterEach(async () => {
    await store.close()
  })

  it('logs answers for the skill model, and keeps them in backups', async () => {
    const attempt = { itemId: 'core:a', kind: 'fix-it' as const, skill: 'tense:past', score: 1, ms: 2500, at: now }
    await repo.saveGrammarAnswer(gradeFixIt(item, undefined, { wrongTaps: 0, wrongChoice: false }, now).row, undefined, attempt)
    await repo.saveAttempts([
      { ...attempt, itemId: 'quick:pig', kind: 'picture', skill: 'vocabulary', score: 0, at: new Date(now.getTime() + 1000) },
      { ...attempt, itemId: 'old', at: new Date('2026-01-01T00:00:00Z') },
    ])
    const since = await repo.attemptsSince(new Date(now.getTime() - 60_000))
    expect(since.map(a => a.itemId)).toEqual(['core:a', 'quick:pig'])
    expect(since[0]).toMatchObject({ skill: 'tense:past', score: 1, ms: 2500 })

    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    expect((await repo.reviewsSince(new Date(now.getTime() - 60_000))).map(r => r.cardId)).toEqual([card.id])

    const json = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    expect(json.attempts).toHaveLength(3)
    const other = await open()
    await other.repo.importAll(json)
    expect(await other.repo.attemptsSince(new Date(0))).toHaveLength(3)
    await other.close()
  })

  it('restores from the backup file\'s text as well as its parsed JSON', async () => {
    await repo.addWord(word, now)
    const text = JSON.stringify(await repo.exportAll(now))
    const other = await open()
    expect(await other.repo.importAll(text)).toEqual({ cards: 1 })
    await expect(other.repo.importAll('not json')).rejects.toThrow()
    expect(await other.repo.countCards()).toBe(1)
    await other.close()
  })

  it('restores a large backup (more rows than one SQL statement holds)', async () => {
    const card = await repo.addWord(word, now)
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    backup.reviews = Array.from({ length: 1234 }, (_, i) => ({ cardId: card.id, at: new Date(now.getTime() - i * 60_000), rating: 3, correct: true, typed: 'borrow', ms: 1000 }))
    backup.attempts = Array.from({ length: 777 }, (_, i) => ({ itemId: `x${i}`, kind: 'listen', skill: 'listening', score: i % 2, ms: 0, at: now }))
    await repo.importAll(backup)
    expect(await store.reviewCount()).toBe(1234)
    expect(await repo.attemptsSince(new Date(0))).toHaveLength(777)
  })

  it('starts with default settings and saves changes', async () => {
    expect(await repo.getSettings()).toMatchObject({ file: 9, khmerHints: true })
    await repo.saveSettings({ file: 12 })
    expect((await repo.getSettings()).file).toBe(12)
  })

  it('adds a word that is due immediately', async () => {
    const card = await repo.addWord(word, now)
    expect(card).toMatchObject({ answer: 'borrow', answerKey: 'borrow', type: 'word', khmer: '' })
    expect(await repo.countDue(now)).toBe(1)
    expect(await repo.dueCards(now, 10)).toHaveLength(1)
  })

  it('refuses a duplicate word, ignoring case', async () => {
    await repo.addWord(word, now)
    await expect(repo.addWord({ ...word, answer: ' Borrow ' }, now)).rejects.toBeInstanceOf(DuplicateWordError)
  })

  it('needs at least one cue', async () => {
    await expect(repo.addWord({ ...word, meaning: '' }, now)).rejects.toThrow(/meaning, a Khmer hint or an example/)
  })

  it('stores answers and reschedules the card', async () => {
    const card = await repo.addWord(word, now)
    const graded = gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now)
    await repo.saveAnswer(graded)
    await repo.saveAnswer(gradeAnswer(graded.card, { result: 'wrong', mistake: 'final-sound' }, 'borro', 2000, now))
    expect(await store.reviewCount()).toBe(2)
    expect(await repo.mistakeCounts(new Date(0))).toEqual({ 'final-sound': 1 })
    expect((await repo.recentCards(1))[0]!.fsrs.reps).toBe(2)
  })

  it('counts words first reviewed since a moment, for the new-word cap', async () => {
    const a = await repo.addWord(word, now)
    await repo.addWord({ ...word, answer: 'lend' }, now)
    expect(await repo.countIntroducedSince(new Date(0))).toBe(0)
    const first = gradeAnswer(a, { result: 'correct' }, 'borrow', 2000, now)
    expect(first.card.introducedAt).toEqual(now)
    await repo.saveAnswer(first)
    const later = new Date('2026-11-05T08:00:00Z')
    const second = gradeAnswer(first.card, { result: 'correct' }, 'borrow', 2000, later)
    expect(second.card.introducedAt).toEqual(now)
    await repo.saveAnswer(second)
    expect(await repo.countIntroducedSince(new Date('2026-11-02T00:00:00Z'))).toBe(1)
    expect(await repo.countIntroducedSince(new Date('2026-11-03T00:00:00Z'))).toBe(0)
    expect((await repo.allCards()).map(c => c.answer).sort()).toEqual(['borrow', 'lend'])
  })

  it('keeps a picture with a word, and can change or remove it', async () => {
    const pic = 'data:image/jpeg;base64,/9j/AAAA'
    const card = await repo.addWord({ ...word, image: pic }, now)
    expect((await repo.recentCards(1))[0]!.image).toBe(pic)
    await repo.setCardImage(card.id, undefined)
    expect((await repo.recentCards(1))[0]!.image).toBeUndefined()
    await repo.setCardImage(card.id, pic)
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    expect(backup.cards[0].image).toBe(pic)
  })

  it('lists due cards oldest first', async () => {
    await repo.addWord(word, new Date('2026-11-02T09:00:00Z'))
    await repo.addWord({ ...word, answer: 'lend' }, new Date('2026-11-02T07:00:00Z'))
    const due = await repo.dueCards(new Date('2026-11-03T00:00:00Z'), 10)
    expect(due.map(c => c.answer)).toEqual(['lend', 'borrow'])
  })

  it('round-trips a JSON backup', async () => {
    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    const json = JSON.parse(JSON.stringify(await repo.exportAll(now)))

    const other = await open()
    expect(await other.repo.importAll(json)).toEqual({ cards: 1 })
    const [back] = await other.repo.recentCards(1)
    expect(back!.due).toBeInstanceOf(Date)
    expect(back!.due.toISOString()).toBe(json.cards[0].due)
    expect(back!.fsrs.reps).toBe(1)
    expect(await other.reviewCount()).toBe(1)
    await other.close()
  })

  it('rejects a file that is not a Rien backup, and changes nothing', async () => {
    await repo.addWord(word, now)
    await expect(repo.importAll({ hello: 'world' })).rejects.toThrow()
    expect(await repo.countCards()).toBe(1)
  })

  it('deletes a card with its history', async () => {
    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    await repo.deleteCard(card.id)
    expect(await repo.countCards()).toBe(0)
    expect(await store.reviewCount()).toBe(0)
  })

  it('stores Fix It progress and counts mistakes by type', async () => {
    const first = gradeFixIt(item, undefined, { wrongTaps: 1, wrongChoice: false }, now)
    await repo.saveGrammarAnswer(first.row, first.mistake)
    const [row] = await repo.grammarStates()
    expect(row!.itemId).toBe('core:a')
    expect(row!.due).toBeInstanceOf(Date)
    expect(await repo.mistakeCounts(new Date('2026-11-01T00:00:00Z'))).toEqual({ tense: 1 })
    expect(await repo.mistakeCounts(new Date('2026-11-03T00:00:00Z'))).toEqual({})
  })

  it('adds activities to one session row per day', async () => {
    await repo.recordActivity('2026-11-02', 'word-recall', 4.26, { clean: 3, total: 4 })
    await repo.recordActivity('2026-11-02', 'fix-it', 3)
    await repo.recordActivity('2026-11-03', 'fix-it', 2)
    expect(await repo.gamesOn('2026-11-02')).toEqual(['word-recall', 'fix-it'])
    const day = (await repo.sessions()).find(s => s.date === '2026-11-02')!
    expect(day.minutes).toBe(7.3)
    expect(day.rounds).toEqual([{ game: 'word-recall', clean: 3, total: 4 }])
    expect((await repo.studyDays()).sort()).toEqual(['2026-11-02', '2026-11-03'])
  })

  it('restores a week-1 backup that has no grammar, boss or talk rows', async () => {
    const card = await repo.addWord(word, now)
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    delete backup.grammar
    delete backup.bosses
    delete backup.talks
    await repo.importAll(backup)
    expect((await repo.recentCards(1))[0]!.id).toBe(card.id)
    expect(await repo.grammarStates()).toEqual([])
  })

  it('finds words by File, counts learned words and keeps File Boss results', async () => {
    await repo.addWord(word, now)
    await repo.addWord({ ...word, answer: 'lend', file: 8 }, now)
    expect((await repo.cardsInFile('english-file-pre-intermediate-4e', 7)).map(c => c.answer)).toEqual(['borrow'])
    expect(await repo.countLearned()).toBe(0)

    await repo.saveBossResult({ book: 'english-file-pre-intermediate-4e', file: 7, at: now, score: 12, total: 15 })
    await repo.saveBossResult({ book: 'english-file-pre-intermediate-4e', file: 8, at: new Date('2026-11-09T08:00:00Z'), score: 14, total: 15 })
    const results = await repo.bossResults()
    expect(results.map(b => b.file)).toEqual([8, 7])
    expect(results[0]!.id).toBeTypeOf('number')
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    expect(backup.bosses).toHaveLength(2)
  })

  it('saves a mistake on its own', async () => {
    await repo.saveMistake({ type: 'final-sound', itemId: 'say:1', at: now, detail: 'he want' })
    expect(await repo.mistakeCounts(new Date(0))).toEqual({ 'final-sound': 1 })
    expect(await repo.grammarStates()).toEqual([])
  })

  it('lists mistakes since a date', async () => {
    await addMistake(repo, { type: 'article', itemId: 'a', at: new Date('2026-10-01T00:00:00Z'), detail: '' })
    await addMistake(repo, { type: 'tense', itemId: 'b', at: now, detail: '' })
    expect((await repo.mistakesSince(new Date('2026-11-01T00:00:00Z'))).map(m => m.itemId)).toEqual(['b'])
  })

  it('keeps Couple Talk evenings, newest first, and backs them up', async () => {
    await repo.saveTalk({ talkId: 'couple-talk:us', at: now, minutes: 10 })
    await repo.saveTalk({ talkId: 'couple-talk:food', at: new Date('2026-11-05T12:00:00Z'), minutes: 12 })
    expect((await repo.talkResults()).map(t => t.talkId)).toEqual(['couple-talk:food', 'couple-talk:us'])
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    await repo.importAll(backup)
    expect(await repo.talkResults()).toHaveLength(2)
  })
})

describe('moving from the web app to the native app', () => {
  it('restores a backup made on the web into native SQLite unchanged', async () => {
    const web = await stores.dexie!()
    const card = await web.repo.addWord(word, now)
    await web.repo.saveAnswer(gradeAnswer(card, { result: 'wrong', mistake: 'final-sound' }, 'borro', 3000, now))
    await web.repo.saveGrammarAnswer(gradeFixIt(item, undefined, { wrongTaps: 0, wrongChoice: true }, now).row)
    await web.repo.recordActivity('2026-11-02', 'word-recall', 5)
    await web.repo.saveBossResult({ book: 'english-file-pre-intermediate-4e', file: 7, at: now, score: 11, total: 15 })
    await web.repo.saveTalk({ talkId: 'couple-talk:us', at: now, minutes: 10 })
    await web.repo.saveSettings({ file: 9, weeklyGoal: 4 })
    const exported = JSON.parse(JSON.stringify(await web.repo.exportAll(now)))

    const native = await stores.sqlite!()
    await native.repo.importAll(exported)
    const again = JSON.parse(JSON.stringify(await native.repo.exportAll(now)))
    const byId = <T extends { id?: number }>(rows: T[]) => [...rows].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    expect({ ...again, reviews: byId(again.reviews), mistakes: byId(again.mistakes) })
      .toEqual({ ...exported, reviews: byId(exported.reviews), mistakes: byId(exported.mistakes) })
    await web.close()
  })
})

describe('Dexie upgrades', () => {
  it('upgrades a week-1 database without losing words', async () => {
    const name = `test-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores({
      cards: 'id, due, type, answerKey, createdAt, [book+file]',
      reviews: '++id, cardId, at',
      mistakes: '++id, type, itemId, at',
      sessions: 'date',
      settings: 'key',
    })
    const scratch = new RienDexie(`test-${crypto.randomUUID()}`)
    const card = await createDexieRepository(scratch).addWord(word, now)
    await scratch.delete()
    await old.table('cards').add(card)
    old.close()

    const upgraded = new RienDexie(name)
    const upgradedRepo = createDexieRepository(upgraded)
    expect(await upgradedRepo.countCards()).toBe(1)
    expect(await upgradedRepo.grammarStates()).toEqual([])
    await upgraded.delete()
  })
})
