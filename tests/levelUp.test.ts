import { describe, expect, it } from 'vitest'
import { emptyModel, learn } from '#shared/utils/mastery'
import { FILES_IN_BOOK, nextPlace, suggestLevel } from '#shared/utils/levelUp'

const now = new Date('2026-11-02T08:00:00Z')
const pre = 'english-file-pre-intermediate-4e' as const
const items = Array.from({ length: 10 }, (_, i) => ({ itemId: `f10:${i}`, skill: i % 2 ? 'passive' : 'prepositions', level: 'B1' as const }))

function modelWith(rightShare: number, answers: number) {
  const model = emptyModel('B1')
  for (let k = 0; k < answers; k++) {
    learn(model, { ...items[k % items.length]!, score: (k % 10) < rightShare * 10 ? 1 : 0, at: new Date(now.getTime() - (answers - k) * 3_600_000), kind: 'fix-it' })
  }
  return model
}

describe('moving up a File or book', () => {
  it('goes to the next File, then the next book', () => {
    expect(nextPlace({ book: pre, file: 10 })).toEqual({ book: pre, file: 11 })
    expect(nextPlace({ book: pre, file: 12 })).toEqual({ book: 'english-file-intermediate-4e', file: 1 })
    expect(nextPlace({ book: 'english-file-upper-intermediate-4e', file: FILES_IN_BOOK['english-file-upper-intermediate-4e'] })).toBeNull()
  })

  const base = { place: { book: pre, file: 10 }, items, now }

  it('suggests moving up when she knows the File and passed its File Boss', () => {
    const s = suggestLevel({ ...base, model: modelWith(1, 40), bosses: [{ score: 13, total: 15 }] })
    expect(s).toMatchObject({ to: { book: pre, file: 11 }, newBook: false })
    expect(s!.mastery).toBeGreaterThan(0.75)
  })

  it('waits for a File Boss pass, enough answers and enough mastery', () => {
    expect(suggestLevel({ ...base, model: modelWith(1, 40), bosses: [] })).toBeNull()
    expect(suggestLevel({ ...base, model: modelWith(1, 40), bosses: [{ score: 10, total: 15 }] })).toBeNull()
    expect(suggestLevel({ ...base, model: modelWith(1, 8), bosses: [{ score: 14, total: 15 }] })).toBeNull()
    expect(suggestLevel({ ...base, model: modelWith(0.3, 60), bosses: [{ score: 14, total: 15 }] })).toBeNull()
  })

  it('suggests the next book at the end of one, and stays quiet after "Not yet"', () => {
    const s = suggestLevel({ ...base, place: { book: pre, file: 12 }, model: modelWith(1, 40), bosses: [{ score: 15, total: 15 }] })
    expect(s).toMatchObject({ to: { book: 'english-file-intermediate-4e', file: 1 }, newBook: true })
    const later = new Date(now.getTime() + 86_400_000)
    expect(suggestLevel({ ...base, model: modelWith(1, 40), bosses: [{ score: 15, total: 15 }], snoozedUntil: later })).toBeNull()
  })
})
