import { describe, expect, it } from 'vitest'
import { blankExample, checkAnswer, droppedEnding, editDistance, normalizeAnswer } from '#shared/utils/answer'

describe('normalizeAnswer', () => {
  it('ignores case, punctuation, extra spaces and curly apostrophes', () => {
    expect(normalizeAnswer('  Don’t   Worry! ')).toBe('don\'t worry')
  })
})

describe('checkAnswer', () => {
  it('accepts an exact answer', () => {
    expect(checkAnswer('Walked', 'walked')).toEqual({ result: 'correct' })
  })

  it.each([
    ['want', 'wants', 's'],
    ['walk', 'walked', 'ed'],
    ['study', 'studied', 'ied'],
    ['study', 'studies', 'ies'],
    ['watch', 'watches', 'es'],
    ['like', 'likes', 's'],
    ['love', 'loved', 'd'],
  ])('treats "%s" for "%s" as a dropped ending, never a typo', (typed, expected, ending) => {
    expect(droppedEnding(typed, expected)).toBe(ending)
    expect(checkAnswer(typed, expected)).toMatchObject({ result: 'wrong', mistake: 'final-sound' })
  })

  it('counts a small spelling slip as almost right', () => {
    expect(checkAnswer('recieve', 'receive').result).toBe('almost')
    expect(checkAnswer('comfortible', 'comfortable').result).toBe('almost')
  })

  it('is strict with short words', () => {
    expect(checkAnswer('bad', 'bag').result).toBe('wrong')
  })

  it('marks an empty or unrelated answer wrong', () => {
    expect(checkAnswer('', 'house').result).toBe('wrong')
    expect(checkAnswer('car', 'house').result).toBe('wrong')
  })
})

describe('blankExample', () => {
  it('hides the word and its endings', () => {
    expect(blankExample('She walked to school.', 'walk')).toBe('She _____ to school.')
    expect(blankExample('He studied all night.', 'study')).toBe('He _____ all night.')
    expect(blankExample('Look after your sister.', 'look after')).toBe('_____ your sister.')
  })

  it('returns undefined when the word is not in the sentence', () => {
    expect(blankExample('She went home.', 'go')).toBeUndefined()
  })

  it('does not blank a match inside another word', () => {
    expect(blankExample('The cat sat on a mat.', 'at')).toBeUndefined()
  })
})

describe('editDistance', () => {
  it('counts a swap of neighbouring letters as one edit', () => {
    expect(editDistance('recieve', 'receive')).toBe(1)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
})
