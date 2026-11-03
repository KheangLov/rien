import { default_w, forgetting_curve } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import type { ReviewRow } from '#shared/schemas/db'
import { fitFsrs, firstReviewPairs, MIN_PAIRS } from '#shared/utils/fsrsFit'
import { buildModel, DEFAULT_PARAMS, emptyModel, evaluate, learn, predict, skillReport, suitability, tune, TUNE_MIN_ANSWERS, workingLevel, type Evidence } from '#shared/utils/mastery'
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

describe('guessing, self-check and tuning', () => {
  const random = seeded(11)
  const day = (k: number) => new Date(start.getTime() + k * 4 * 3_600_000)

  it('does not mistake lucky guesses for knowledge', () => {
    // She truly knows these words 20% of the time; with four choices she gets
    // 40% right. Told it is a four-choice game, the model sees through the luck.
    const answers = (kind?: 'picture') => Array.from({ length: 200 }, (_, k) => {
      const knows = random() < 0.2
      const right = knows || random() < 0.25
      return { itemId: `p${k % 40}`, skill: 'vocabulary', level: 'B1' as const, score: right ? 1 : 0, at: day(k), kind }
    })
    const withGuess = skillReport(buildModel(answers('picture'), 'B1'), 'B1', day(200))[0]!.p
    const without = skillReport(buildModel(answers(), 'B1'), 'B1', day(200))[0]!.p
    expect(withGuess).toBeLessThan(without)
    expect(withGuess).toBeLessThan(0.35)
  })

  // A learner with true strengths answers 600 Fix It and picture items.
  function simulate(n: number, seed: number, flipAt = Number.POSITIVE_INFINITY) {
    const r = seeded(seed)
    const skills = ['past-simple', 'present-perfect', 'articles', 'conditionals']
    const truth: Record<string, number> = { 'past-simple': 1.2, 'present-perfect': -0.8, 'articles': 0.3, 'conditionals': -1.4 }
    const items = Array.from({ length: 120 }, (_, i) => ({ itemId: `i${i}`, skill: skills[i % 4]!, level: (['A2', 'B1', 'B1+'] as const)[i % 3]!, d: (r() - 0.5) }))
    return Array.from({ length: n }, (_, k) => {
      // Her two weakest skills become her strongest halfway (she studied them).
      const t = k < flipAt ? truth : { ...truth, 'present-perfect': 1.5, 'conditionals': 1.2 }
      const it = items[Math.floor(r() * items.length)]!
      const kind = k % 3 === 0 ? 'picture' as const : 'fix-it' as const
      const knows = 1 / (1 + Math.exp(-(t[it.skill]! + 0.6 - LEVEL_DIFFICULTY[it.level] - it.d)))
      const c = kind === 'picture' ? 0.25 : 0.15
      return { itemId: it.itemId, skill: it.skill, level: it.level, kind, at: day(k), score: r() < c + (1 - c) * knows ? 1 : 0 }
    })
  }

  it('checks itself on answers it has not seen, and its chances hold up', () => {
    const { check } = evaluate(simulate(600, 5), 'B1')
    expect(check.n).toBe(590)
    expect(check.logLoss).toBeLessThan(check.baselineLogLoss)
    expect(check.accuracy).toBeGreaterThan(0.7)
    // "Expected X% right" matches what happened in every band, within sampling
    // noise (3 standard errors for the band's size).
    for (const bin of check.bins.filter(b => b.n >= 30)) {
      const noise = 3 * Math.sqrt(bin.said * (1 - bin.said) / bin.n)
      expect(Math.abs(bin.said - bin.was), `${bin.from}-${bin.to}`).toBeLessThan(noise)
    }
  })

  it('keeps its starting settings until there are enough of her answers', () => {
    expect(tune(simulate(TUNE_MIN_ANSWERS - 1, 6), 'B1').tuned).toBe(false)
  })

  it('fits its speeds to a learner who changes fast, and predicts her better', () => {
    const answers = simulate(900, 8, 450)
    const fitted = tune(answers, 'B1')
    const standard = evaluate(answers, 'B1', DEFAULT_PARAMS).check
    expect(fitted.check.logLoss).toBeLessThanOrEqual(standard.logLoss)
    if (fitted.tuned) expect(fitted.params).not.toEqual(DEFAULT_PARAMS)
    // And it now knows her old weak skills are strong.
    const report = skillReport(fitted.model, 'B1', day(900))
    expect(report.at(-1)!.skill === 'present-perfect' || report.at(-1)!.skill === 'conditionals' || report.at(-2)!.skill === 'conditionals' || report.at(-2)!.skill === 'present-perfect').toBe(true)
  })
})

