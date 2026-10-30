import type { MistakeType } from '../schemas/db'

export interface Verdict {
  result: 'correct' | 'almost' | 'wrong'
  mistake?: MistakeType
  // Short feedback shown after the answer.
  hint?: string
}

// Lowercase, straight apostrophes, no punctuation, single spaces.
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’`]/g, '\'')
    .replace(/[^\p{L}\p{N}' -]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Edit distance where swapping two neighbouring letters ("recieve") counts as one slip.
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
      }
    }
  }
  return d[a.length]![b.length]!
}

const ENDINGS = ['ies', 'ied', 'es', 'ed', 's', 'd'] as const

// The ending the learner left off, if that is the only difference
// ("want" for "wants", "walk" for "walked", "study" for "studied").
export function droppedEnding(typed: string, expected: string): string | undefined {
  for (const ending of ENDINGS) {
    if (!expected.endsWith(ending)) continue
    const stem = expected.slice(0, -ending.length)
    if (typed === stem) return ending
    if ((ending === 'ies' || ending === 'ied') && typed === `${stem}y`) return ending
    if ((ending === 'es' || ending === 'ed') && typed === `${stem}e`) return ending.slice(1)
  }
  return undefined
}

// Dropped endings are the habit the app trains, so they never count as a typo.
export function checkAnswer(typed: string, expected: string): Verdict {
  const got = normalizeAnswer(typed)
  const want = normalizeAnswer(expected)
  if (!got) return { result: 'wrong' }
  if (got === want) return { result: 'correct' }

  const ending = droppedEnding(got, want)
  if (ending) {
    return { result: 'wrong', mistake: 'final-sound', hint: `Check the ending: -${ending}` }
  }

  const allowed = want.length >= 8 ? 2 : want.length >= 4 ? 1 : 0
  if (editDistance(got, want) <= allowed) {
    return { result: 'almost', hint: 'Nearly. Check the spelling.' }
  }
  return { result: 'wrong' }
}

// Hides the answer, and words built on it, inside the example sentence.
// Returns undefined when the word cannot be found, so the example would give it away.
export function blankExample(example: string, answer: string): string | undefined {
  const words = answer.trim().split(/\s+/).filter(Boolean)
  if (!example || words.length === 0) return undefined
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Allow a changed final y ("study" → "studied") and any ending on the last word.
  const parts = words.map((w, i) => {
    const last = i === words.length - 1
    const stem = last && w.length > 3 && w.endsWith('y') ? `${escape(w.slice(0, -1))}(?:y|i)` : escape(w)
    return last ? `${stem}[\\p{L}']*` : stem
  })
  const pattern = new RegExp(`(?<![\\p{L}])${parts.join('\\s+')}`, 'giu')
  if (!pattern.test(example)) return undefined
  return example.replace(pattern, '_____')
}
