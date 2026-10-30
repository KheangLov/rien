import type { Card } from 'ts-fsrs'
import type { GrammarRow, MistakeRow, MistakeType, Settings } from '../schemas/db'
import type { FixItItem, Pack } from '../schemas/pack'
import { normalizeAnswer } from './answer'
import { newFsrsState, nextFsrsState, Rating, type Grade } from './scheduler'

export interface FixItCard extends FixItItem {
  // Unique across packs: "<pack id>:<item id>".
  itemId: string
}

// Core packs apply at every level; book packs up to her current File.
export function packsFor(packs: Pack[], settings: Pick<Settings, 'book' | 'file'>): Pack[] {
  return packs.filter(pack => !pack.book || (pack.book === settings.book && (pack.file ?? 1) <= settings.file))
}

export function fixItCards(packs: Pack[]): FixItCard[] {
  return packs.flatMap(pack => pack.fixIt.map(item => ({ ...item, itemId: `${pack.id}:${item.id}` })))
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
  const fsrs = nextFsrsState((previous?.fsrs as Card | undefined) ?? newFsrsState(now), fixItGrade(result), now)
  const slipped = result.wrongChoice || result.wrongTaps > 0
  return {
    row: { itemId: card.itemId, type: card.type, fsrs, due: fsrs.due },
    mistake: slipped ? { type: card.type, itemId: card.itemId, at: now, detail: card.text } : undefined,
  }
}

// Picks a round: sentences already seen and now due come first, then new ones,
// starting with the mistake types she gets wrong most often.
export function pickFixItRound(
  cards: FixItCard[],
  states: Map<string, GrammarRow>,
  mistakeCounts: Partial<Record<MistakeType, number>>,
  now: Date,
  size: number,
  random: () => number = Math.random,
): FixItCard[] {
  const dueAt = (card: FixItCard) => states.get(card.itemId)?.due.getTime()
  const due = cards
    .filter((card) => {
      const at = dueAt(card)
      return at !== undefined && at <= now.getTime()
    })
    .sort((a, b) => dueAt(a)! - dueAt(b)!)

  const fresh = cards
    .filter(card => !states.has(card.itemId))
    .map(card => ({ card, weight: (mistakeCounts[card.type] ?? 0) + random() }))
    .sort((a, b) => b.weight - a.weight)
    .map(({ card }) => card)

  return [...due, ...fresh].slice(0, size)
}
