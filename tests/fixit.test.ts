import { describe, expect, it } from 'vitest'
import type { GrammarRow } from '#shared/schemas/db'
import { correctedText, fixItCards, fixItGrade, gradeFixIt, packsFor, wrongIndex, type FixItCard } from '#shared/utils/fixit'
import { pickRound } from '#shared/utils/rounds'
import { newFsrsState, Rating } from '#shared/utils/scheduler'

const now = new Date('2026-11-02T08:00:00Z')

function card(id: string, type: FixItCard['type'] = 'tense'): FixItCard {
  return { itemId: `core:${id}`, id, text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type, explain: '' }
}

function state(item: FixItCard, due: Date): GrammarRow {
  return { itemId: item.itemId, type: item.type, fsrs: { ...newFsrsState(now), due }, due }
}

describe('sentence handling', () => {
  it('finds the wrong word ignoring case and punctuation', () => {
    expect(wrongIndex({ text: 'Sun rises in the east.', wrong: 'sun' })).toBe(0)
    expect(wrongIndex({ text: 'Do you have car?', wrong: 'car' })).toBe(3)
  })

  it('keeps punctuation around the fixed word', () => {
    expect(correctedText({ text: 'Do you have car?', wrong: 'car', fix: 'a car' })).toBe('Do you have a car?')
    expect(correctedText({ text: 'Be quiet, my mother cooking dinner now.', wrong: 'cooking', fix: 'is cooking' }))
      .toBe('Be quiet, my mother is cooking dinner now.')
    expect(correctedText({ text: 'He don\'t speak French.', wrong: 'don\'t', fix: 'doesn\'t' })).toBe('He doesn\'t speak French.')
  })

  it('gives each pack item an id that is unique across packs', () => {
    const item = { id: 'a', text: 'x y', wrong: 'x', fix: 'z', distractors: ['w'], type: 'tense' as const, explain: '' }
    const ids = fixItCards([
      { id: 'one', title: '', fixIt: [item], soundPairs: [] },
      { id: 'two', title: '', fixIt: [item], soundPairs: [] },
    ]).map(c => c.itemId)
    expect(ids).toEqual(['one:a', 'two:a'])
  })
})

describe('grading', () => {
  it('rates by how she found and fixed the mistake', () => {
    expect(fixItGrade({ wrongTaps: 0, wrongChoice: false })).toBe(Rating.Good)
    expect(fixItGrade({ wrongTaps: 2, wrongChoice: false })).toBe(Rating.Hard)
    expect(fixItGrade({ wrongTaps: 0, wrongChoice: true })).toBe(Rating.Again)
  })

  it('logs a mistake of the item type only when she slipped', () => {
    const item = card('a', 'article')
    expect(gradeFixIt(item, undefined, { wrongTaps: 0, wrongChoice: false }, now).mistake).toBeUndefined()
    const { row, mistake } = gradeFixIt(item, undefined, { wrongTaps: 1, wrongChoice: false }, now)
    expect(mistake).toMatchObject({ type: 'article', itemId: 'core:a' })
    expect(row.due.getTime()).toBeGreaterThan(now.getTime())
    expect(row.due).toEqual(row.fsrs.due)
  })
})

describe('pickRound', () => {
  const noRandom = () => 0

  it('puts due sentences first, oldest first, and skips ones not yet due', () => {
    const [a, b, c] = [card('a'), card('b'), card('c')]
    const states = new Map([
      [a.itemId, state(a, new Date('2026-11-01T00:00:00Z'))],
      [b.itemId, state(b, new Date('2026-10-30T00:00:00Z'))],
      [c.itemId, state(c, new Date('2026-11-09T00:00:00Z'))],
    ])
    const round = pickRound([a, b, c, card('d')], states, {}, now, 10, noRandom)
    expect(round.map(x => x.id)).toEqual(['b', 'a', 'd'])
  })

  it('brings her weakest mistake types forward among new sentences', () => {
    const cards = [card('t', 'tense'), card('a', 'article'), card('p', 'preposition')]
    const round = pickRound(cards, new Map(), { article: 5, preposition: 2 }, now, 2, noRandom)
    expect(round.map(x => x.id)).toEqual(['a', 'p'])
  })
})

describe('packsFor', () => {
  const base = { title: '', fixIt: [], soundPairs: [] }
  const packs = [
    { ...base, id: 'core' },
    { ...base, id: 'pre-7', book: 'english-file-pre-intermediate-4e' as const, file: 7 },
    { ...base, id: 'pre-9', book: 'english-file-pre-intermediate-4e' as const, file: 9 },
    { ...base, id: 'int-1', book: 'english-file-intermediate-4e' as const, file: 1 },
  ]

  it('keeps core packs and her book up to her current File', () => {
    expect(packsFor(packs, { book: 'english-file-pre-intermediate-4e', file: 8 }).map(p => p.id)).toEqual(['core', 'pre-7'])
  })
})
