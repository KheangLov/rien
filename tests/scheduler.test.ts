import { describe, expect, it } from 'vitest'
import type { CardRow } from '#shared/schemas/db'
import { gradeAnswer, newFsrsState, Rating } from '#shared/utils/scheduler'

const start = new Date('2026-11-02T08:00:00Z')

function newCard(): CardRow {
  const fsrs = newFsrsState(start)
  return {
    id: 'card-1',
    type: 'word',
    book: 'english-file-pre-intermediate-4e',
    file: 7,
    answer: 'borrow',
    answerKey: 'borrow',
    meaning: 'to take something and give it back later',
    khmer: '',
    example: '',
    fsrs,
    due: fsrs.due,
    createdAt: start,
  }
}

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000

describe('gradeAnswer', () => {
  it('makes a new card due straight away', () => {
    expect(newCard().due.getTime()).toBe(start.getTime())
  })

  it('brings a wrong answer back within the same session', () => {
    const { card, review, mistake } = gradeAnswer(newCard(), { result: 'wrong' }, 'lend', 4000, start)
    expect(review.rating).toBe(Rating.Again)
    expect(review.correct).toBe(false)
    expect(minutes(start, card.due)).toBeLessThanOrEqual(10)
    expect(mistake).toBeUndefined()
  })

  it('tags a dropped ending as a final-sound mistake', () => {
    const { mistake } = gradeAnswer(
      newCard(),
      { result: 'wrong', mistake: 'final-sound' },
      'borrow',
      3000,
      start,
    )
    expect(mistake).toMatchObject({ type: 'final-sound', itemId: 'card-1' })
  })

  it('spreads correct answers over growing gaps', () => {
    let card = newCard()
    let now = start
    const gaps: number[] = []
    for (let i = 0; i < 5; i++) {
      card = gradeAnswer(card, { result: 'correct' }, 'borrow', 2000, now).card
      gaps.push(minutes(now, card.due))
      now = card.due
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]!)
    expect(gaps.at(-1)!).toBeGreaterThan(60 * 24 * 7)
    expect(card.due).toEqual(card.fsrs.due)
  })

  it('keeps an almost-right answer as a pass, rated Hard', () => {
    const { review } = gradeAnswer(newCard(), { result: 'almost' }, 'borow', 2000, start)
    expect(review.rating).toBe(Rating.Hard)
    expect(review.correct).toBe(true)
  })
})
