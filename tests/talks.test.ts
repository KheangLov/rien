import { describe, expect, it } from 'vitest'
import { talkSchema } from '#shared/schemas/pack'
import { orderTalks, talkCards, type TalkCard } from '#shared/utils/talks'

const noRandom = () => 0
const talk = (id: string, focus: TalkCard['focus'] = 'tense'): TalkCard =>
  ({ id, talkId: `couple:${id}`, topic: id, focus, tip: 't', questions: ['a', 'b', 'c'] })

describe('talkSchema', () => {
  it('needs exactly three questions', () => {
    const base = { id: 'x', topic: 'X', focus: 'tense', tip: 't' }
    expect(talkSchema.safeParse({ ...base, questions: ['a', 'b', 'c'] }).success).toBe(true)
    expect(talkSchema.safeParse({ ...base, questions: ['a', 'b'] }).success).toBe(false)
  })
})

describe('talkCards', () => {
  it('prefixes ids with the pack id', () => {
    const cards = talkCards([{ id: 'couple', title: '', fixIt: [], soundPairs: [], talks: [{ id: 'us', topic: 'Us', focus: 'tense', tip: 't', questions: ['a', 'b', 'c'] }] }])
    expect(cards[0]!.talkId).toBe('couple:us')
  })
})

describe('orderTalks', () => {
  it('offers new topics first, starting with her weakest mistake type', () => {
    const talks = [talk('a', 'tense'), talk('b', 'article'), talk('c', 'preposition')]
    const order = orderTalks(talks, [], { article: 4, preposition: 1 }, noRandom)
    expect(order.map(t => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('then repeats the topic done longest ago', () => {
    const talks = [talk('a'), talk('b'), talk('c')]
    const history = [
      { talkId: 'couple:a', at: new Date('2026-11-10') },
      { talkId: 'couple:b', at: new Date('2026-11-03') },
      { talkId: 'couple:a', at: new Date('2026-10-01') },
    ]
    expect(orderTalks(talks, history, {}, noRandom).map(t => t.id)).toEqual(['c', 'b', 'a'])
  })
})
