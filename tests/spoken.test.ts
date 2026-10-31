import { describe, expect, it } from 'vitest'
import { compareBest, compareSpoken } from '#shared/utils/spoken'

const statuses = (expected: string, heard: string) =>
  compareSpoken(expected, heard).map(w => `${w.word}:${w.status}`).join(' ')

describe('compareSpoken', () => {
  it('marks every word heard when the transcript matches, ignoring case and punctuation', () => {
    expect(statuses('She walked to school.', 'she walked to school')).toBe('She:ok walked:ok to:ok school.:ok')
  })

  it('flags a dropped ending and names it', () => {
    const result = compareSpoken('He wants two apples.', 'he want two apple')
    expect(result.map(w => w.status)).toEqual(['ok', 'ending', 'ok', 'ending'])
    expect(result[1]).toMatchObject({ heard: 'want', ending: 's' })
    expect(result[3]).toMatchObject({ heard: 'apple', ending: 's' })
  })

  it('flags words not heard at all, including a swapped word', () => {
    expect(statuses('I saw a big dog', 'I saw big log')).toBe('I:ok saw:ok a:missing big:ok dog:missing')
    expect(compareSpoken('I saw a big dog', 'I saw big log')[4]!.heard).toBe('log')
  })

  it('ignores extra words the recognizer added', () => {
    expect(statuses('She cooked dinner', 'um she cooked the dinner')).toBe('She:ok cooked:ok dinner:ok')
  })

  it('marks everything missing when nothing was heard', () => {
    expect(statuses('Thank you', '')).toBe('Thank:missing you:missing')
  })
})

describe('judging by sound, not spelling', () => {
  it('accepts digits, homophones and an apostrophe that sounds the same', () => {
    expect(statuses('She wants two apples.', 'She wants 2 apples')).toBe('She:ok wants:ok two:ok apples.:ok')
    expect(statuses('She wants two apples.', 'she wants to apple\'s')).toBe('She:ok wants:ok two:ok apples.:ok')
    expect(statuses('Can I borrow your pen?', 'can I borrow you\'re pen')).toBe('Can:ok I:ok borrow:ok your:ok pen?:ok')
  })

  it('still catches a really dropped ending', () => {
    const result = compareSpoken('She wants two apples.', 'she want two apple')
    expect(result.map(w => w.status)).toEqual(['ok', 'ending', 'ok', 'ending'])
  })
})

describe('when the recognizer is unsure', () => {
  const heard = (text: string, confidence?: number, alternatives?: string[]) => ({ text, confidence, alternatives })

  it('reports unclear instead of a dropped ending when confidence is low', () => {
    const result = compareSpoken('We walked home', [heard('we', 0.9), heard('walk', 0.3), heard('home', 0.9)])
    expect(result[1]).toMatchObject({ status: 'unclear', heard: 'walk' })
  })

  it('reports unclear when one of its alternatives had the ending', () => {
    const result = compareSpoken('We walked home', [heard('we', 0.9), heard('walk', 0.8, ['walked', 'woke']), heard('home', 0.9)])
    expect(result[1]!.status).toBe('unclear')
  })

  it('keeps a confident dropped ending', () => {
    const result = compareSpoken('We walked home', [heard('we', 0.9), heard('walk', 0.9, ['woke']), heard('home', 0.9)])
    expect(result[1]).toMatchObject({ status: 'ending', ending: 'ed' })
  })

  it('treats confidence 0 as unknown (interim results), not as unsure', () => {
    expect(compareSpoken('We walked home', [heard('we', 0), heard('walk', 0), heard('home', 0)])[1]!.status).toBe('ending')
  })
})

describe('compareBest', () => {
  const best = [{ text: 'she' }, { text: 'want' }, { text: 'two' }, { text: 'apples' }]

  it('uses the whole-sentence alternative that matches best', () => {
    expect(compareBest('She wants two apples.', [{ text: 'she' }, { text: 'once' }, { text: 'two' }, { text: 'apples' }], ['she wants two apples'])
      .every(w => w.status === 'ok')).toBe(true)
  })

  it('downgrades an ending to unclear if another reading heard it', () => {
    const result = compareBest('She wants two apples.', best, ['she wants two apples', 'she want two apples'])
    expect(result.every(w => w.status === 'ok')).toBe(true)
    const split = compareBest('She wants two apples.', best, ['she want two apples', 'she wants to'])
    expect(split[1]!.status).toBe('unclear')
  })
})
