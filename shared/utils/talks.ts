import type { MistakeType, TalkResult } from '../schemas/db'
import type { Pack, Talk } from '../schemas/pack'

export interface TalkCard extends Talk {
  // Unique across packs: "<pack id>:<talk id>".
  talkId: string
}

export function talkCards(packs: Pack[]): TalkCard[] {
  return packs.flatMap(pack => pack.talks.map(talk => ({ ...talk, talkId: `${pack.id}:${talk.id}` })))
}

// Orders the topics to offer: ones they have not done yet first, those that
// practise her most frequent mistake type before the rest; then the topics
// done longest ago.
export function orderTalks(
  talks: TalkCard[],
  history: Pick<TalkResult, 'talkId' | 'at'>[],
  mistakeCounts: Partial<Record<MistakeType, number>>,
  random: () => number = Math.random,
): TalkCard[] {
  const lastDone = new Map<string, number>()
  for (const { talkId, at } of history) {
    lastDone.set(talkId, Math.max(lastDone.get(talkId) ?? 0, at.getTime()))
  }
  const weight = (talk: TalkCard) => (mistakeCounts[talk.focus] ?? 0) + random()

  const fresh = talks
    .filter(talk => !lastDone.has(talk.talkId))
    .map(talk => ({ talk, w: weight(talk) }))
    .sort((a, b) => b.w - a.w)
    .map(({ talk }) => talk)
  const done = talks
    .filter(talk => lastDone.has(talk.talkId))
    .sort((a, b) => lastDone.get(a.talkId)! - lastDone.get(b.talkId)!)

  return [...fresh, ...done]
}
