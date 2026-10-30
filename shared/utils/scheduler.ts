import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { CardRow, MistakeRow, ReviewRow } from '../schemas/db'
import type { Verdict } from './answer'

// The plan says not to hand-tune intervals, so this uses ts-fsrs defaults (FSRS-6).
// Everything that touches ts-fsrs goes through this file.
const scheduler = fsrs()

export { Rating }
export type { Grade }

export function newFsrsState(now: Date): Card {
  return createEmptyCard(now)
}

export function nextFsrsState(state: Card, grade: Grade, now: Date): Card {
  return scheduler.next(state, now, grade).card
}

export function gradeFor(verdict: Verdict): Grade {
  if (verdict.result === 'correct') return Rating.Good
  if (verdict.result === 'almost') return Rating.Hard
  return Rating.Again
}

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
): GradedAnswer {
  const rating = gradeFor(verdict)
  const fsrsState = nextFsrsState(card.fsrs as Card, rating, now)
  return {
    card: { ...card, fsrs: fsrsState, due: fsrsState.due },
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
