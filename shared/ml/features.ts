import { ATTEMPT_KINDS, type AttemptKind, type Level } from '../schemas/db'
import { LEVEL_DIFFICULTY } from '../utils/skills'

// The training data for Rien's neural network (app/workers/mlTrain.ts): one row
// per answer she has given, its features worked out only from what happened
// before that answer (so the model never learns from the future), and the
// label: right (1), wrong (0) or in between.

export const KINDS = [...ATTEMPT_KINDS, 'word'] as const
export type Kind = AttemptKind | 'word'

interface Tally { right: number, total: number, lastAt: number }

// What the features remember about her history, updated after each answer.
export interface FeatureState {
  skills: Map<string, Tally>
  items: Map<string, Tally>
  // Her last scores, most recent last.
  recent: number[]
}

export interface Answer {
  itemId: string
  skill: string
  level: Level
  kind?: Kind
  at: Date
  score: number
}

const DAY = 86_400_000
const RECENT = 20

export const FEATURE_NAMES = [
  'elo-logit', 'level',
  ...KINDS.map(k => `kind:${k}`),
  'skill-right', 'skill-wrong', 'skill-accuracy', 'skill-days', 'skill-new',
  'item-seen', 'item-accuracy', 'item-days', 'item-new',
  'recent-accuracy', 'hour-sin', 'hour-cos',
] as const
export const FEATURE_COUNT = FEATURE_NAMES.length

export const emptyFeatureState = (): FeatureState => ({ skills: new Map(), items: new Map(), recent: [] })

const smoothed = (right: number, total: number) => (right + 1) / (total + 2)
const daysSince = (tally: Tally | undefined, at: number) => (tally ? Math.log1p(Math.max(0, at - tally.lastAt) / DAY) : 0)

// The features for an answer about to be given. eloLogit: the skill model's
// log-odds for it (shared/utils/mastery.ts), so the network learns what to add
// to what the skill model already knows.
export function featuresFor(state: FeatureState, a: Omit<Answer, 'score'>, eloLogit: number): number[] {
  const at = a.at.getTime()
  const skill = state.skills.get(a.skill)
  const item = state.items.get(a.itemId)
  const kind = a.kind ?? 'word'
  const hour = (a.at.getHours() + a.at.getMinutes() / 60) / 24 * 2 * Math.PI
  const recentAccuracy = smoothed(state.recent.reduce((s, x) => s + x, 0), state.recent.length)
  return [
    Math.max(-6, Math.min(6, eloLogit)) / 4,
    LEVEL_DIFFICULTY[a.level] / 2,
    ...KINDS.map(k => (k === kind ? 1 : 0)),
    Math.log1p(skill?.right ?? 0),
    Math.log1p((skill?.total ?? 0) - (skill?.right ?? 0)),
    smoothed(skill?.right ?? 0, skill?.total ?? 0),
    daysSince(skill, at),
    skill ? 0 : 1,
    Math.log1p(item?.total ?? 0),
    smoothed(item?.right ?? 0, item?.total ?? 0),
    daysSince(item, at),
    item ? 0 : 1,
    recentAccuracy,
    Math.sin(hour),
    Math.cos(hour),
  ]
}

// Remembers an answer once it has been given.
export function observe(state: FeatureState, a: Answer): void {
  const at = a.at.getTime()
  const score = Math.min(1, Math.max(0, a.score))
  for (const [map, key] of [[state.skills, a.skill], [state.items, a.itemId]] as const) {
    const tally = map.get(key) ?? { right: 0, total: 0, lastAt: at }
    map.set(key, { right: tally.right + score, total: tally.total + 1, lastAt: at })
  }
  state.recent.push(score)
  if (state.recent.length > RECENT) state.recent.shift()
}
