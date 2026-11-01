import { default_w, forgetting_curve, INIT_S_MAX, S_MIN } from 'ts-fsrs'
import type { ReviewRow } from '../schemas/db'

// Fits FSRS to her own memory. FSRS's first four parameters are how many days
// a new word stays remembered after its first answer (Again, Hard, Good, Easy):
// the numbers that matter most while a learner has few reviews. This does what
// FSRS's own optimizer does first ("pre-training"): for each first rating,
// find the stability whose forgetting curve best explains whether she still
// knew the word at its next review on a later day. Each fitted value is pulled
// towards FSRS's default in proportion to how little data backs it, so a few
// answers cannot throw the schedule off. The other parameters stay at FSRS's
// defaults, which are trained on millions of learners.

export interface FittedStability {
  rating: 1 | 2 | 3 | 4
  // Days until she is 90% likely to still know the word.
  stability: number
  // Word pairs (first answer, next day's answer) it is based on.
  pairs: number
}

export interface FsrsFit {
  params: number[]
  stabilities: FittedStability[]
  pairs: number
}

// Below this many pairs in total, the defaults are kept.
export const MIN_PAIRS = 30
// How strongly the default holds. Recall is around 90% at most gaps, so each
// pair says little; a stronger pull kept a learner whose memory lasts 10 days
// near the default of 2 in testing.
const PRIOR_WEIGHT = 1

const dayKey = (at: Date, offsetMinutes: number) => Math.floor((at.getTime() - offsetMinutes * 60_000) / 86_400_000)

// For each word: the first rating on its first day, and whether she knew it at
// the first review on a later day, and how many days later that was.
export function firstReviewPairs(reviews: readonly ReviewRow[], offsetMinutes = new Date().getTimezoneOffset()) {
  const byCard = new Map<string, ReviewRow[]>()
  for (const review of reviews) {
    const list = byCard.get(review.cardId)
    if (list) list.push(review)
    else byCard.set(review.cardId, [review])
  }
  const pairs: { rating: 1 | 2 | 3 | 4, days: number, recalled: boolean }[] = []
  for (const list of byCard.values()) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime())
    const first = list[0]!
    const firstDay = dayKey(first.at, offsetMinutes)
    const next = list.find(r => dayKey(r.at, offsetMinutes) > firstDay)
    if (!next) continue
    pairs.push({ rating: first.rating as 1 | 2 | 3 | 4, days: dayKey(next.at, offsetMinutes) - firstDay, recalled: next.rating > 1 })
  }
  return pairs
}

// Golden-section search for the minimum of a one-dimensional function.
function minimise(f: (x: number) => number, lo: number, hi: number, steps = 60): number {
  const g = (Math.sqrt(5) - 1) / 2
  let a = lo
  let b = hi
  for (let i = 0; i < steps; i++) {
    const c = b - g * (b - a)
    const d = a + g * (b - a)
    if (f(c) < f(d)) b = d
    else a = c
  }
  return (a + b) / 2
}

export function fitFsrs(reviews: readonly ReviewRow[], offsetMinutes?: number): FsrsFit | null {
  const pairs = firstReviewPairs(reviews, offsetMinutes)
  if (pairs.length < MIN_PAIRS) return null
  const params = [...default_w]
  const stabilities: FittedStability[] = []
  for (const rating of [1, 2, 3, 4] as const) {
    const mine = pairs.filter(p => p.rating === rating)
    const prior = default_w[rating - 1]!
    let stability = prior
    if (mine.length > 0) {
      // Negative log-likelihood of her answers, plus the pull to the default.
      const loss = (logS: number) => {
        const s = Math.exp(logS)
        let total = PRIOR_WEIGHT * (logS - Math.log(prior)) ** 2
        for (const p of mine) {
          const r = Math.min(1 - 1e-6, Math.max(1e-6, forgetting_curve(params, p.days, s)))
          total -= p.recalled ? Math.log(r) : Math.log(1 - r)
        }
        return total
      }
      stability = Math.exp(minimise(loss, Math.log(S_MIN * 100), Math.log(INIT_S_MAX)))
    }
    stabilities.push({ rating, stability, pairs: mine.length })
  }
  // A better first answer never means a shorter memory.
  for (let i = 1; i < 4; i++) stabilities[i]!.stability = Math.max(stabilities[i]!.stability, stabilities[i - 1]!.stability)
  stabilities.forEach((s, i) => { params[i] = Math.round(s.stability * 10_000) / 10_000 })
  return { params, stabilities, pairs: pairs.length }
}
