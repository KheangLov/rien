import { describe, expect, it } from 'vitest'
import type { CardRow } from '#shared/schemas/db'
import { hintFor, isTricky, limitNew, maxHintLevel, nextReviewLabel, planSession } from '#shared/utils/learning'

describe('planSession', () => {
  it('puts due words first, then her weakest areas, four activities in all', () => {
    const plan = planSession({ dueWords: 5, mistakeCounts: { 'listening': 4, 'final-sound': 6, 'tense': 1 }, native: false, dayIndex: 0 })
    expect(plan).toEqual(['word-recall', 'sound-hunter', 'gap-radio', 'fix-it'])
  })

  it('fills with a rotating mix when there are no slips or due words', () => {
    const a = planSession({ dueWords: 0, mistakeCounts: {}, native: false, dayIndex: 0 })
    const b = planSession({ dueWords: 0, mistakeCounts: {}, native: false, dayIndex: 1 })
    expect(a).toHaveLength(4)
    expect(new Set(a).size).toBe(4)
    expect(a).not.toEqual(b)
  })

  it('only offers Say It in the native app', () => {
    const plans = [0, 1, 2, 3, 4].flatMap(d => planSession({ dueWords: 0, mistakeCounts: {}, native: false, dayIndex: d }))
    expect(plans).not.toContain('say-it')
    const native = [0, 1, 2, 3, 4].flatMap(d => planSession({ dueWords: 0, mistakeCounts: {}, native: true, dayIndex: d }))
    expect(native).toContain('say-it')
  })
})

describe('hints', () => {
  it('reveals letters one at a time and keeps spaces', () => {
    expect(hintFor('look after', 0)).toBe('____ _____')
    expect(hintFor('look after', 2)).toBe('lo__ _____')
    expect(hintFor('look after', 5)).toBe('look a____')
  })

  it('never reveals more than half the letters', () => {
    expect(maxHintLevel('borrow')).toBe(3)
    expect(maxHintLevel('go')).toBe(1)
  })
})

const card = (id: string, reps: number, lapses = 0) =>
  ({ id, fsrs: { reps, lapses } }) as unknown as CardRow

describe('limitNew', () => {
  it('keeps every review and only as many new words as allowed', () => {
    const due = [card('r1', 2), card('n1', 0), card('n2', 0), card('r2', 5), card('n3', 0)]
    expect(limitNew(due, 1, 10).map(c => c.id)).toEqual(['r1', 'n1', 'r2'])
    expect(limitNew(due, 0, 10).map(c => c.id)).toEqual(['r1', 'r2'])
    expect(limitNew(due, 9, 2).map(c => c.id)).toEqual(['r1', 'n1'])
  })
})

describe('words list', () => {
  it('flags words forgotten three or more times', () => {
    expect(isTricky(card('a', 6, 3))).toBe(true)
    expect(isTricky(card('b', 6, 2))).toBe(false)
  })

  it('describes the next review in plain words', () => {
    const now = new Date(2026, 10, 2, 9, 0)
    expect(nextReviewLabel(new Date(2026, 10, 2, 8, 0), now)).toBe('Due now')
    expect(nextReviewLabel(new Date(2026, 10, 2, 20, 0), now)).toBe('Later today')
    expect(nextReviewLabel(new Date(2026, 10, 3, 9, 0), now)).toBe('Tomorrow')
    expect(nextReviewLabel(new Date(2026, 10, 7, 9, 0), now)).toBe('In 5 days')
    expect(nextReviewLabel(new Date(2026, 11, 2, 9, 0), now)).toBe('In 4 weeks')
  })
})
