import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import * as tfl from '@tensorflow/tfjs-layers'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildDataset } from '#shared/ml/dataset'
import { FEATURE_COUNT, FEATURE_NAMES } from '#shared/ml/features'
import { forward } from '#shared/ml/forward'
import { accuracy, auc, logLoss } from '#shared/ml/metrics'
import { MIN_TRAIN, trainNetwork } from '#shared/ml/train'
import type { Evidence } from '#shared/utils/mastery'
import { LEVEL_DIFFICULTY } from '#shared/utils/skills'

const HOUR = 3_600_000
const start = new Date('2026-06-01T02:00:00Z')

function seeded(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
}

beforeAll(async () => {
  await tf.setBackend('cpu')
})

describe('metrics', () => {
  it('scores predictions', () => {
    expect(accuracy([0.9, 0.2, 0.7], [1, 0, 0])).toBeCloseTo(2 / 3)
    expect(auc([0.9, 0.8, 0.1, 0.3], [1, 1, 0, 0])).toBe(1)
    expect(auc([0.5, 0.5], [1, 0])).toBe(0.5)
    expect(logLoss([0.5], [1])).toBeCloseTo(Math.log(2))
  })
})

describe('training data', () => {
  const evidence: Evidence[] = Array.from({ length: 30 }, (_, i) => ({
    itemId: `i${i % 5}`, skill: i % 2 ? 'articles' : 'past-simple', level: 'B1', score: i % 3 ? 1 : 0, at: new Date(start.getTime() + i * HOUR), kind: 'fix-it',
  }))

  it('builds one row per answer from earlier answers only', () => {
    const data = buildDataset(evidence, 'B1')
    expect(data.x).toHaveLength(30)
    expect(data.x[0]).toHaveLength(FEATURE_COUNT)
    expect(FEATURE_NAMES).toHaveLength(FEATURE_COUNT)
    // Changing a later answer must not change any earlier row.
    const changed = evidence.map((e, i) => (i === 20 ? { ...e, score: 1 - e.score } : e))
    const other = buildDataset(changed, 'B1')
    expect(other.x.slice(0, 21)).toEqual(data.x.slice(0, 21))
    expect(other.x[21]).not.toEqual(data.x[21])
  })
})

describe('the network', () => {
  it('gives the same answer in plain JavaScript as in TensorFlow.js', async () => {
    const model = tfl.sequential()
    model.add(tfl.layers.dense({ inputShape: [FEATURE_COUNT], units: 4, activation: 'relu' }))
    model.add(tfl.layers.dense({ units: 1, activation: 'sigmoid' }))
    const x = Array.from({ length: FEATURE_COUNT }, (_, i) => Math.sin(i))
    const expected = (model.predict(tf.tensor2d([x])) as tf.Tensor).dataSync()[0]!
    const w = await Promise.all(model.getWeights().map(t => t.array()))
    const net = { layers: [{ kernel: w[0] as number[][], bias: w[1] as number[] }, { kernel: w[2] as number[][], bias: w[3] as number[] }] }
    expect(forward(net, x)).toBeCloseTo(expected, 5)
    model.dispose()
  })

  it('needs enough answers before training', async () => {
    const few = buildDataset([], 'B1')
    expect((await trainNetwork(few.x, few.y, few.eloP)).trained).toBe(false)
  })

  it('learns what the skill model misses, and only then takes over', async () => {
    // A learner who forgets each word the longer it goes unseen: something the
    // skill model (one strength per skill) cannot see, but the network's
    // "days since this item" feature can.
    const random = seeded(11)
    const items = Array.from({ length: 40 }, (_, i) => ({ itemId: `w${i}`, skill: `s${i % 4}`, level: 'B1' as const }))
    const lastSeen = new Map<string, number>()
    const evidence: Evidence[] = []
    let t = start.getTime()
    for (let k = 0; k < 900; k++) {
      t += (0.5 + random() * 30) * HOUR
      const item = items[Math.floor(random() * items.length)]!
      const last = lastSeen.get(item.itemId)
      const days = last === undefined ? 30 : (t - last) / (24 * HOUR)
      const p = 1 / (1 + Math.exp(-(2.2 - LEVEL_DIFFICULTY.B1 * 0 - 1.1 * Math.log1p(days))))
      evidence.push({ ...item, score: random() < p ? 1 : 0, at: new Date(t), kind: 'word' })
      lastSeen.set(item.itemId, t)
    }
    const data = buildDataset(evidence, 'B1')
    expect(data.x.length).toBeGreaterThanOrEqual(MIN_TRAIN)
    const result = await trainNetwork(data.x, data.y, data.eloP)
    expect(result.trained).toBe(true)
    expect(result.backend).toBe('cpu')
    expect(result.test!.logLoss).toBeLessThan(result.baseline!.logLoss)
    expect(result.active).toBe(true)
    expect(result.weights!.layers).toHaveLength(2)
    expect(result.weights!.layers[0]!.kernel).toHaveLength(FEATURE_COUNT)
  }, 60_000)
})

