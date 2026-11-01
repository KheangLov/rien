import { describe, expect, it } from 'vitest'
import type { MistakeRow } from '#shared/schemas/db'
import type { FixItCard } from '#shared/utils/fixit'
import { describeSlip, slipRound, slipSummary, type SlipLookup } from '#shared/utils/slips'

const fix = (id: string, type: FixItCard['type'] = 'third-person-s'): FixItCard =>
  ({ id, itemId: `core:${id}`, text: 'She go home.', wrong: 'go', fix: 'goes', distractors: ['going'], type, explain: 'She goes.' })
const slip = (itemId: string, type: MistakeRow['type'], daysAgo = 0, detail = ''): MistakeRow =>
  ({ itemId, type, at: new Date(2026, 10, 20 - daysAgo), detail })
const lookup = (over: Partial<SlipLookup> = {}): SlipLookup => ({
  fix: new Map(), builder: new Map(), sound: new Map(), radio: new Map(), words: new Map(), talks: new Map(), ...over,
})

describe('describeSlip', () => {
  it('shows a Fix It slip as the wrong sentence and the right one', () => {
    const card = fix('a')
    expect(describeSlip(slip(card.itemId, 'third-person-s'), lookup({ fix: new Map([[card.itemId, card]]) })))
      .toMatchObject({ source: 'Fix It', said: 'She go home.', right: 'She goes home.' })
  })

  it('shows a word slip as what she typed and the word', () => {
    expect(describeSlip(slip('card-1', 'final-sound', 0, 'walk'), lookup({ words: new Map([['card-1', { answer: 'walked' }]]) })))
      .toMatchObject({ source: 'Word Recall', said: 'walk', right: 'walked' })
  })

  it('keeps a partner\'s Couple Talk note', () => {
    expect(describeSlip(slip('couple-talk:us', 'tense', 0, 'Couple Talk: We met, not we meet'), lookup({ talks: new Map([['couple-talk:us', 'Our story']]) })))
      .toMatchObject({ source: 'Couple Talk', note: 'We met, not we meet' })
  })
})

describe('slipSummary', () => {
  it('counts slips by kind, most frequent first', () => {
    expect(slipSummary([slip('x', 'article'), slip('y', 'tense'), slip('z', 'tense')])).toEqual([
      { type: 'tense', count: 2 }, { type: 'article', count: 1 },
    ])
  })
})

describe('slipRound', () => {
  it('puts the very sentences she missed in, then more of her weakest kinds', () => {
    const cards = [fix('a', 'tense'), fix('b', 'tense'), fix('c', 'article'), fix('d', 'third-person-s')]
    const round = slipRound(cards, [slip('core:c', 'article', 1), slip('x', 'tense', 2), slip('y', 'tense', 3)], 3)
    expect(round.map(c => c.id).sort()).toEqual(['a', 'b', 'c'])
  })
})
