import type { CardRow, MistakeRow, MistakeType } from '../schemas/db'
import type { BuilderCard } from './builder'
import { correctedText, type FixItCard } from './fixit'
import type { RadioCard } from './radio'
import { shuffle } from './rounds'
import type { SoundCard } from './sounds'

// My slips: her recent mistakes from every activity, explained in plain words,
// and a practice round made from them.

export interface Slip {
  type: MistakeType
  at: Date
  // Where it happened.
  source: string
  // What she said, typed or chose, and the right way, where both are known.
  said?: string
  right?: string
  // Anything else worth showing (a partner's note, what the phone heard).
  note?: string
}

export interface SlipLookup {
  fix: Map<string, FixItCard>
  builder: Map<string, BuilderCard>
  sound: Map<string, SoundCard>
  radio: Map<string, RadioCard>
  words: Map<string, Pick<CardRow, 'answer'>>
  talks: Map<string, string>
}

// Each activity saves a slip its own way (see each grade function); this turns
// them all into one readable shape.
export function describeSlip(m: MistakeRow, lookup: SlipLookup): Slip {
  const base = { type: m.type, at: m.at }
  const fix = lookup.fix.get(m.itemId)
  if (fix) return { ...base, source: 'Fix It', said: fix.text, right: correctedText(fix) }
  const built = lookup.builder.get(m.itemId)
  if (built) return { ...base, source: 'Sentence Builder', said: m.detail || undefined, right: built.text }
  const sound = lookup.sound.get(m.itemId)
  if (sound) return { ...base, source: 'Final Sound Hunter', note: m.detail || `${sound.a} or ${sound.b}` }
  const radio = lookup.radio.get(m.itemId)
  if (radio) return { ...base, source: 'Gap Radio', note: m.detail ? `Missed word: ${m.detail}` : radio.title }
  const word = lookup.words.get(m.itemId)
  if (word) return { ...base, source: 'Word Recall', said: m.detail || undefined, right: word.answer }
  const talk = lookup.talks.get(m.itemId)
  if (talk) return { ...base, source: 'Couple Talk', note: m.detail.replace(/^Couple Talk: /, '') || talk }
  if (m.itemId.startsWith('word:') || m.detail.startsWith('said ')) return { ...base, source: 'Say It', note: m.detail }
  return { ...base, source: 'Practice', note: m.detail || undefined }
}

// Her slips by kind, most frequent first.
export function slipSummary(mistakes: readonly Pick<MistakeRow, 'type'>[]): { type: MistakeType, count: number }[] {
  const counts = new Map<MistakeType, number>()
  for (const { type } of mistakes) counts.set(type, (counts.get(type) ?? 0) + 1)
  return [...counts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
}

// A Fix It round from her slips: the very sentences she missed (latest first),
// then other sentences of the kinds she slips on most, shuffled.
export function slipRound(
  cards: readonly FixItCard[],
  mistakes: readonly Pick<MistakeRow, 'type' | 'itemId' | 'at'>[],
  size: number,
  random: () => number = Math.random,
): FixItCard[] {
  const byId = new Map(cards.map(card => [card.itemId, card]))
  const picked: FixItCard[] = []
  for (const m of [...mistakes].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const card = byId.get(m.itemId)
    if (card && !picked.includes(card)) picked.push(card)
  }
  for (const { type } of slipSummary(mistakes)) {
    for (const card of shuffle(cards.filter(c => c.type === type), random)) {
      if (picked.length >= size) break
      if (!picked.includes(card)) picked.push(card)
    }
  }
  return shuffle(picked.slice(0, size), random)
}
