import type { AttemptKind } from '../schemas/db'
import { LEVEL_DIFFICULTY, LEVELS, type Level } from './skills'

// The skill model: a small, on-device learner model in the Elo / item response
// family (as used in adaptive practice systems). Every answer she gives is
// evidence, right ones as much as wrong ones. Three kinds of number explain an
// answer:
// - her ability: how strong she is overall;
// - a skill offset: how much stronger or weaker she is at one grammar point or
//   sound than overall, fading back to 0 when she leaves it alone;
// - an item difficulty: how hard one sentence or word is, starting from its
//   level and adjusted by how she does on it.
// The chance she knows the answer is s = σ(ability + offset − difficulty). In
// games with choices she can also guess right, so the chance of a right answer
// is c + (1 − c)·s, with c the game's guessing chance (the "3PL" model of item
// response theory). After each answer the numbers move a little towards what
// happened, less as they collect evidence and less for a right answer that
// could have been a lucky guess. Nothing leaves the phone; the model is rebuilt
// from her answer log (attempts and word reviews), so it never disagrees with it.

export interface Evidence {
  itemId: string
  skill: string
  level: Level
  // 1 right first time, 0 wrong, in between for nearly right or helped.
  score: number
  at: Date
  // The game, for its guessing chance; typed answers (words) have none.
  kind?: AttemptKind | 'word'
}

// The chance of a right answer by luck alone in each game: two sounds or
// right/wrong 1 in 2, four choices 1 in 4. Fix It needs the wrong word found
// first (tapping on, then a fix from up to four), so luck rarely gets it right.
export const GUESS_BY_KIND: Record<AttemptKind | 'word', number> = {
  'fix-it': 0.15,
  'sound': 0.5,
  'builder': 0,
  'radio': 0,
  'listen': 0.25,
  'picture': 0.25,
  'speed': 0.5,
  'boss': 0.2,
  'say-it': 0,
  'word': 0,
}

// How fast the model learns and forgets. The defaults are tuned on simulated
// learners; tune() fits them to her own answers once she has enough.
export interface ModelParams {
  // Starting step sizes for her ability, a skill and an item.
  abilityRate: number
  skillRate: number
  itemRate: number
  // A skill left alone fades halfway back to her overall level in this time.
  halfLifeDays: number
}

export const DEFAULT_PARAMS: ModelParams = { abilityRate: 0.4, skillRate: 0.6, itemRate: 0.3, halfLifeDays: 30 }
export const SKILL_HALF_LIFE_DAYS = DEFAULT_PARAMS.halfLifeDays

interface SkillState { offset: number, n: number, lastAt: number }
interface ItemState { difficulty: number, prior: number, n: number }

export interface Model {
  ability: number
  n: number
  skills: Map<string, SkillState>
  items: Map<string, ItemState>
  params: ModelParams
}

// How far one item's difficulty may move from its level.
const ITEM_DRIFT = 1.5
// Rounds aim at items she gets right this often (hard enough to learn from,
// easy enough to keep going).
export const TARGET_SUCCESS = 0.8

const DAY = 86_400_000
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const guessOf = (kind: Evidence['kind']) => (kind ? GUESS_BY_KIND[kind] ?? 0 : 0)

// Before any answers: items at her book's level come out right about 3 times in 4.
export function emptyModel(startLevel: Level, params: ModelParams = DEFAULT_PARAMS): Model {
  return { ability: LEVEL_DIFFICULTY[startLevel] + 1.1, n: 0, skills: new Map(), items: new Map(), params }
}

function offsetAt(model: Model, state: SkillState | undefined, now: number): number {
  if (!state) return 0
  const days = Math.max(0, now - state.lastAt) / DAY
  return state.offset * 0.5 ** (days / model.params.halfLifeDays)
}

function difficultyOf(model: Model, itemId: string, level: Level): number {
  return model.items.get(itemId)?.difficulty ?? LEVEL_DIFFICULTY[level]
}

// The chance she knows this item now (guess = 0), or gets it right in a game
// where luck can help (guess = that game's chance, GUESS_BY_KIND).
export function predict(model: Model, item: { itemId: string, skill: string, level: Level }, now: Date, guess = 0): number {
  const knows = sigmoid(model.ability + offsetAt(model, model.skills.get(item.skill), now.getTime()) - difficultyOf(model, item.itemId, item.level))
  return guess + (1 - guess) * knows
}