describe('self-check boundaries', () => {
  // The model's warm-up: its first answers are learned from but not scored.
  const WARM_UP = 10
  const answer = (k: number, score: number, skill = 'past-simple'): Evidence =>
    ({ itemId: `b${k % 4}`, skill, level: 'B1', score, at: new Date(start.getTime() + k * 3_600_000) })
  const answers = (n: number) => Array.from({ length: n }, (_, k) => answer(k, k % 3 === 0 ? 0 : 1))
  const loss = (p: number, y: number) => -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
  const empty = { n: 0, accuracy: 0, logLoss: 0, baselineLogLoss: 0, bins: [] }

  it('scores nothing, with no bins, when there are no answers', () => {
    const { model, check } = evaluate([], 'B1')
    expect(check).toEqual(empty)
    expect(model.n).toBe(0)
    expect(model.ability).toBe(emptyModel('B1').ability)
  })

  it('learns from warm-up answers without scoring them, up to and at the warm-up count', () => {
    for (const n of [1, WARM_UP - 1, WARM_UP]) {
      const { model, check } = evaluate(answers(n), 'B1')
      expect(check, `${n} answers`).toEqual(empty)
      expect(model.n).toBe(n)
    }
  })

  it('scores the first answer after the warm-up from its own prediction and the running average', () => {
    const evidence = answers(WARM_UP + 1)
    const last = evidence.at(-1)!
    // The chance the model gave before learning the last answer.
    const before = buildModel(evidence.slice(0, WARM_UP), 'B1')
    const p = predict(before, last, last.at)
    const right = evidence.slice(0, WARM_UP).reduce((s, e) => s + e.score, 0)
    const base = (right + 1) / (WARM_UP + 2)
    const { check } = evaluate(evidence, 'B1')
    expect(check.n).toBe(1)
    expect(check.accuracy).toBe((p >= 0.5) === (last.score >= 0.5) ? 1 : 0)
    expect(check.logLoss).toBeCloseTo(loss(p, last.score), 12)
    expect(check.baselineLogLoss).toBeCloseTo(loss(base, last.score), 12)
    expect(check.bins).toHaveLength(1)
    const [bin] = check.bins
    expect(bin!.n).toBe(1)
    expect(bin!.said).toBeCloseTo(p, 12)
    expect(bin!.was).toBe(last.score)
    expect(p).toBeGreaterThanOrEqual(bin!.from)
    expect(p).toBeLessThan(bin!.to === 1 ? 1.000001 : bin!.to)
  })

  it('treats scores outside 0 to 1 as their nearest end', () => {
    const wild = answers(30).map((e, k) => ({ ...e, score: e.score === 1 ? (k % 2 ? 1.7 : 1) : (k % 2 ? -0.4 : 0) }))
    const clamped = wild.map(e => ({ ...e, score: Math.min(1, Math.max(0, e.score)) }))
    const a = evaluate(wild, 'B1')
    const b = evaluate(clamped, 'B1')
    expect(a.check).toEqual(b.check)
    expect(a.model.ability).toBe(b.model.ability)
    expect(a.check.n).toBe(20)
    expect(a.check.accuracy).toBeGreaterThanOrEqual(0)
    expect(a.check.accuracy).toBeLessThanOrEqual(1)
    for (const bin of a.check.bins) {
      expect(bin.was).toBeGreaterThanOrEqual(0)
      expect(bin.was).toBeLessThanOrEqual(1)
      expect(bin.said).toBeGreaterThanOrEqual(bin.from)
      expect(bin.said).toBeLessThanOrEqual(bin.to)
    }
    expect(a.check.bins.reduce((s, b) => s + b.n, 0)).toBe(a.check.n)
  })

  it('predicts each answer before learning from it, in time order', () => {
    // One item answered wrong again and again: a model that learned first
    // would score itself far better than one that predicted first.
    const evidence = Array.from({ length: 25 }, (_, k) => answer(k * 4, 0, 'articles'))
    const shuffled = [...evidence].reverse()
    const model = emptyModel('B1')
    let before = 0
    let after = 0
    evidence.forEach((e, k) => {
      const pBefore = predict(model, e, e.at)
      learn(model, e)
      const pAfter = predict(model, e, e.at)
      if (k >= WARM_UP) {
        before += loss(pBefore, 0)
        after += loss(pAfter, 0)
      }
    })
    const { check } = evaluate(shuffled, 'B1')
    expect(check.n).toBe(15)
    expect(check.logLoss).toBeCloseTo(before / 15, 12)
    expect(check.logLoss).toBeGreaterThan(after / 15)
  })
})