describe('when the network trains and takes over', () => {
  // Rows of random features and answers the features cannot explain, with a
  // skill-model chance for each.
  function rows(n: number, seed: number, eloP: (y: number, r: () => number) => number) {
    const random = seeded(seed)
    const x = Array.from({ length: n }, () => Array.from({ length: FEATURE_COUNT }, () => random() * 2 - 1))
    const y = x.map(() => (random() < 0.5 ? 1 : 0))
    return { x, y, eloP: y.map(v => eloP(v, random)) }
  }
  // A skill model that is almost always sure and right: nothing can beat it.
  const sure = (y: number) => (y ? 0.97 : 0.03)

  // Runs training with Math.random seeded too (TensorFlow.js shuffles the
  // batches with it), and checks no tensor outlives the call.
  async function train(data: ReturnType<typeof rows>, seed?: number) {
    const random = seeded(99)
    const realRandom = Math.random
    Math.random = random
    const before = tf.memory().numTensors
    try {
      return { result: await trainNetwork(data.x, data.y, data.eloP, seed), leaked: tf.memory().numTensors - before }
    }
    finally {
      Math.random = realRandom
    }
  }

  it('refuses one answer short of the minimum, and says why', async () => {
    const data = rows(MIN_TRAIN - 1, 1, sure)
    const { result, leaked } = await train(data)
    expect(result).toEqual({ trained: false, active: false, reason: `needs ${MIN_TRAIN} answers, has ${MIN_TRAIN - 1}` })
    expect(leaked).toBe(0)
  })

  it('trains at exactly the minimum, on the older 80% and tested on the newest 20%', async () => {
    for (const n of [MIN_TRAIN, MIN_TRAIN + 1]) {
      const { result, leaked } = await train(rows(n, 2, sure))
      expect(result.trained, `${n} rows`).toBe(true)
      expect(result.trainRows).toBe(Math.floor(n * 0.8))
      expect(result.testRows).toBe(n - Math.floor(n * 0.8))
      expect(leaked, `${n} rows`).toBe(0)
    }
  }, 60_000)

  it('keeps the skill model when the network does not beat it by the margin', async () => {
    const data = rows(MIN_TRAIN, 3, sure)
    const { result, leaked } = await train(data)
    expect(result.trained).toBe(true)
    expect(result.active).toBe(false)
    expect(result.reason).toBe('did not beat the skill model on your newest answers')
    expect(result.weights).toBeUndefined()
    // It did not come within the margin (0.002) of the skill model.
    expect(result.test!.logLoss).toBeGreaterThanOrEqual(result.baseline!.logLoss - 0.002)
    expect(result.baseline!.accuracy).toBe(1)
    expect(leaked).toBe(0)
  }, 60_000)

  it('gives the same result twice for the same seed and data', async () => {
    // A skill model that knows nothing (always 50%), so the network decides.
    const data = rows(MIN_TRAIN, 4, () => 0.5)
    const a = await train(data, 13)
    const b = await train(data, 13)
    expect(b.result).toEqual(a.result)
    expect(a.leaked + b.leaked).toBe(0)
  }, 60_000)
})
