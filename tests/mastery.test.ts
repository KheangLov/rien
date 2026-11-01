import { default_w, forgetting_curve } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { ReviewRow } from '#shared/schemas/db'
import { fitFsrs, firstReviewPairs, MIN_PAIRS } from '#shared/utils/fsrsFit'
import { buildModel, emptyModel, learn, predict, skillReport, suitability, workingLevel, type Evidence } from '#shared/utils/mastery'
import { expectedWordMs, gradeFor, msPerLetter, Rating } from '#shared/utils/scheduler'
import { levelFor, LEVEL_DIFFICULTY, mistakeTypeOf, skillLabel, skillOf } from '#shared/utils/skills'

const DAY = 86_400_000
const start = new Date('2026-11-01T02:00:00Z')

// A seeded random number generator, so simulations give the same result each run.
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('skills and levels', () => {
  it('places each File of each book on the CEFR scale', () => {
    expect(levelFor('english-file-pre-intermediate-4e', 1)).toBe('A2')
    expect(levelFor('english-file-pre-intermediate-4e', 9)).toBe('B1')
    expect(levelFor('english-file-intermediate-4e', 12)).toBe('B1+')
    expect(levelFor('english-file-upper-intermediate-4e', 10)).toBe('B2+')
    expect(levelFor(undefined, undefined, 'A2+')).toBe('A2+')
  })

  it('names the skill of old items from their mistake type and timeline', () => {
    expect(skillOf({ type: 'tense', when: 'past-to-now' })).toBe('present-perfect')
    expect(skillOf({ type: 'article' })).toBe('articles')
    expect(skillOf({ type: 'tense', when: 'imagined', skill: 'conditionals' })).toBe('conditionals')
    expect(skillLabel('present-perfect')).toBe('Present perfect')
    expect(skillLabel('sound:th')).toBe('Hearing th')
    expect(mistakeTypeOf('past-simple')).toBe('tense')
    expect(mistakeTypeOf('relative-clauses')).toBe('other')
    expect(mistakeTypeOf('articles')).toBe('article')
  })
})

describe('skill model', () => {
  const item = (itemId: string, skill: string, level: Evidence['level'] = 'B1') => ({ itemId, skill, level })

  it('starts with items at her level coming out right about 3 times in 4', () => {
    const p = predict(emptyModel('B1'), item('x', 'past-simple'), start)
    expect(p).toBeGreaterThan(0.7)
    expect(p).toBeLessThan(0.8)
  })

  it('finds her weak skill from right and wrong answers', () => {
    const evidence: Evidence[] = []
    for (let i = 0; i < 20; i++) {
      const at = new Date(start.getTime() + i * 60_000)
      evidence.push({ ...item(`pp${i}`, 'present-perfect'), score: i % 4 === 0 ? 1 : 0, at })
      evidence.push({ ...item(`ps${i}`, 'past-simple'), score: 1, at })
    }
    const report = skillReport(buildModel(evidence, 'B1'), 'B1', new Date(start.getTime() + DAY))
    expect(report.map(r => r.skill)).toEqual(['present-perfect', 'past-simple'])
    expect(report[0]!.p).toBeLessThan(0.5)
    expect(report[1]!.p).toBeGreaterThan(0.85)
  })

  it('lets a skill fade halfway back to her overall level in a month', () => {
    const model = emptyModel('B1')
    for (let i = 0; i < 10; i++) learn(model, { ...item(`a${i}`, 'articles'), score: 0, at: start })
    const offset = (days: number) => {
      const at = new Date(start.getTime() + days * DAY)
      return Math.log(predict(model, item('new', 'articles'), at) / (1 - predict(model, item('new', 'articles'), at)))
        - (model.ability - LEVEL_DIFFICULTY.B1)
    }
    expect(offset(30) / offset(0)).toBeCloseTo(0.5, 2)
  })

  it('keeps an item\'s difficulty within reach of its level', () => {
    const model = emptyModel('B1')
    for (let i = 0; i < 200; i++) learn(model, { ...item('hard', 'passive'), score: 0, at: new Date(start.getTime() + i * 1000) })
    const difficulty = model.items.get('hard')!.difficulty
    expect(difficulty).toBeLessThanOrEqual(LEVEL_DIFFICULTY.B1 + 1.5 + 1e-9)
  })

  it('prefers items she should get right about 80% of the time', () => {
    const model = emptyModel('B1')
    const easy = suitability(model, item('e', 'past-simple', 'A1'), start)
    const right = suitability(model, item('r', 'past-simple', 'B1+'), start)
    const hard = suitability(model, item('h', 'past-simple', 'C1'), start)
    expect(right).toBeGreaterThan(easy)
    expect(right).toBeGreaterThan(hard)
  })

  it('recovers a simulated learner\'s strengths and predicts her answers', () => {
    // A learner with true strengths per skill answers 600 items of true
    // difficulties; the model only sees her answers.
    const random = seeded(7)
    const truth: Record<string, number> = { 'past-simple': 1.5, 'present-perfect': -0.8, 'articles': 0.2, 'conditionals': -1.5 }
    const levels = ['A2', 'A2+', 'B1', 'B1+', 'B2'] as const
    const skills = Object.keys(truth)
    const items = Array.from({ length: 120 }, (_, i) => {
      const level = levels[i % levels.length]!
      return { itemId: `i${i}`, skill: skills[i % skills.length]!, level, trueDifficulty: LEVEL_DIFFICULTY[level] + (random() - 0.5) }
    })
    const model = emptyModel('B1')
    let hits = 0
    let scored = 0
    for (let i = 0; i < 600; i++) {
      const it = items[Math.floor(random() * items.length)]!
      const pTrue = 1 / (1 + Math.exp(-(truth[it.skill]! - it.trueDifficulty)))
      const score = random() < pTrue ? 1 : 0
      const at = new Date(start.getTime() + i * 3_600_000)
      const p = learn(model, { itemId: it.itemId, skill: it.skill, level: it.level, score, at })
      if (i >= 300) {
        scored++
        if ((p >= 0.5) === (score === 1)) hits++
      }
    }
    // Weakest to strongest, as in the truth.
    const report = skillReport(model, 'B1', new Date(start.getTime() + 600 * 3_600_000))
    expect(report.map(r => r.skill)).toEqual(['conditionals', 'present-perfect', 'articles', 'past-simple'])
    // Better than always guessing "right" on the second half.
    expect(hits / scored).toBeGreaterThan(0.68)
  })

  it('names the level she is working at', () => {
    const model = emptyModel('A2')
    for (let i = 0; i < 80; i++) learn(model, { itemId: `b${i}`, skill: 'past-simple', level: 'B1+', score: 1, at: new Date(start.getTime() + i * 60_000) })
    expect(['B1+', 'B2', 'B2+']).toContain(workingLevel(model))
  })
})

