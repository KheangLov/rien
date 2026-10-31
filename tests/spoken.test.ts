import { describe, expect, it } from 'vitest'
import { compareSpoken } from '#shared/utils/spoken'

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
