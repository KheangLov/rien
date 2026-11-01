import type { CardRow, MistakeType } from '../schemas/db'

// --- Daily session -----------------------------------------------------------

export type ActivityId =
  | 'word-recall' | 'fix-it' | 'sound-hunter' | 'sentence-builder' | 'gap-radio' | 'say-it'
  | 'speed-round' | 'listen-pick' | 'picture-match'

// Which activity trains each kind of slip best.
const PRACTICE_FOR: Partial<Record<MistakeType, ActivityId>> = {
  'tense': 'fix-it',
  'third-person-s': 'fix-it',
  'plural-s': 'fix-it',
  'possessive-s': 'fix-it',
  'article': 'fix-it',
  'preposition': 'fix-it',
  'final-sound': 'sound-hunter',
  'sound': 'sound-hunter',
  'word-order': 'sentence-builder',
  'listening': 'gap-radio',
}

export const SESSION_LENGTH = 4

// The plan's daily session: about four activities in 10 to 15 minutes. Words
// that are due always come first (spacing only works if reviews happen on
// time), then the activities that train her most frequent slips, then the
// rest, so she still meets every kind of practice across the week.
export function planSession(input: {
  dueWords: number
  mistakeCounts: Partial<Record<MistakeType, number>>
  native: boolean
  // Rotates the filler activities from day to day.
  dayIndex: number
}): ActivityId[] {
  const plan: ActivityId[] = []
  if (input.dueWords > 0) plan.push('word-recall')

  const weak = (Object.entries(input.mistakeCounts) as [MistakeType, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => PRACTICE_FOR[type])
    .filter((id): id is ActivityId => Boolean(id))
  for (const id of weak) if (!plan.includes(id)) plan.push(id)

  const fillers: ActivityId[] = ['fix-it', 'sound-hunter', 'sentence-builder', 'gap-radio', 'speed-round', 'listen-pick', 'picture-match']
  if (input.native) fillers.push('say-it')
  const start = input.dayIndex % fillers.length
  const rotated = [...fillers.slice(start), ...fillers.slice(0, start)]
  for (const id of rotated) if (!plan.includes(id)) plan.push(id)

  return plan.slice(0, SESSION_LENGTH)
}

// Days since 1 January 1970 in local time, for rotating the plan.
export function dayIndex(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000)
}

// --- Word Recall ---------------------------------------------------------------

// Reveals the answer one letter at a time ("b_____", "bo____"), keeping spaces.
export function hintFor(answer: string, level: number): string {
  let shown = 0
  return [...answer].map((ch) => {
    if (!/\p{L}/u.test(ch)) return ch
    shown++
    return shown <= level ? ch : '_'
  }).join('')
}

// Never more than half the letters, so a hint still leaves something to recall.
export function maxHintLevel(answer: string): number {
  const letters = [...answer].filter(ch => /\p{L}/u.test(ch)).length
  return Math.max(1, Math.floor(letters / 2))
}

// New cards (never reviewed) are capped per day so reviews never pile up;
// cards already in review are always shown, oldest first.
export function limitNew(due: CardRow[], newAllowed: number, limit: number): CardRow[] {
  let newLeft = Math.max(0, newAllowed)
  const picked: CardRow[] = []
  for (const card of due) {
    if (picked.length >= limit) break
    if (card.fsrs.reps === 0) {
      if (newLeft === 0) continue
      newLeft--
    }
    picked.push(card)
  }
  return picked
}

// --- Words list ----------------------------------------------------------------

// Forgotten three or more times after being learned: worth extra attention.
export const TRICKY_LAPSES = 3
export const isTricky = (card: Pick<CardRow, 'fsrs'>) => card.fsrs.lapses >= TRICKY_LAPSES

// Shown right after an answer, so the spacing is visible: "See you in 4 days".
export function comesBackLabel(due: Date, now: Date): string {
  const minutes = (due.getTime() - now.getTime()) / 60_000
  if (minutes < 60) return 'Comes back in a few minutes'
  const label = nextReviewLabel(due, now)
  return label === 'Later today' ? 'Comes back later today' : `See you ${label.toLowerCase()}`
}

export function nextReviewLabel(due: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  if (due.getTime() <= now.getTime()) return 'Due now'
  const days = Math.round((startOf(due) - startOf(now)) / 86_400_000)
  if (days === 0) return 'Later today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${days} days`
  if (days < 60) return `In ${Math.round(days / 7)} weeks`
  return `In ${Math.round(days / 30)} months`
}