// Learns from one answer (in time order). Returns the chance it predicted for
// a right answer, before learning from it.
export function learn(model: Model, e: Evidence): number {
  const at = e.at.getTime()
  const skill = model.skills.get(e.skill)
  const item = model.items.get(e.itemId)
  const offset = offsetAt(model, skill, at)
  const prior = LEVEL_DIFFICULTY[e.level]
  const difficulty = item?.difficulty ?? prior
  const knows = sigmoid(model.ability + offset - difficulty)
  const c = guessOf(e.kind)
  const p = c + (1 - c) * knows
  // The slope of the answer's log-likelihood: plain (score − p) without
  // guessing; with it, a right answer counts for less, since luck can explain it.
  const q = clamp(p, 1e-6, 1 - 1e-6)
  const error = (clamp(e.score, 0, 1) - q) * (1 - c) * knows * (1 - knows) / (q * (1 - q))

  // Step sizes shrink as evidence builds up, never to nothing (she changes).
  const { abilityRate, skillRate, itemRate } = model.params
  const kAbility = Math.max(abilityRate / 10, abilityRate / (1 + 0.05 * model.n))
  const kSkill = Math.max(skillRate / 5, skillRate / (1 + 0.15 * (skill?.n ?? 0)))
  const kItem = Math.max(itemRate / 6, itemRate / (1 + 0.3 * (item?.n ?? 0)))

  model.ability += kAbility * error
  model.n++
  model.skills.set(e.skill, { offset: clamp(offset + kSkill * error, -4, 4), n: (skill?.n ?? 0) + 1, lastAt: at })
  model.items.set(e.itemId, {
    difficulty: clamp(difficulty - kItem * error, prior - ITEM_DRIFT, prior + ITEM_DRIFT),
    prior,
    n: (item?.n ?? 0) + 1,
  })
  return p
}

const byTime = (evidence: readonly Evidence[]) => [...evidence].sort((a, b) => a.at.getTime() - b.at.getTime())

export function buildModel(evidence: readonly Evidence[], startLevel: Level, params: ModelParams = DEFAULT_PARAMS): Model {
  const model = emptyModel(startLevel, params)
  for (const e of byTime(evidence)) learn(model, e)
  return model
}

// --- Self-check --------------------------------------------------------------------

export interface CalibrationBin {
  // The model's predictions in this band, e.g. 0.7 to 0.85.
  from: number
  to: number
  // What it said on average, and how often she was actually right.
  said: number
  was: number
  n: number
}

export interface SelfCheck {
  // Answers it was checked on (each predicted before the model learned from it).
  n: number
  // How often "right or wrong" was called correctly.
  accuracy: number
  // Average prediction error (log loss; lower is better), and the same for a
  // simple guess (her running average), to show the model adds something.
  logLoss: number
  baselineLogLoss: number
  bins: CalibrationBin[]
}

// The first answers say little: the model is still starting out.
const WARM_UP = 10
const BIN_EDGES = [0, 0.5, 0.7, 0.85, 1.000001]

// Replays her answers in order, predicting each one before learning from it
// (so it is never checked on an answer it has seen), and scores the predictions.
export function evaluate(evidence: readonly Evidence[], startLevel: Level, params: ModelParams = DEFAULT_PARAMS): { model: Model, check: SelfCheck } {
  const model = emptyModel(startLevel, params)
  let n = 0
  let hits = 0
  let loss = 0
  let baseLoss = 0
  let sum = 0
  let count = 0
  const bins = BIN_EDGES.slice(0, -1).map((from, i) => ({ from, to: Math.min(1, BIN_EDGES[i + 1]!), said: 0, was: 0, n: 0 }))
  const logLoss = (p: number, y: number) => {
    const q = clamp(p, 1e-6, 1 - 1e-6)
    return -(y * Math.log(q) + (1 - y) * Math.log(1 - q))
  }
  for (const e of byTime(evidence)) {
    const y = clamp(e.score, 0, 1)
    const p = learn(model, e)
    const base = (sum + 1) / (count + 2)
    sum += y
    count++
    if (count <= WARM_UP) continue
    n++
    if ((p >= 0.5) === (y >= 0.5)) hits++
    loss += logLoss(p, y)
    baseLoss += logLoss(base, y)
    const bin = bins.find(b => p >= b.from && p < (b.to === 1 ? 1.000001 : b.to))!
    bin.said += p
    bin.was += y
    bin.n++
  }
  return {
    model,
    check: {
      n,
      accuracy: n ? hits / n : 0,
      logLoss: n ? loss / n : 0,
      baselineLogLoss: n ? baseLoss / n : 0,
      bins: bins.filter(b => b.n > 0).map(b => ({ ...b, said: b.said / b.n, was: b.was / b.n })),
    },
  }
}

