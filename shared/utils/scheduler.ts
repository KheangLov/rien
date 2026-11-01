import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { CardRow, MistakeRow, ReviewRow } from '../schemas/db'
import type { Verdict } from './answer'

// The plan says not to hand-tune intervals: this uses ts-fsrs's defaults
// (FSRS-6) until her own reviews have been fitted (shared/utils/fsrsFit.ts),
// then those parameters. Everything that touches ts-fsrs goes through this file.
let scheduler = fsrs()

export function applyFsrsParams(params: readonly number[] | undefined): void {
  scheduler = params?.length === 21 ? fsrs({ w: [...params] }) : fsrs()
}

export { Rating }
export type { Grade }

export function newFsrsState(now: Date): Card {
  return createEmptyCard(now)
}

export function nextFsrsState(state: Card, grade: Grade, now: Date): Card {
  return scheduler.next(state, now, grade).card
}

// An answer this much faster than her usual pace counts as Easy: she knew it
// well, so it can wait longer. A slow right answer stays Good; thinking time is
// not a slip.
export const EASY_SHARE = 0.5

export function gradeFor(verdict: Verdict, ms?: number, expectedMs?: number): Grade {
  if (verdict.result === 'correct') {
    return ms !== undefined && expectedMs !== undefined && ms < expectedMs * EASY_SHARE ? Rating.Easy : Rating.Good
  }
  if (verdict.result === 'almost') return Rating.Hard
  return Rating.Again
}

// Her usual time for a typed word, per letter: the median over her recent right
// answers, or a beginner's pace until there are enough of them.
export const DEFAULT_MS_PER_LETTER = 900
export function msPerLetter(reviews: readonly { correct: boolean, typed: string, ms: number, rating: number }[]): number {
  const rates = reviews
    .filter(r => r.correct && r.rating >= Rating.Good && r.ms > 0)
    .map(r => r.ms / (r.typed.trim().length + 4))
    .sort((a, b) => a - b)
  return rates.length >= 10 ? rates[Math.floor(rates.length / 2)]! : DEFAULT_MS_PER_LETTER
}
export const expectedWordMs = (answer: string, perLetter: number) => perLetter * (answer.trim().length + 4)

export interface GradedAnswer {
  card: CardRow
  review: ReviewRow
  mistake?: MistakeRow
}

// Turns one answer into the rows to store: the rescheduled card, a review log
// entry and, when the slip has a known type, a tagged mistake.
export function gradeAnswer(
  card: CardRow,
  verdict: Verdict,
  typed: string,
  ms: number,
  now: Date,
  expectedMs?: number,
): GradedAnswer {
  const rating = gradeFor(verdict, ms, expectedMs)
  const fsrsState = nextFsrsState(card.fsrs as Card, rating, now)
  return {
    card: { ...card, fsrs: fsrsState, due: fsrsState.due, introducedAt: card.introducedAt ?? now },
    review: {
      cardId: card.id,
      at: now,
      rating,
      correct: verdict.result !== 'wrong',
      typed: typed.slice(0, 200),
      ms: Math.max(0, Math.round(ms)),
    },
    mistake: verdict.mistake
      ? { type: verdict.mistake, itemId: card.id, at: now, detail: typed.slice(0, 200) }
      : undefined,
  }
}
