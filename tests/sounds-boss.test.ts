import { describe, expect, it } from 'vitest'
import type { CardRow } from '#shared/schemas/db'
import { soundPairSchema } from '#shared/schemas/pack'
import { buildBossQuiz } from '#shared/utils/boss'
import type { FixItCard } from '#shared/utils/fixit'
import { shuffle } from '#shared/utils/rounds'
import { Rating } from '#shared/utils/scheduler'
import { gradeSound, soundCards, type SoundCard } from '#shared/utils/sounds'

const now = new Date('2026-11-02T08:00:00Z')
const noRandom = () => 0

describe('sound pairs', () => {
  const [ending, th] = soundCards([{
    id: 'sounds',
    title: '',
    fixIt: [],
    soundPairs: [
      { id: 'final-s-want', a: 'want', b: 'wants', focus: 'final-s' },
      { id: 'th-think', a: 'think', b: 'sink', focus: 'th' },
    ],
  }])

  it('tags endings as final-sound and other pairs as sound', () => {
    expect(ending).toMatchObject({ itemId: 'sounds:final-s-want', type: 'final-sound' })
    expect(th!.type).toBe('sound')
  })

  it('grades a right answer Good and a wrong one Again with the slip noted', () => {
    expect(gradeSound(ending!, undefined, 'wants', 'wants', now).mistake).toBeUndefined()
    const { row, mistake } = gradeSound(ending!, undefined, 'wants', 'want', now)
    expect(row.fsrs.reps).toBe(1)
    expect(row.fsrs.lapses).toBe(0)
    expect(mistake).toMatchObject({ type: 'final-sound', detail: 'heard "wants" as "want"' })
    expect(Rating.Again).toBe(1)
  })

  it('rejects a pair whose two words are the same', () => {
    expect(soundPairSchema.safeParse({ id: 'x', a: 'Want', b: 'want', focus: 'final-s' }).success).toBe(false)
  })
})

describe('shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4], Math.random).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('buildBossQuiz', () => {
  const word = (i: number) => ({ id: `w${i}`, answer: `word${i}` }) as CardRow
  const fix = (i: number) => ({ itemId: `core:f${i}`, type: 'tense' }) as FixItCard
  const sound = (i: number) => ({ itemId: `sounds:s${i}`, type: 'final-sound' }) as SoundCard
  const range = (n: number) => Array.from({ length: n }, (_, i) => i)

  it('makes 15 questions: up to 8 words, the rest split between sentences and sounds', () => {
    const quiz = buildBossQuiz({
      words: range(12).map(word),
      fixCards: range(30).map(fix),
      soundCards: range(30).map(sound),
      missedItemIds: new Set(),
      random: noRandom,
    })
    const count = (kind: string) => quiz.filter(q => q.kind === kind).length
    expect(quiz).toHaveLength(15)
    expect([count('word'), count('fix'), count('sound')]).toEqual([8, 5, 2])
  })

  it('includes recent mistakes before other items', () => {
    const quiz = buildBossQuiz({
      words: [],
      fixCards: range(40).map(fix),
      soundCards: range(40).map(sound),
      missedItemIds: new Set(['core:f39', 'sounds:s39']),
      random: noRandom,
    })
    const ids = quiz.map(q => q.kind === 'word' ? q.card.id : q.card.itemId)
    expect(ids).toContain('core:f39')
    expect(ids).toContain('sounds:s39')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fills from the other kind when one runs short, and returns fewer when all do', () => {
    const quiz = buildBossQuiz({ words: [word(1)], fixCards: range(20).map(fix), soundCards: [sound(1)], missedItemIds: new Set(), random: noRandom })
    expect(quiz).toHaveLength(15)
    const small = buildBossQuiz({ words: [word(1)], fixCards: [fix(1)], soundCards: [sound(1)], missedItemIds: new Set(), random: noRandom })
    expect(small).toHaveLength(3)
  })
})
