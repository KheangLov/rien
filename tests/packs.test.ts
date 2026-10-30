import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fixItItemSchema, packIndexSchema, packSchema } from '#shared/schemas/pack'
import { correctedText } from '#shared/utils/fixit'

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/packs/${name}`, import.meta.url), 'utf8'))
const index = packIndexSchema.parse(read('index.json'))

// Every pack the app ships must load, so a typo fails here instead of on her phone.
describe.each(index.packs)('content pack %s', (name) => {
  const pack = packSchema.parse(read(name))

  it('has a file name that matches its id', () => {
    expect(name).toBe(`${pack.id}.json`)
  })

  it('produces a changed, well-formed sentence for every item', () => {
    for (const item of pack.fixIt) {
      const fixed = correctedText(item)
      expect(fixed, item.id).not.toBe(item.text)
      expect(fixed, item.id).not.toMatch(/\s{2}/)
    }
  })
})

describe('fixItItemSchema', () => {
  const base = { id: 'x', text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type: 'tense', explain: 'Past.' }

  it('accepts a valid item', () => {
    expect(fixItItemSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a wrong word that is not in the sentence, or appears twice', () => {
    expect(fixItItemSchema.safeParse({ ...base, wrong: 'went' }).success).toBe(false)
    expect(fixItItemSchema.safeParse({ ...base, text: 'She go go home.' }).success).toBe(false)
  })

  it('rejects a distractor that repeats the fix or the mistake', () => {
    expect(fixItItemSchema.safeParse({ ...base, distractors: ['went'] }).success).toBe(false)
    expect(fixItItemSchema.safeParse({ ...base, distractors: ['go'] }).success).toBe(false)
  })
})

describe('packSchema', () => {
  it('rejects duplicate item ids', () => {
    const item = { id: 'a', text: 'She go home.', wrong: 'go', fix: 'went', distractors: ['goes'], type: 'tense', explain: 'Past.' }
    expect(packSchema.safeParse({ id: 'p', title: 'P', fixIt: [item, item] }).success).toBe(false)
  })
})
