import { droppedEnding, normalizeAnswer } from './answer'

export type SpokenStatus = 'ok' | 'ending' | 'missing'

export interface SpokenWord {
  // The word as written in the sentence, with its punctuation.
  word: string
  status: SpokenStatus
  // What was heard in its place, when that differs.
  heard?: string
  // The ending that was not heard, for status 'ending'.
  ending?: string
}

const words = (text: string) => text.split(/\s+/).filter(Boolean)

// Lines up the sentence with what the recognizer heard (an edit-distance
// alignment over words) and marks each expected word as heard, heard without
// its ending, or not heard. The recognizer guesses, so this is a hint only.
export function compareSpoken(expected: string, heard: string): SpokenWord[] {
  const want = words(expected)
  const got = words(heard).map(normalizeAnswer).filter(Boolean)
  const keys = want.map(normalizeAnswer)
  const n = keys.length
  const m = got.length

  const cost = (i: number, j: number) =>
    keys[i] === got[j] ? 0 : droppedEnding(got[j]!, keys[i]!) ? 0.5 : 1
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost(i - 1, j - 1))
    }
  }

  const result: SpokenWord[] = []
  let i = n
  let j = m
  while (i > 0) {
    if (j > 0 && d[i]![j] === d[i - 1]![j - 1]! + cost(i - 1, j - 1)) {
      const c = cost(i - 1, j - 1)
      const word = want[i - 1]!
      if (c === 0) result.push({ word, status: 'ok' })
      else if (c === 0.5) result.push({ word, status: 'ending', heard: got[j - 1], ending: droppedEnding(got[j - 1]!, keys[i - 1]!) })
      else result.push({ word, status: 'missing', heard: got[j - 1] })
      i--
      j--
    }
    else if (j > 0 && d[i]![j] === d[i]![j - 1]! + 1) {
      j--
    }
    else {
      result.push({ word: want[i - 1]!, status: 'missing' })
      i--
    }
  }
  return result.reverse()
}
