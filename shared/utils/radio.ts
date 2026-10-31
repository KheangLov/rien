import type { GrammarRow, MistakeRow } from '../schemas/db'
import type { Pack, RadioText } from '../schemas/pack'
import { checkAnswer, type Verdict } from './answer'
import { gradePractice, type PracticeItem } from './rounds'
import { Rating } from './scheduler'

export interface RadioCard extends RadioText, PracticeItem {}

export interface RadioToken {
  // Text before the gap's word, the word itself, and text after it, e.g. "(" "walked" "),".
  before: string
  word: string
  after: string
  gap?: number
}

export const GAP_EVERY = 7

export function radioCards(packs: Pack[]): RadioCard[] {
  return packs.flatMap(pack => pack.radio.map(item => ({ ...item, itemId: `${pack.id}:${item.id}`, type: 'listening' as const })))
}

// Splits the text into words and blanks every seventh one. A word with no
// letters (a number) is skipped and the gap moves to the next word.
export function radioTokens(text: string, every = GAP_EVERY): RadioToken[] {
  let count = 0
  let gaps = 0
  return text.trim().split(/\s+/).map((raw) => {
    const [, before = '', word = raw, after = ''] = raw.match(/^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u) ?? []
    count++
    if (count >= every && /\p{L}/u.test(word)) {
      count = 0
      return { before, word, after, gap: gaps++ }
    }
    return { before, word, after }
  })
}

export function radioAnswers(tokens: RadioToken[]): string[] {
  return tokens.filter(t => t.gap !== undefined).map(t => t.word)
}

export function checkGaps(answers: string[], typed: string[]): Verdict[] {
  return answers.map((answer, i) => checkAnswer(typed[i] ?? '', answer))
}

// Nearly all right: Good. Most right: Hard. Otherwise Again. A typo counts as right.
export function gradeRadio(
  card: RadioCard,
  previous: GrammarRow | undefined,
  verdicts: Verdict[],
  now: Date,
): { row: GrammarRow, mistakes: MistakeRow[], right: number } {
  const right = verdicts.filter(v => v.result !== 'wrong').length
  const share = verdicts.length ? right / verdicts.length : 1
  const grade = share >= 0.9 ? Rating.Good : share >= 0.6 ? Rating.Hard : Rating.Again
  const { row } = gradePractice(card, previous, grade, undefined, now)
  const answers = radioAnswers(radioTokens(card.text))
  const mistakes = verdicts.flatMap((v, i) => v.result === 'wrong'
    ? [{ type: v.mistake ?? 'listening', itemId: card.itemId, at: now, detail: answers[i] ?? '' } satisfies MistakeRow]
    : [])
  return { row, mistakes, right }
}
