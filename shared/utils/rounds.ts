import type { Card } from 'ts-fsrs'
import type { GrammarRow, MistakeRow, MistakeType } from '../schemas/db'
import { newFsrsState, nextFsrsState, type Grade } from './scheduler'

// Anything from a content pack she practises: a Fix It sentence or a sound pair.
export interface PracticeItem {
  // Unique across packs: "<pack id>:<item id>".
  itemId: string
  type: MistakeType
}

// Picks a round: items already seen and now due come first, oldest first, then
// new ones, starting with the mistake types she gets wrong most often.
export function pickRound<T extends PracticeItem>(
  items: T[],
  states: Map<string, GrammarRow>,
  mistakeCounts: Partial<Record<MistakeType, number>>,
  now: Date,
  size: number,
  random: () => number = Math.random,
): T[] {
  const dueAt = (item: T) => states.get(item.itemId)?.due.getTime()
  const due = items
    .filter((item) => {
      const at = dueAt(item)
      return at !== undefined && at <= now.getTime()
    })
    .sort((a, b) => dueAt(a)! - dueAt(b)!)

  const fresh = items
    .filter(item => !states.has(item.itemId))
    .map(item => ({ item, weight: (mistakeCounts[item.type] ?? 0) + random() }))
    .sort((a, b) => b.weight - a.weight)
    .map(({ item }) => item)

  return [...due, ...fresh].slice(0, size)
}

// Reschedules one practice item and, if she slipped, tags the mistake.
export function gradePractice(
  item: PracticeItem,
  previous: GrammarRow | undefined,
  grade: Grade,
  slip: string | undefined,
  now: Date,
): { row: GrammarRow, mistake?: MistakeRow } {
  const fsrs = nextFsrsState((previous?.fsrs as Card | undefined) ?? newFsrsState(now), grade, now)
  return {
    row: { itemId: item.itemId, type: item.type, fsrs, due: fsrs.due },
    mistake: slip === undefined ? undefined : { type: item.type, itemId: item.itemId, at: now, detail: slip.slice(0, 200) },
  }
}

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
