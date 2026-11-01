import type { Level } from '../schemas/db'
import { emptyModel, learn, DEFAULT_PARAMS, type Evidence, type Model, type ModelParams } from '../utils/mastery'
import { emptyFeatureState, featuresFor, observe, type FeatureState } from './features'

const logit = (p: number) => {
  const q = Math.min(1 - 1e-6, Math.max(1e-6, p))
  return Math.log(q / (1 - q))
}

export interface Dataset {
  // One row of features per answer, in time order, and its label.
  x: number[][]
  y: number[]
  // What the skill model predicted for each answer before learning from it:
  // the baseline the network has to beat.
  eloP: number[]
  // The skill model and feature history after every answer, for live use.
  model: Model
  state: FeatureState
}

// Replays her answers in time order. Each row is built before the answer is
// learned from, so no row ever sees its own answer or any later one.
export function buildDataset(evidence: readonly Evidence[], startLevel: Level, params: ModelParams = DEFAULT_PARAMS): Dataset {
  const model = emptyModel(startLevel, params)
  const state = emptyFeatureState()
  const x: number[][] = []
  const y: number[] = []
  const eloP: number[] = []
  for (const e of [...evidence].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const p = learn(model, e)
    x.push(featuresFor(state, e, logit(p)))
    y.push(Math.min(1, Math.max(0, e.score)))
    eloP.push(p)
    observe(state, e)
  }
  return { x, y, eloP, model, state }
}

export { logit }
