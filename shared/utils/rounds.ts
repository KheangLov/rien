import type { Card } from 'ts-fsrs'
import type { GrammarRow, MistakeRow, MistakeType } from '../schemas/db'
import { newFsrsState, nextFsrsState, type Grade } from './scheduler'

// Anything from a content pack she practises: a Fix It sentence or a sound pair.
export interface PracticeItem {
  // Unique across packs: "<pack id>:<item id>".
  itemId: string
  type: MistakeType
}

// Answered this recently, a due item waits (missed items come back within
// minutes, which made rounds feel like the same few sentences again).
export const RECENT_MS = 15 * 60_000

// Picks a round. Spaced repetition decides what is due, then the round is mixed
// so it does not feel the same each time:
// - due items come first, oldest first, except ones she answered in the last
//   RECENT_MS, which fill in only when the round would be short;
// - new items are drawn at random, leaning towards her weaker mistake types,
//   but one type takes at most half the round;
// - the chosen items are shuffled.
export function pickRound<T extends PracticeItem>(
  items: T[],
  states: Map<string, GrammarRow>,
  mistakeCounts: Partial<Record<MistakeType, number>>,
  now: Date,
  size: number,
  random: () => number = Math.random,
): T[] {
  const at = now.getTime()
  const dueAt = (item: T) => states.get(item.itemId)?.due.getTime()
  const seenAt = (item: T) => {
    const last = (states.get(item.itemId)?.fsrs as { last_review?: Date | string } | undefined)?.last_review
    return last ? new Date(last).getTime() : undefined
  }
  const due = items
    .filter((item) => {
      const when = dueAt(item)
      return when !== undefined && when <= at
    })
    .sort((a, b) => dueAt(a)! - dueAt(b)!)
  const recent = (item: T) => (seenAt(item) ?? 0) > at - RECENT_MS

  // Weighted random order (a key of random^(1/weight)): weaker types come
  // earlier more often, never always.
  const fresh = items
    .filter(item => !states.has(item.itemId))
    .map(item => ({ item, key: random() ** (1 / (1 + Math.min(4, mistakeCounts[item.type] ?? 0))) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item)

  const picked: T[] = []
  const perType = new Map<MistakeType, number>()
  const cap = Math.max(1, Math.ceil(size / 2))
  const take = (list: T[], capped: boolean) => {
    for (const item of list) {
      if (picked.length >= size) return
      if (picked.includes(item)) continue
      if (capped && (perType.get(item.type) ?? 0) >= cap) continue
      picked.push(item)
      perType.set(item.type, (perType.get(item.type) ?? 0) + 1)
    }
  }
  take(due.filter(item => !recent(item)), false)
  take(fresh, true)
  take(fresh, false)
  take(due.filter(recent), false)
  return shuffle(picked, random)
}

// Fills a short round with items she has already met but that are not due,
// those met longest ago first (with a little shuffle), so a game never ends in
// "All caught up". Spaced repetition copes with an early review: it simply
// counts for less.
export function topUpRound<T extends PracticeItem>(
  round: T[],
  items: T[],
  states: Map<string, GrammarRow>,
  size: number,
  random: () => number = Math.random,
): T[] {
  const need = size - round.length
  if (need <= 0) return round
  const seenAt = (item: T) => {
    const last = (states.get(item.itemId)?.fsrs as { last_review?: Date | string } | undefined)?.last_review
    return last ? new Date(last).getTime() : 0
  }
  const older = items
    .filter(item => states.has(item.itemId) && !round.includes(item))
    .sort((a, b) => seenAt(a) - seenAt(b))
  return shuffle([...round, ...shuffle(older.slice(0, need * 2), random).slice(0, need)], random)
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
