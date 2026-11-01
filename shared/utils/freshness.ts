import { FILE_NUMBERS, type Settings } from '../schemas/db'
import { FILES_IN_BOOK } from './levelUp'
import type { Pack } from '../schemas/pack'
import { packsFor } from './fixit'

// How much at her level she has not met yet, and which File would bring more,
// so the app can say "File 10 adds 6 new sentences" instead of repeating itself.
export type ContentKind = 'fixIt' | 'builder' | 'radio' | 'soundPairs'

// Fewer new items than this, and Rien suggests moving on.
export const FEW_NEW = 5

export function newItems(
  packs: Pack[],
  level: Pick<Settings, 'book' | 'file'>,
  seen: ReadonlySet<string>,
  kinds: readonly ContentKind[],
): number {
  return packsFor(packs, level)
    .flatMap(pack => kinds.flatMap(kind => pack[kind].map(item => `${pack.id}:${item.id}`)))
    .filter(id => !seen.has(id))
    .length
}

// The next File of her book that adds new items of these kinds, and how many.
export function nextLevel(
  packs: Pack[],
  level: Pick<Settings, 'book' | 'file'>,
  seen: ReadonlySet<string>,
  kinds: readonly ContentKind[],
): { file: number, count: number } | undefined {
  const now = newItems(packs, level, seen, kinds)
  for (const file of FILE_NUMBERS.filter(f => f > level.file && f <= FILES_IN_BOOK[level.book])) {
    const count = newItems(packs, { book: level.book, file }, seen, kinds) - now
    if (count > 0) return { file, count }
  }
  return undefined
}
