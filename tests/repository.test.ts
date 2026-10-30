import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
