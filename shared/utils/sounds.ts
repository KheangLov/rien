import type { GrammarRow, MistakeRow } from '../schemas/db'
import type { Pack, SoundPair } from '../schemas/pack'
import { gradePractice, type PracticeItem } from './rounds'
import { Rating } from './scheduler'
import { packLevel, soundSkill } from './skills'

export interface SoundCard extends SoundPair, PracticeItem {}

// Endings count as final-sound mistakes; sh/ch, th and v/w as sound mistakes.
export function soundCards(packs: Pack[]): SoundCard[] {
  return packs.flatMap(pack => pack.soundPairs.map(pair => ({
    ...pair,
    book: pack.book,
    file: pack.file,
    itemId: `${pack.id}:${pair.id}`,
    type: pair.focus.startsWith('final-') ? 'final-sound' as const : 'sound' as const,
    skill: soundSkill(pair.focus),
    level: packLevel(pack),
  })))
}

export function gradeSound(
  card: SoundCard,
  previous: GrammarRow | undefined,
  played: string,
  picked: string,
  now: Date,
): { row: GrammarRow, mistake?: MistakeRow } {
  const right = picked === played
  return gradePractice(card, previous, right ? Rating.Good : Rating.Again, right ? undefined : `heard "${played}" as "${picked}"`, now)
}
