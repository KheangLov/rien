import { describe, expect, it } from 'vitest'
import type { FixItCard } from '#shared/utils/fixit'
import { listenQuestions, pictureQuestions, similarWords, soundsSame, speedQuestions, WORD_BANK } from '#shared/utils/quick'

describe('word bank', () => {
  it('has one picture and one spelling per word, and groups big enough for three wrong choices', () => {
    expect(new Set(WORD_BANK.map(w => w.word)).size).toBe(WORD_BANK.length)
    expect(new Set(WORD_BANK.map(w => w.emoji)).size).toBe(WORD_BANK.length)
    const groups = Object.groupBy(WORD_BANK, w => w.group)
    for (const [group, words] of Object.entries(groups)) expect(words!.length, group).toBeGreaterThanOrEqual(4)
  })
})

describe('similarWords', () => {
  it('prefers words that look like the answer and never repeats it', () => {
    const wrong = similarWords('ship', ['chip', 'shop', 'elephant', 'Ship', 'sheep', 'computer'], 3, () => 0)
    expect(wrong).toEqual(expect.arrayContaining(['shop', 'sheep', 'chip']))
    expect(wrong).not.toContain('Ship')
  })
})

describe('listenQuestions', () => {
  it('uses her words first, fills from the bank, and always has four different options', () => {
    const round = listenQuestions(['borrow', 'library', 'expensive'], 8)
    expect(round).toHaveLength(8)
    expect(round.filter(q => ['borrow', 'library', 'expensive'].includes(q.answer))).toHaveLength(3)
    for (const q of round) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
    }
  })
})

describe('Listen & Pick fairness', () => {
  it('never offers a word that sounds the same as the answer', () => {
    expect(soundsSame('Right', 'write')).toBe(true)
    expect(soundsSame('right', 'night')).toBe(false)
    for (let i = 0; i < 20; i++) {
      for (const q of listenQuestions(['right', 'write', 'meet', 'meat', 'night'], 5)) {
        expect(q.options.filter(o => soundsSame(o, q.answer))).toEqual([q.answer])
      }
    }
  })
})

describe('pictureQuestions', () => {
  it('mixes her photos with bank pictures whose wrong choices share the group', () => {
    const round = pictureQuestions([{ answer: 'motorbike taxi', image: 'data:image/png;base64,x' }], ['motorbike taxi'], 8)
    expect(round).toHaveLength(8)
    expect(round.filter(q => q.image)).toHaveLength(1)
    for (const q of round.filter(q => q.emoji)) {
      const group = WORD_BANK.find(w => w.word === q.answer)!.group
      expect(q.options.every(o => WORD_BANK.find(w => w.word === o)!.group === group)).toBe(true)
    }
    for (const q of round) expect(new Set(q.options).size).toBe(4)
  })

  it('never offers a word that would also fit the picture (taxi and car)', () => {
    for (let i = 0; i < 40; i++) {
      for (const q of pictureQuestions([], [], 8)) {
        if (q.answer === 'taxi') expect(q.options).not.toContain('car')
        if (q.answer === 'rain') expect(q.options).not.toContain('cloud')
      }
    }
  })
})

describe('speedQuestions', () => {
  const card = (id: string): FixItCard => ({ id, itemId: `p:${id}`, text: 'She go home.', wrong: 'go', fix: 'goes', distractors: ['going'], type: 'third-person-s', explain: 'She goes.' })

  it('shows each sentence with its mistake or corrected, and knows which', () => {
    const qs = speedQuestions([card('a'), card('b'), card('c'), card('d')])
    for (const q of qs) {
      expect(q.sentence).toBe(q.correct ? 'She goes home.' : 'She go home.')
      expect(q.fixed).toBe('She goes home.')
    }
  })
})
