import { BOOKS, type Book, type GrammarRow, type MistakeRow, type Settings } from '../schemas/db'
import type { FixItItem, Pack } from '../schemas/pack'
import { normalizeAnswer } from './answer'
import { gradePractice, type PracticeItem } from './rounds'
import { Rating, type Grade } from './scheduler'
import { packLevel, skillOf } from './skills'

export interface FixItCard extends Omit<FixItItem, 'skill' | 'level'>, PracticeItem {}

// Core packs apply at every level; her book's packs up to her current File;
// and every pack of the books before it (ACE moves her through English File
// in order), so what she learned there keeps coming back for review.
export function packsFor(packs: Pack[], settings: Pick<Settings, 'book' | 'file'>): Pack[] {
  const order = (book: Book) => BOOKS.indexOf(book)
  return packs.filter(pack => !pack.book
    || order(pack.book) < order(settings.book)
    || (pack.book === settings.book && (pack.file ?? 1) <= settings.file))
}

export function fixItCards(packs: Pack[]): FixItCard[] {
  return packs.flatMap(pack => pack.fixIt.map(item => ({
    ...item,
    book: pack.book,
    file: pack.file,
    itemId: `${pack.id}:${item.id}`,
    skill: skillOf(item),
    level: item.level ?? packLevel(pack),
  })))
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

export function wrongIndex(item: Pick<FixItItem, 'text' | 'wrong'>): number {
  const key = normalizeAnswer(item.wrong)
  return tokenize(item.text).findIndex(token => normalizeAnswer(token) === key)
}

// The sentence with the fix in place, keeping the punctuation around the wrong word.
export function correctedText(item: Pick<FixItItem, 'text' | 'wrong' | 'fix'>): string {
  const tokens = tokenize(item.text)
  const index = wrongIndex(item)
  const token = tokens[index]
  if (token === undefined) return item.text
  const [, before = '', after = ''] = token.match(/^([^\p{L}\p{N}']*).*?([^\p{L}\p{N}']*)$/u) ?? []
  tokens[index] = `${before}${item.fix}${after}`
  return tokens.join(' ')
}

export interface FixItResult {
  wrongTaps: number
  wrongChoice: boolean
}

// Found it first time and fixed it: Good. Needed more than one tap: Hard. Wrong fix: Again.
export function fixItGrade({ wrongTaps, wrongChoice }: FixItResult): Grade {
  if (wrongChoice) return Rating.Again
  return wrongTaps > 0 ? Rating.Hard : Rating.Good
}

export function gradeFixIt(
  card: FixItCard,
  previous: GrammarRow | undefined,
  result: FixItResult,
  now: Date,
): { row: GrammarRow, mistake?: MistakeRow } {
  const slipped = result.wrongChoice || result.wrongTaps > 0
  return gradePractice(card, previous, fixItGrade(result), slipped ? card.text : undefined, now)
}
