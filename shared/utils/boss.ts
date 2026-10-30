import type { CardRow } from '../schemas/db'
import type { FixItCard } from './fixit'
import { shuffle } from './rounds'
import type { SoundCard } from './sounds'

export type BossQuestion =
  | { kind: 'word', card: CardRow }
  | { kind: 'fix', card: FixItCard }
  | { kind: 'sound', card: SoundCard }

export const BOSS_SIZE = 15
const MAX_WORDS = 8
const SOUND_SHARE = 0.3

// Items she got wrong recently first, then the rest, each part shuffled.
function missedFirst<T extends { itemId: string }>(items: T[], missed: Set<string>, random: () => number): T[] {
  return [
    ...shuffle(items.filter(i => missed.has(i.itemId)), random),
    ...shuffle(items.filter(i => !missed.has(i.itemId)), random),
  ]
}

// The end-of-File quiz: her own words from this File, then the Fix It sentences
// and sound pairs she missed recently, topped up with others, all mixed together.
export function buildBossQuiz(input: {
  words: CardRow[]
  fixCards: FixItCard[]
  soundCards: SoundCard[]
  missedItemIds: Set<string>
  size?: number
  random?: () => number
}): BossQuestion[] {
  const { size = BOSS_SIZE, random = Math.random, missedItemIds } = input
  const words = shuffle(input.words, random).slice(0, Math.min(MAX_WORDS, size))
  const fixes = missedFirst(input.fixCards, missedItemIds, random)
  const sounds = missedFirst(input.soundCards, missedItemIds, random)

  const rest = size - words.length
  let soundCount = Math.min(sounds.length, Math.round(rest * SOUND_SHARE))
  const fixCount = Math.min(fixes.length, rest - soundCount)
  soundCount = Math.min(sounds.length, rest - fixCount)

  return shuffle([
    ...words.map(card => ({ kind: 'word' as const, card })),
    ...fixes.slice(0, fixCount).map(card => ({ kind: 'fix' as const, card })),
    ...sounds.slice(0, soundCount).map(card => ({ kind: 'sound' as const, card })),
  ], random)
}
