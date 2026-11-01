import { describe, expect, it } from 'vitest'
import type { GrammarRow } from '#shared/schemas/db'
import type { Pack } from '#shared/schemas/pack'
import { newItems, nextLevel } from '#shared/utils/freshness'
import type { FixItCard } from '#shared/utils/fixit'
import { topUpRound } from '#shared/utils/rounds'

const book = 'english-file-pre-intermediate-4e' as const
const item = (id: string) => ({ id, text: 'She go home.', wrong: 'go', fix: 'goes', distractors: ['going'], type: 'third-person-s' as const, explain: 'x' })
const pack = (id: string, ids: string[], file?: number): Pack =>
  ({ id, title: id, fixIt: ids.map(item), soundPairs: [], talks: [], builder: [], radio: [], ...(file ? { book, file } : {}) }) as Pack

describe('freshness', () => {
  const packs = [pack('core', ['a', 'b']), pack('f9', ['c'], 9), pack('f10', ['d', 'e'], 10), pack('f12', ['f'], 12)]

  it('counts what she has not met at her level', () => {
    expect(newItems(packs, { book, file: 9 }, new Set(['core:a']), ['fixIt'])).toBe(2)
  })

  it('finds the next File that brings new items', () => {
    expect(nextLevel(packs, { book, file: 9 }, new Set(), ['fixIt'])).toEqual({ file: 10, count: 2 })
    expect(nextLevel(packs, { book, file: 9 }, new Set(['f10:d', 'f10:e']), ['fixIt'])).toEqual({ file: 12, count: 1 })
    expect(nextLevel(packs, { book, file: 12 }, new Set(), ['fixIt'])).toBeUndefined()
  })
})

describe('topUpRound', () => {
  const card = (id: string): FixItCard => ({ ...item(id), itemId: `p:${id}` })
  const seen = (c: FixItCard, daysAgo: number): [string, GrammarRow] =>
    [c.itemId, { itemId: c.itemId, type: c.type, due: new Date(2030, 0, 1), fsrs: { last_review: new Date(2026, 10, 20 - daysAgo) } } as unknown as GrammarRow]

  it('fills a short round from items met longest ago, never one met just now, never twice', () => {
    const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map(card)
    const states = new Map([seen(a!, 1), seen(b!, 30), seen(c!, 20), seen(e!, 40), seen(f!, 50)])
    for (let i = 0; i < 20; i++) {
      const round = topUpRound([d!], [a!, b!, c!, d!, e!, f!], states, 3)
      expect(round).toHaveLength(3)
      expect(new Set(round).size).toBe(3)
      expect(round).toContain(d)
      expect(round).not.toContain(a)
    }
  })

  it('leaves a full round alone', () => {
    const [a, b] = ['a', 'b'].map(card)
    expect(topUpRound([a!, b!], [a!, b!], new Map(), 2)).toEqual([a, b])
  })
})
