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
// The chance of a right answer is σ(ability + offset − difficulty). After each
// answer the three numbers move a little towards what happened, less as they
// collect evidence. Nothing leaves the phone; the model is rebuilt from her
// answer log (attempts and word reviews), so it never disagrees with it.

export interface Evidence {
  itemId: string
  skill: string
  level: Level
  // 1 right first time, 0 wrong, in between for nearly right or helped.
  score: number
  at: Date
}

interface SkillState { offset: number, n: number, lastAt: number }
interface ItemState { difficulty: number, prior: number, n: number }

export interface Model {
  ability: number
  n: number
  skills: Map<string, SkillState>
  items: Map<string, ItemState>
}

// A skill left alone fades halfway back to her overall level in this time.
export const SKILL_HALF_LIFE_DAYS = 30
// How far one item's difficulty may move from its level.
const ITEM_DRIFT = 1.5
// Rounds aim at items she gets right this often (hard enough to learn from,
// easy enough to keep going).
export const TARGET_SUCCESS = 0.8

const DAY = 86_400_000
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// Before any answers: items at her book's level come out right about 3 times in 4.
export function emptyModel(startLevel: Level): Model {
  return { ability: LEVEL_DIFFICULTY[startLevel] + 1.1, n: 0, skills: new Map(), items: new Map() }
}

function offsetAt(state: SkillState | undefined, now: number): number {
  if (!state) return 0
  const days = Math.max(0, now - state.lastAt) / DAY
  return state.offset * 0.5 ** (days / SKILL_HALF_LIFE_DAYS)
}

function difficultyOf(model: Model, itemId: string, level: Level): number {
  return model.items.get(itemId)?.difficulty ?? LEVEL_DIFFICULTY[level]
}

// The chance she gets this item right now.
export function predict(model: Model, item: { itemId: string, skill: string, level: Level }, now: Date): number {
  return sigmoid(model.ability + offsetAt(model.skills.get(item.skill), now.getTime()) - difficultyOf(model, item.itemId, item.level))
}

// Learns from one answer (in time order). Returns the chance it predicted.
export function learn(model: Model, e: Evidence): number {
  const at = e.at.getTime()
  const skill = model.skills.get(e.skill)
  const item = model.items.get(e.itemId)
  const offset = offsetAt(skill, at)
  const prior = LEVEL_DIFFICULTY[e.level]
  const difficulty = item?.difficulty ?? prior
  const p = sigmoid(model.ability + offset - difficulty)
  const error = clamp(e.score, 0, 1) - p

  // Step sizes shrink as evidence builds up, never to nothing (she changes).
  const kAbility = Math.max(0.04, 0.4 / (1 + 0.05 * model.n))
  const kSkill = Math.max(0.12, 0.6 / (1 + 0.15 * (skill?.n ?? 0)))
  const kItem = Math.max(0.05, 0.3 / (1 + 0.3 * (item?.n ?? 0)))

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

export function buildModel(evidence: readonly Evidence[], startLevel: Level): Model {
  const model = emptyModel(startLevel)
  const sorted = [...evidence].sort((a, b) => a.at.getTime() - b.at.getTime())
  for (const e of sorted) learn(model, e)
  return model
}

export interface SkillReport {
  skill: string
  // Chance of a right answer on a typical item at her level.
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
    .map(([skill, s]) => ({ skill, p: sigmoid(model.ability + offsetAt(s, at) - LEVEL_DIFFICULTY[level]), n: s.n }))
    .sort((a, b) => a.p - b.p)
}

// The highest level where a typical item comes out right at least `success`
// of the time: "you are working at about B1".
export function workingLevel(model: Model, success = 0.7): Level {
  let best: Level = LEVELS[0]
  for (const level of LEVELS) if (sigmoid(model.ability - LEVEL_DIFFICULTY[level]) >= success) best = level
  return best
}

// How well an unseen item suits a round: highest for items she should get
// right about TARGET_SUCCESS of the time, and for skills she is weak at.
// Distance is measured in log-odds, where 60% and 95% are equally far from 80%.
export function suitability(model: Model, item: { itemId: string, skill: string, level: Level }, now: Date): number {
  const p = Math.min(1 - 1e-6, Math.max(1e-6, predict(model, item, now)))
  const distance = Math.log(p / (1 - p)) - Math.log(TARGET_SUCCESS / (1 - TARGET_SUCCESS))
  const fit = Math.exp(-(distance ** 2) / 2)
  const weakness = 1 - sigmoid(offsetAt(model.skills.get(item.skill), now.getTime()))
  return Math.max(0.02, fit) * (0.5 + weakness)
}