// --- Tuning to her -------------------------------------------------------------------

// Answers needed before the model's speeds are fitted to her.
export const TUNE_MIN_ANSWERS = 300

const GRID = {
  skillRate: [0.3, 0.6, 1],
  itemRate: [0.15, 0.3, 0.5],
  halfLifeDays: [14, 30, 60],
}

// Tries each combination of learning speeds and fading time on her own
// answers (each predicted before it is learned from) and keeps the one that
// predicted her best, if it clearly beats the defaults. Below
// TUNE_MIN_ANSWERS the defaults stay: too few answers to choose fairly.
export function tune(evidence: readonly Evidence[], startLevel: Level): { params: ModelParams, model: Model, check: SelfCheck, tuned: boolean } {
  const base = evaluate(evidence, startLevel, DEFAULT_PARAMS)
  if (evidence.length < TUNE_MIN_ANSWERS) return { params: DEFAULT_PARAMS, ...base, tuned: false }
  let best = { params: DEFAULT_PARAMS, ...base }
  for (const skillRate of GRID.skillRate) {
    for (const itemRate of GRID.itemRate) {
      for (const halfLifeDays of GRID.halfLifeDays) {
        const params = { ...DEFAULT_PARAMS, skillRate, itemRate, halfLifeDays }
        const tried = evaluate(evidence, startLevel, params)
        if (tried.check.logLoss < best.check.logLoss) best = { params, ...tried }
      }
    }
  }
  // A tiny gain is noise: keep the defaults unless the fit is clearly better.
  if (best.check.logLoss > base.check.logLoss - 0.002) return { params: DEFAULT_PARAMS, ...base, tuned: false }
  return { ...best, tuned: true }
}

// --- Reports ---------------------------------------------------------------------------

export interface SkillReport {
  skill: string
  // Chance she knows a typical item at her level.
  p: number
  // Answers it is based on.
  n: number
}

// How she does at each skill she has practised, weakest first. Skills with
// fewer than minAnswers answers are left out: too little to say.
export function skillReport(model: Model, level: Level, now: Date, minAnswers = 3): SkillReport[] {
  const at = now.getTime()
  return [...model.skills.entries()]
    .filter(([, s]) => s.n >= minAnswers)
    .map(([skill, s]) => ({ skill, p: sigmoid(model.ability + offsetAt(model, s, at) - LEVEL_DIFFICULTY[level]), n: s.n }))
    .sort((a, b) => a.p - b.p)
}

// The highest level where a typical item comes out right at least `success`
// of the time: "you are working at about B1".
export function workingLevel(model: Model, success = 0.7): Level {
  let best: Level = LEVELS[0]
  for (const level of LEVELS) if (sigmoid(model.ability - LEVEL_DIFFICULTY[level]) >= success) best = level
  return best
}

// How well an unseen item suits a round: highest for items she should know
// about TARGET_SUCCESS of the time, and for skills she is weak at.
// Distance is measured in log-odds, where 60% and 95% are equally far from 80%.
export function suitability(model: Model, item: { itemId: string, skill: string, level: Level }, now: Date): number {
  const p = Math.min(1 - 1e-6, Math.max(1e-6, predict(model, item, now)))
  const distance = Math.log(p / (1 - p)) - Math.log(TARGET_SUCCESS / (1 - TARGET_SUCCESS))
  const fit = Math.exp(-(distance ** 2) / 2)
  const weakness = 1 - sigmoid(offsetAt(model, model.skills.get(item.skill), now.getTime()))
  return Math.max(0.02, fit) * (0.5 + weakness)
}

// Her answer log as evidence: practice attempts as they are (with their game,
// for its guessing chance), and word reviews as the skill "vocabulary" (Again
// 0, Hard 0.6, Good and Easy 1), each word at its book and File's level.
export function evidenceFrom(
  attempts: readonly { itemId: string, skill: string, level: Level, score: number, at: Date, kind: AttemptKind }[],
  reviews: readonly { cardId: string, rating: number, at: Date }[],
  wordLevel: (cardId: string) => Level,
): Evidence[] {
  const fromReviews = reviews.map(r => ({
    itemId: r.cardId,
    skill: 'vocabulary',
    level: wordLevel(r.cardId),
    score: r.rating <= 1 ? 0 : r.rating === 2 ? 0.6 : 1,
    at: r.at,
    kind: 'word' as const,
  }))
  return [...attempts.map(({ itemId, skill, level, score, at, kind }) => ({ itemId, skill, level, score, at, kind })), ...fromReviews]
}
