import type { GrammarRow, MistakeRow } from '../schemas/db'
import type { BuilderItem, Pack } from '../schemas/pack'
import { normalizeAnswer } from './answer'
import { gradePractice, shuffle, type PracticeItem } from './rounds'
import { Rating } from './scheduler'
import { packLevel } from './skills'

export interface BuilderCard extends Omit<BuilderItem, 'skill' | 'level'>, PracticeItem {}

export interface Tile {
  id: number
  word: string
}

export function builderCards(packs: Pack[]): BuilderCard[] {
  return packs.flatMap(pack => pack.builder.map(item => ({
    ...item,
    book: pack.book,
    file: pack.file,
    itemId: `${pack.id}:${item.id}`,
    type: 'word-order' as const,
    skill: item.skill ?? 'word-order',
    level: item.level ?? packLevel(pack),
  })))
}

// The end mark (. ? !) stays fixed after the tiles.
export function endMark(text: string): string {
  return text.trim().match(/[.?!]$/)?.[0] ?? ''
}

// Word tiles in a shuffled order that is never already correct. The first
// word is lowercased so its capital letter does not give the answer away.
export function builderTiles(item: BuilderItem, random: () => number = Math.random): Tile[] {
  const words = item.text.trim().replace(/[.?!]$/, '').split(/\s+/)
    .map(word => word.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(Boolean)
  const shown = words.map((word, i) =>
    i === 0 && !item.keepFirstCapital && word !== 'I' ? word.toLowerCase() : word)
  const tiles = shown.map((word, id) => ({ id, word }))
  if (new Set(shown.map(w => w.toLowerCase())).size < 2) return tiles
  for (let tries = 0; tries < 20; tries++) {
    const order = shuffle(tiles, random)
    if (!isCorrect(item, order.map(t => t.word))) return order
  }
  return [...tiles].reverse()
}

export function isCorrect(item: Pick<BuilderItem, 'text' | 'alternatives'>, words: string[]): boolean {
  const built = normalizeAnswer(words.join(' '))
  return [item.text, ...item.alternatives].some(answer => normalizeAnswer(answer) === built)
}

// Right first time: Good. Right on the second try: Hard. Otherwise Again.
export function gradeBuilder(
  card: BuilderCard,
  previous: GrammarRow | undefined,
  attempts: number,
  solved: boolean,
  lastTry: string,
  now: Date,
): { row: GrammarRow, mistake?: MistakeRow } {
  const grade = solved && attempts === 1 ? Rating.Good : solved ? Rating.Hard : Rating.Again
  return gradePractice(card, previous, grade, solved && attempts === 1 ? undefined : lastTry, now)
}
