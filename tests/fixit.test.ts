import { describe, expect, it } from 'vitest'
import type { GrammarRow } from '#shared/schemas/db'
import { correctedText, fixItCards, fixItGrade, gradeFixIt, packsFor, wrongIndex, type FixItCard } from '#shared/utils/fixit'
import { builderCards } from '#shared/utils/builder'
import { radioCards } from '#shared/utils/radio'
import { soundCards } from '#shared/utils/sounds'
import { pickRound } from '#shared/utils/rounds'
import { newFsrsState, Rating } from '#shared/utils/scheduler'

const now = new Date('2026-11-02T08:00:00Z')

function card(id: string, type: FixItCard['type'] = 'tense'): FixItCard {
  return { itemId: `core:${id}`, id, text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type, explain: '', skill: 'past-simple', level: 'A2' }
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
  const ids = (round: { id: string }[]) => round.map(x => x.id).sort()

  it('takes due sentences and new ones, and skips ones not yet due', () => {
    const [a, b, c] = [card('a'), card('b'), card('c')]
    const states = new Map([
      [a.itemId, state(a, new Date('2026-11-01T00:00:00Z'))],
      [b.itemId, state(b, new Date('2026-10-30T00:00:00Z'))],
      [c.itemId, state(c, new Date('2026-11-09T00:00:00Z'))],
    ])
    expect(ids(pickRound([a, b, c, card('d')], states, {}, now, 10, noRandom))).toEqual(['a', 'b', 'd'])
  })

  it('draws new sentences the skill model ranks higher more often', () => {
    const items = Array.from({ length: 10 }, (_, i) => card(`n${i}`))
    let seed = 1
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    let favoured = 0
    for (let run = 0; run < 400; run++) {
      const round = pickRound(items, new Map(), {}, now, 3, random, item => (item.id === 'n0' || item.id === 'n1' ? 1.2 : 0.1))
      favoured += round.filter(x => x.id === 'n0' || x.id === 'n1').length
    }
    // 2 of 10 items, but well over a fifth of the picks.
    expect(favoured / (400 * 3)).toBeGreaterThan(0.4)
  })

  it('prefers the oldest due sentences when the round is full', () => {
    const [a, b] = [card('a'), card('b')]
    const states = new Map([
      [a.itemId, state(a, new Date('2026-11-01T00:00:00Z'))],
      [b.itemId, state(b, new Date('2026-10-30T00:00:00Z'))],
    ])
    expect(ids(pickRound([a, b, card('d')], states, {}, now, 1, noRandom))).toEqual(['b'])
  })

  it('holds back a sentence answered minutes ago unless the round is short', () => {
    const [a, b] = [card('a'), card('b')]
    const just = { ...state(a, new Date(now.getTime() - 60_000)), fsrs: { ...state(a, now).fsrs, last_review: new Date(now.getTime() - 5 * 60_000) } }
    const states = new Map([[a.itemId, just], [b.itemId, state(b, new Date('2026-10-30T00:00:00Z'))]])
    expect(ids(pickRound([a, b, card('n')], states, {}, now, 2, noRandom))).toEqual(['b', 'n'])
    expect(ids(pickRound([a, b], states, {}, now, 2, noRandom))).toEqual(['a', 'b'])
  })

  it('leans towards her weakest mistake types among new sentences', () => {
    const cards = [card('t', 'tense'), card('a', 'article'), card('p', 'preposition')]
    const random = () => 0.5
    expect(ids(pickRound(cards, new Map(), { article: 5, preposition: 2 }, now, 2, random))).toEqual(['a', 'p'])
  })

  it('lets one mistake type fill at most half the round', () => {
    const cards = [...['1', '2', '3', '4'].map(id => card(`a${id}`, 'article')), card('t', 'tense'), card('p', 'preposition')]
    const round = pickRound(cards, new Map(), { article: 9 }, now, 4, () => 0.5)
    expect(round.filter(c => c.type === 'article')).toHaveLength(2)
  })

  it('mixes the order and the choice of new sentences from round to round', () => {
    const cards = Array.from({ length: 30 }, (_, i) => card(`c${i}`))
    const rounds = new Set(Array.from({ length: 6 }, () => pickRound(cards, new Map(), {}, now, 10).map(c => c.id).join()))
    expect(rounds.size).toBeGreaterThan(1)
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

  it('keeps every pack of the books before hers, so earlier work is still reviewed', () => {
    expect(packsFor(packs, { book: 'english-file-intermediate-4e', file: 1 }).map(p => p.id)).toEqual(['core', 'pre-7', 'pre-9', 'int-1'])
    expect(packsFor(packs, { book: 'english-file-upper-intermediate-4e', file: 1 }).map(p => p.id)).toEqual(['core', 'pre-7', 'pre-9', 'int-1'])
  })

  it('carries each pack\'s book and File onto every kind of card', () => {
    const fix = { id: 'a', text: 'x y', wrong: 'x', fix: 'z', distractors: ['w'], type: 'tense' as const, explain: '' }
    const build = { id: 'b', words: ['a', 'b'], translation: '', explain: '' } as never
    const pair = { id: 's', focus: 'final-t', words: ['a', 'b'] } as never
    const radio = { id: 'r', title: '', text: 'a b c' } as never
    const make = (extra: object) => [{ id: 'p', title: '', fixIt: [fix], soundPairs: [pair], talks: [], builder: [build], radio: [radio], ...extra }] as never
    const origins = (packs: never) => [fixItCards(packs)[0], soundCards(packs)[0], builderCards(packs)[0], radioCards(packs)[0]]
      .map(c => [c!.book, c!.file])
    expect(origins(make({ book: 'english-file-intermediate-4e', file: 3 }))).toEqual(Array(4).fill(['english-file-intermediate-4e', 3]))
    expect(origins(make({ book: 'ready-for-ielts' }))).toEqual(Array(4).fill(['ready-for-ielts', undefined]))
    expect(origins(make({}))).toEqual(Array(4).fill([undefined, undefined]))
  })
})

describe('pickRound with her book and File', () => {
  const noRandom = () => 0
  const scope = { book: 'english-file-intermediate-4e', file: 4 } as const
  const from = (id: string, book?: FixItCard['book'], file?: number): FixItCard => ({ ...card(id), book, file })
  const ids = (round: { id: string }[]) => round.map(x => x.id).sort()
  const here = [from('h1', scope.book, 4), from('h2', scope.book, 4)]
  const earlier = [from('e3', scope.book, 3), from('e1', scope.book, 1), from('prev', 'english-file-pre-intermediate-4e', 12), from('core')]

  it('draws new sentences from her own File before earlier and core ones', () => {
    const round = pickRound([...earlier, ...here], new Map(), {}, now, 2, noRandom, undefined, scope)
    expect(ids(round)).toEqual(['h1', 'h2'])
  })

  it('fills a short round with the nearest earlier content first', () => {
    const round = pickRound([...earlier, here[0]!], new Map(), {}, now, 4, noRandom, undefined, scope)
    expect(ids(round)).toEqual(['e1', 'e3', 'h1', 'prev'])
  })

  it('takes the nearest earlier File before a farther one', () => {
    const round = pickRound([...earlier, here[0]!], new Map(), {}, now, 2, noRandom, undefined, scope)
    expect(ids(round)).toEqual(['e3', 'h1'])
  })

  it('keeps the skill-model ranking inside a tier', () => {
    const picks = (best: string) => pickRound(here, new Map(), {}, now, 1, () => 0.5, item => (item.id === best ? 1.5 : 0), scope)[0]!.id
    expect(picks('h1')).toBe('h1')
    expect(picks('h2')).toBe('h2')
  })

  it('still reviews a due sentence from an earlier File', () => {
    const old = earlier[1]!
    const states = new Map([[old.itemId, state(old, new Date('2026-10-30T00:00:00Z'))]])
    const round = pickRound([old, ...here], states, {}, now, 2, noRandom, undefined, scope)
    expect(ids(round)).toEqual(['e1', 'h1'])
  })

  it('never picks a new sentence from a later File or book', () => {
    const future = [from('f5', scope.book, 5), from('next', 'english-file-upper-intermediate-4e', 1)]
    const round = pickRound([...future, ...here], new Map(), {}, now, 10, noRandom, undefined, scope)
    expect(ids(round)).toEqual(['h1', 'h2'])
  })
})