describe('speed in grading', () => {
  it('counts a fast right answer as Easy and a slow one as still Good', () => {
    expect(gradeFor({ result: 'correct' }, 1000, 4000)).toBe(Rating.Easy)
    expect(gradeFor({ result: 'correct' }, 9000, 4000)).toBe(Rating.Good)
    expect(gradeFor({ result: 'correct' })).toBe(Rating.Good)
    expect(gradeFor({ result: 'almost' }, 100, 4000)).toBe(Rating.Hard)
    expect(gradeFor({ result: 'wrong' }, 100, 4000)).toBe(Rating.Again)
  })

  it('learns her pace per letter from her right answers', () => {
    const reviews = Array.from({ length: 11 }, (_, i) => ({ correct: true, rating: 3, typed: 'borrow', ms: 5000 + i * 100 }))
    expect(msPerLetter(reviews)).toBeCloseTo(5500 / 10, 0)
    expect(msPerLetter(reviews.slice(0, 3))).toBe(900)
    expect(expectedWordMs('cat', 500)).toBe(3500)
  })
})

describe('FSRS fitted to her memory', () => {
  const review = (cardId: string, at: Date, rating: number): ReviewRow =>
    ({ cardId, at, rating, correct: rating > 1, typed: 'x', ms: 1000 })

  it('pairs each word\'s first answer with its first review on a later day', () => {
    const pairs = firstReviewPairs([
      review('a', new Date('2026-11-01T02:00:00Z'), 3),
      review('a', new Date('2026-11-01T02:10:00Z'), 3),
      review('a', new Date('2026-11-04T02:00:00Z'), 1),
    ], 0)
    expect(pairs).toEqual([{ rating: 3, days: 3, recalled: false }])
  })

  it('keeps the defaults until there is enough of her data', () => {
    const few = Array.from({ length: MIN_PAIRS - 1 }, (_, i) => [
      review(`c${i}`, start, 3), review(`c${i}`, new Date(start.getTime() + 2 * DAY), 3)]).flat()
    expect(fitFsrs(few, 0)).toBeNull()
  })

  it('finds how long a new word lasts for a simulated learner', () => {
    // Her true memory after a first "Good": 10 days (FSRS's default is ~2.3).
    const random = seeded(3)
    const reviews: ReviewRow[] = []
    for (let i = 0; i < 400; i++) {
      const days = 1 + Math.floor(random() * 20)
      const recalled = random() < forgetting_curve([...default_w], days, 10)
      reviews.push(review(`w${i}`, start, 3), review(`w${i}`, new Date(start.getTime() + days * DAY), recalled ? 3 : 1))
    }
    const fit = fitFsrs(reviews, 0)!
    const good = fit.stabilities.find(s => s.rating === 3)!
    expect(good.pairs).toBe(400)
    expect(good.stability).toBeGreaterThan(7)
    expect(good.stability).toBeLessThan(13)
    // Only the first four parameters change, and a better rating never lasts less.
    expect(fit.params.slice(4)).toEqual([...default_w].slice(4))
    expect(fit.params[3]).toBeGreaterThanOrEqual(fit.params[2]!)
    expect(fit.params[0]).toBe(default_w[0])
  })
})
