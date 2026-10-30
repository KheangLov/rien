import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gradeFixIt, type FixItCard } from '#shared/utils/fixit'
import { gradeAnswer } from '#shared/utils/scheduler'
import { createDexieRepository, RienDexie } from '~/data/dexie'
import { DuplicateWordError, type StudyRepository } from '~/data/repository'

const now = new Date('2026-11-02T08:00:00Z')
const word = {
  answer: 'borrow',
  meaning: 'to take something and give it back later',
  book: 'english-file-pre-intermediate-4e' as const,
  file: 7,
}

let db: RienDexie
let repo: StudyRepository

beforeEach(() => {
  db = new RienDexie(`test-${crypto.randomUUID()}`)
  repo = createDexieRepository(db)
})

afterEach(async () => {
  await db.delete()
})

describe('Dexie repository', () => {
  it('starts with default settings and saves changes', async () => {
    expect(await repo.getSettings()).toMatchObject({ file: 7, khmerHints: true })
    await repo.saveSettings({ file: 8 })
    expect((await repo.getSettings()).file).toBe(8)
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

  it('stores an answer and takes the card out of today\'s queue', async () => {
    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    await repo.saveAnswer(gradeAnswer(card, { result: 'wrong', mistake: 'final-sound' }, 'borro', 2000, now))
    expect(await db.reviews.count()).toBe(2)
    expect(await db.mistakes.where('type').equals('final-sound').count()).toBe(1)
  })

  it('round-trips a JSON backup', async () => {
    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    const json = JSON.parse(JSON.stringify(await repo.exportAll(now)))

    const other = new RienDexie(`test-${crypto.randomUUID()}`)
    const restored = createDexieRepository(other)
    expect(await restored.importAll(json)).toEqual({ cards: 1 })
    const [back] = await restored.recentCards(1)
    expect(back!.due).toBeInstanceOf(Date)
    expect(back!.due.toISOString()).toBe(json.cards[0].due)
    expect(back!.fsrs.reps).toBe(1)
    expect(await other.reviews.count()).toBe(1)
    await other.delete()
  })

  it('rejects a file that is not a Rien backup', async () => {
    await expect(repo.importAll({ hello: 'world' })).rejects.toThrow()
  })

  it('deletes a card with its history', async () => {
    const card = await repo.addWord(word, now)
    await repo.saveAnswer(gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now))
    await repo.deleteCard(card.id)
    expect(await repo.countCards()).toBe(0)
    expect(await db.reviews.count()).toBe(0)
  })

  it('stores Fix It progress and counts mistakes by type', async () => {
    const item: FixItCard = { itemId: 'core:a', id: 'a', text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type: 'tense', explain: '' }
    const first = gradeFixIt(item, undefined, { wrongTaps: 1, wrongChoice: false }, now)
    await repo.saveGrammarAnswer(first.row, first.mistake)
    const [row] = await repo.grammarStates()
    expect(row!.itemId).toBe('core:a')
    expect(await repo.mistakeCounts(new Date('2026-11-01T00:00:00Z'))).toEqual({ tense: 1 })
    expect(await repo.mistakeCounts(new Date('2026-11-03T00:00:00Z'))).toEqual({})
  })

  it('adds activities to one session row per day', async () => {
    await repo.recordActivity('2026-11-02', 'word-recall', 4.26)
    await repo.recordActivity('2026-11-02', 'fix-it', 3)
    await repo.recordActivity('2026-11-03', 'fix-it', 2)
    expect(await repo.gamesOn('2026-11-02')).toEqual(['word-recall', 'fix-it'])
    expect((await db.sessions.get('2026-11-02'))!.minutes).toBe(7.3)
    expect((await repo.studyDays()).sort()).toEqual(['2026-11-02', '2026-11-03'])
  })

  it('restores a week-1 backup that has no grammar rows', async () => {
    const card = await repo.addWord(word, now)
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    delete backup.grammar
    await repo.importAll(backup)
    expect((await repo.recentCards(1))[0]!.id).toBe(card.id)
    expect(await repo.grammarStates()).toEqual([])
  })

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
    const card = await repo.addWord(word, now)
    await old.table('cards').add(card)
    old.close()

    const upgraded = new RienDexie(name)
    const upgradedRepo = createDexieRepository(upgraded)
    expect(await upgradedRepo.countCards()).toBe(1)
    expect(await upgradedRepo.grammarStates()).toEqual([])
    await upgraded.delete()
  })

  it('finds words by File, counts learned words and keeps File Boss results', async () => {
    await repo.addWord(word, now)
    await repo.addWord({ ...word, answer: 'lend', file: 8 }, now)
    expect((await repo.cardsInFile('english-file-pre-intermediate-4e', 7)).map(c => c.answer)).toEqual(['borrow'])
    expect(await repo.countLearned()).toBe(0)

    await repo.saveBossResult({ book: 'english-file-pre-intermediate-4e', file: 7, at: now, score: 12, total: 15 })
    await repo.saveBossResult({ book: 'english-file-pre-intermediate-4e', file: 8, at: new Date('2026-11-09T08:00:00Z'), score: 14, total: 15 })
    expect((await repo.bossResults()).map(b => b.file)).toEqual([8, 7])
    const backup = JSON.parse(JSON.stringify(await repo.exportAll(now)))
    expect(backup.bosses).toHaveLength(2)
  })

  it('lists mistakes since a date', async () => {
    await db.mistakes.bulkAdd([
      { type: 'article', itemId: 'a', at: new Date('2026-10-01T00:00:00Z'), detail: '' },
      { type: 'tense', itemId: 'b', at: now, detail: '' },
    ])
    expect((await repo.mistakesSince(new Date('2026-11-01T00:00:00Z'))).map(m => m.itemId)).toEqual(['b'])
  })
})
