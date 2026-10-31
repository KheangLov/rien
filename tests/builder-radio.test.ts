import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { builderSchema, packSchema } from '#shared/schemas/pack'
import { builderCards, builderTiles, endMark, gradeBuilder, isCorrect } from '#shared/utils/builder'
import { checkGaps, gradeRadio, radioAnswers, radioCards, radioTokens } from '#shared/utils/radio'
import { Rating } from '#shared/utils/scheduler'

const now = new Date('2026-11-02T08:00:00Z')
const pack = packSchema.parse(JSON.parse(readFileSync(new URL('../public/packs/practice-games.json', import.meta.url), 'utf8')))

describe('Sentence Builder', () => {
  const item = builderSchema.parse({ id: 'x', text: 'Where do you live?', tip: 't' })

  it('lowercases the first word and fixes the end mark', () => {
    const words = builderTiles(item, () => 0.5).map(t => t.word).sort()
    expect(words).toEqual(['do', 'live', 'where', 'you'])
    expect(endMark(item.text)).toBe('?')
  })

  it('keeps "I" and names capitalised', () => {
    const own = builderSchema.parse({ id: 'y', text: 'I live in Phnom Penh.', tip: 't', keepFirstCapital: true })
    expect(builderTiles(own).map(t => t.word).sort()).toEqual(['I', 'Penh', 'Phnom', 'in', 'live'])
  })

  it('never starts in the correct order', () => {
    for (let i = 0; i < 50; i++) {
      expect(isCorrect(item, builderTiles(item).map(t => t.word))).toBe(false)
    }
  })

  it('accepts the sentence or a listed alternative, ignoring case', () => {
    const alt = builderSchema.parse({ id: 'z', text: 'I always drink coffee in the morning.', alternatives: ['In the morning I always drink coffee.'], tip: 't' })
    expect(isCorrect(alt, 'i always drink coffee in the morning'.split(' '))).toBe(true)
    expect(isCorrect(alt, 'in the morning I always drink coffee'.split(' '))).toBe(true)
    expect(isCorrect(alt, 'I drink always coffee in the morning'.split(' '))).toBe(false)
  })

  it('rejects an alternative that uses different words', () => {
    expect(builderSchema.safeParse({ id: 'w', text: 'Where do you live?', alternatives: ['Where you live?'], tip: 't' }).success).toBe(false)
  })

  it('grades by attempts and tags word-order slips', () => {
    const [card] = builderCards([pack])
    expect(card!.type).toBe('word-order')
    expect(gradeBuilder(card!, undefined, 1, true, '', now).mistake).toBeUndefined()
    expect(gradeBuilder(card!, undefined, 2, true, 'do where', now).row.fsrs.reps).toBe(1)
    expect(gradeBuilder(card!, undefined, 2, false, 'do where', now).mistake).toMatchObject({ type: 'word-order' })
  })

  it('has tiles for every shipped sentence that can be put back in order', () => {
    for (const card of builderCards([pack])) {
      const words = builderTiles(card).map(t => t.word)
      const sorted = card.text.replace(/[.?!]$/, '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'-]/gu, ''))
      expect(words.map(w => w.toLowerCase()).sort(), card.id).toEqual(sorted.map(w => w.toLowerCase()).sort())
    }
  })
})

describe('Gap Radio', () => {
  it('blanks every seventh word and keeps punctuation outside the gap', () => {
    const tokens = radioTokens('One two three four five six seven, eight nine ten eleven twelve thirteen fourteen.')
    expect(radioAnswers(tokens)).toEqual(['seven', 'fourteen'])
    expect(tokens[6]).toMatchObject({ word: 'seven', after: ',', gap: 0 })
  })

  it('moves a gap past a number', () => {
    expect(radioAnswers(radioTokens('a b c d e f 2020 g h'))).toEqual(['g'])
  })

  it('checks gaps with the same rules as Word Recall', () => {
    const verdicts = checkGaps(['walked', 'market'], ['walk', 'markt'])
    expect(verdicts.map(v => v.result)).toEqual(['wrong', 'almost'])
    expect(verdicts[0]!.mistake).toBe('final-sound')
  })

  it('grades by share right and logs each missed gap', () => {
    const [card] = radioCards([pack])
    const answers = radioAnswers(radioTokens(card!.text))
    expect(answers.length).toBeGreaterThanOrEqual(8)
    const allRight = gradeRadio(card!, undefined, checkGaps(answers, answers), now)
    expect(allRight.mistakes).toEqual([])
    expect(allRight.row.fsrs.reps).toBe(1)
    const typed = answers.map((a, i) => (i === 0 ? '' : a))
    const one = gradeRadio(card!, undefined, checkGaps(answers, typed), now)
    expect(one.right).toBe(answers.length - 1)
    expect(one.mistakes).toEqual([expect.objectContaining({ type: 'listening', detail: answers[0] })])
    expect(Rating.Good).toBe(3)
  })
})
