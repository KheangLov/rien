import { droppedEnding, normalizeAnswer } from './answer'

export type SpokenStatus = 'ok' | 'ending' | 'missing' | 'unclear'

export interface SpokenWord {
  // The word as written in the sentence, with its punctuation.
  word: string
  status: SpokenStatus
  // What was heard in its place, when that differs.
  heard?: string
  // The ending that was not heard, for status 'ending'.
  ending?: string
}

// One recognised word, with the recognizer's confidence (0 to 1, when given)
// and the other spellings it considered for that stretch of sound.
export interface HeardWord {
  text: string
  confidence?: number
  alternatives?: string[]
}

// Below this, the recognizer was guessing; a missing ending is then "unclear".
export const CONFIDENT = 0.5

const NUMBERS: Record<string, string> = {
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
  17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
  60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'hundred',
}

// Words that sound the same. Pronunciation is about sound, so these are equal.
const SOUND_ALIKE = [
  ['to', 'two', 'too'], ['for', 'four'], ['one', 'won'], ['eight', 'ate'], ['no', 'know'],
  ['there', 'their', 'theyre'], ['your', 'youre'], ['its', "it's"], ['by', 'buy', 'bye'],
  ['right', 'write'], ['see', 'sea'], ['here', 'hear'], ['new', 'knew'], ['son', 'sun'],
  ['week', 'weak'], ['would', 'wood'], ['whose', 'whos'], ['wear', 'where'], ['meet', 'meat'],
  ['i', 'eye'], ['our', 'hour'], ['ok', 'okay'],
]
const CANONICAL = new Map(SOUND_ALIKE.flatMap(group => group.map(w => [w, group[0]!] as const)))

// A form that ignores spelling differences the ear cannot hear: case,
// punctuation, digits written as numbers, homophones, and the apostrophe in
// "apple's" (which sounds exactly like "apples").
export function soundKey(word: string): string {
  let w = normalizeAnswer(word)
  if (/^\d+$/.test(w)) w = NUMBERS[Number(w)] ?? w
  w = w.replace(/'/g, '')
  return CANONICAL.get(w) ?? w
}

// The end of the word "heard" differs from the expected word only by a dropped ending.
function endingDropped(heard: string, expected: string): string | undefined {
  return droppedEnding(soundKey(heard), soundKey(expected)) ?? droppedEnding(normalizeAnswer(heard), normalizeAnswer(expected))
}

function toHeard(input: string | HeardWord[]): HeardWord[] {
  if (typeof input !== 'string') return input
  return input.split(/\s+/).filter(Boolean).map(text => ({ text }))
}

// Lines up the sentence with what the recognizer heard (an edit-distance
// alignment over words) and marks each expected word as heard, heard without
// its ending, not heard, or unclear. A dropped ending only counts when the
// recognizer was confident and none of its alternatives had the ending; the
// recognizer guesses, so anything less is reported as unclear.
export function compareSpoken(expected: string, heard: string | HeardWord[]): SpokenWord[] {
  const want = expected.split(/\s+/).filter(Boolean)
  const got = toHeard(heard).filter(h => soundKey(h.text))
  const keys = want.map(soundKey)
  const gotKeys = got.map(h => soundKey(h.text))
  const n = keys.length
  const m = got.length

  const cost = (i: number, j: number) =>
    keys[i] === gotKeys[j] ? 0 : endingDropped(got[j]!.text, want[i]!) ? 0.5 : 1
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
      const h = got[j - 1]!
      if (c === 0) {
        result.push({ word, status: 'ok' })
      }
      else if (c === 0.5) {
        const altHasEnding = (h.alternatives ?? []).some(alt => soundKey(alt) === keys[i - 1])
        const unsure = altHasEnding || (h.confidence !== undefined && h.confidence > 0 && h.confidence < CONFIDENT)
        result.push(unsure
          ? { word, status: 'unclear', heard: h.text }
          : { word, status: 'ending', heard: h.text, ending: endingDropped(h.text, word) })
      }
      else {
        result.push({ word, status: 'missing', heard: h.text })
      }
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

// Several whole-sentence alternatives: use the one closest to the sentence, so
// a correct reading is not marked wrong because the recognizer ranked another
// spelling first. Ending verdicts still need every alternative to agree.
export function compareBest(expected: string, best: HeardWord[], alternatives: string[]): SpokenWord[] {
  const score = (words: SpokenWord[]) => words.filter(w => w.status === 'ok').length
  let chosen = compareSpoken(expected, best)
  for (const alt of alternatives) {
    const candidate = compareSpoken(expected, alt)
    if (score(candidate) > score(chosen)) chosen = candidate
  }
  // An ending some other full reading did hear is not certain to be missing.
  return chosen.map((w) => {
    if (w.status !== 'ending') return w
    const index = chosen.indexOf(w)
    const heardElsewhere = alternatives.some(alt => compareSpoken(expected, alt)[index]?.status === 'ok')
    return heardElsewhere ? { word: w.word, status: 'unclear', heard: w.heard } : w
  })
}
