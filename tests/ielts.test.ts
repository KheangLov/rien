import { describe, expect, it } from 'vitest'
import { bandFor, countWords, formAnswerRight, linkingWordsIn, speakingFeedback, writingFeedback } from '#shared/utils/ielts'

describe('IELTS band estimate', () => {
  it('follows IELTS\'s CEFR alignment (B1 4.0–5.0, B2 5.5–6.5, C1 7.0+)', () => {
    expect(bandFor('B1')).toBe('4.5–5.0')
    expect(bandFor('B2')).toBe('5.5–6.0')
    expect(bandFor('C1')).toBe('7.0 or higher')
  })
})

describe('speaking feedback', () => {
  it('counts words, pace, fillers and linking words', () => {
    const said = 'Um I live in Phnom Penh because my work is there, and er it is busy but I love it. For example, the food is great.'
    const f = speakingFeedback(said, 12, 1)
    expect(f.words).toBe(26)
    expect(f.wordsPerMinute).toBe(130)
    expect(f.fillers).toBe(2)
    expect(f.linking).toEqual(expect.arrayContaining(['because', 'but', 'for example']))
    expect(f.linking).not.toContain('example')
  })

  it('asks for a longer Part 2 talk and linking words when they are missing', () => {
    const f = speakingFeedback('I like Kampot. It is nice. The river is nice.', 20, 2)
    expect(f.tips[0]).toMatch(/two minutes/)
    expect(f.tips.join(' ')).toMatch(/linking words/)
  })
})

describe('writing feedback', () => {
  const essay = `Some people think that cities should build more parks. In my opinion, this is a good idea.

Firstly, parks give people a place to relax. However, they cost money. For example, a park needs gardeners.

In addition, parks are good for the environment because trees clean the air. As a result, people are healthier.

In conclusion, I believe that the benefits are greater than the costs.`

  it('checks length, paragraphs, opinion, linking words and conclusion', () => {
    const f = writingFeedback(essay, 2, ['environment', 'benefit', 'cost'])
    expect(f.paragraphs).toBe(4)
    expect(f.checks.find(c => c.label.startsWith('At least'))!.ok).toBe(false)
    expect(f.checks.find(c => c.label === 'Your opinion is clear')!.ok).toBe(true)
    expect(f.checks.find(c => c.label === 'A conclusion')!.ok).toBe(true)
    expect(f.checks.find(c => c.label.startsWith('Five or more'))!.ok).toBe(true)
    expect(f.academic).toEqual(expect.arrayContaining(['environment', 'benefits']))
  })

  it('flags contractions and over-used words', () => {
    const f = writingFeedback('Parks don\'t cost much. Parks are nice. Parks help. Parks matter. It\'s true.', 2, [])
    expect(f.contractions).toBe(1)
    expect(f.repeated).toEqual(['parks'])
  })

  it('counts words the way IELTS does', () => {
    expect(countWords('It isn\'t a well-known fact.')).toBe(6)
    expect(linkingWordsIn('On the other hand, however')).toEqual(['on the other hand', 'however'])
  })
})

describe('listening form answers', () => {
  it('needs the spelling right, but not capitals, spaces or number words', () => {
    expect(formAnswerRight('sreymom', 'Sreymom')).toBe(true)
    expect(formAnswerRight('sreymon', 'Sreymom')).toBe(false)
    expect(formAnswerRight('the 12th of March', '12 March')).toBe(true)
    expect(formAnswerRight('two', '2')).toBe(true)
    expect(formAnswerRight('012 345 678', '012345678')).toBe(true)
    expect(formAnswerRight('', 'x')).toBe(false)
  })
})

describe('the IELTS pack', () => {
  it('accepts every listening form answer and its other spellings', async () => {
    const { readFileSync } = await import('node:fs')
    const pack = JSON.parse(readFileSync(new URL('../public/packs/ielts.json', import.meta.url), 'utf8'))
    for (const call of pack.ieltsListening) {
      for (const field of call.form) {
        for (const answer of [field.answer, ...field.accept]) {
          expect(formAnswerRight(answer, field.answer, field.accept), `${call.id}:${field.id}:${answer}`).toBe(true)
        }
      }
    }
  })
})
