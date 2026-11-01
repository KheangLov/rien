import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
import '@tensorflow/tfjs-backend-webgl'
import * as tfl from '@tensorflow/tfjs-layers'
import { FEATURE_COUNT } from './features'
import type { NetWeights } from './forward'
import { accuracy, auc, logLoss } from './metrics'

// Trains Rien's neural network on her own answers with TensorFlow.js, in the
// background thread (app/workers/learner.worker.ts), on the phone's GPU (WebGL)
// when the thread can use it and on the CPU otherwise.
//
// The flow:
// 1. Split her answers by time: the older 80% to train on, the newest 20% to
//    test on (a model must predict answers it has never seen).
// 2. Train a small network (features → 16 ReLU units → 1 sigmoid) with Adam
//    and binary cross-entropy, stopping when the test loss stops improving,
//    keeping the best epoch.
// 3. Compare it on the test answers with the skill model (shared/utils/mastery.ts).
// 4. Only if it predicts better: train again on all her answers for the best
//    number of epochs, and use it.

// Answers needed before a network is worth training.
export const MIN_TRAIN = 200
// It must beat the skill model's test log loss by at least this much.
const MARGIN = 0.002
const HIDDEN = 16
const MAX_EPOCHS = 80
const PATIENCE = 6

export interface TrainReport {
  trained: boolean
  // Whether the network is used for predictions (it beat the skill model).
  active: boolean
  reason?: string
  backend?: string
  trainRows?: number
  testRows?: number
  epochs?: number
  test?: { logLoss: number, accuracy: number, auc: number }
  baseline?: { logLoss: number, accuracy: number, auc: number }
}

let backendReady: Promise<string> | undefined

// The GPU through WebGL where it works (OffscreenCanvas in a worker), else the CPU.
export function useBestBackend(): Promise<string> {
  backendReady ??= (async () => {
    for (const name of ['webgl', 'cpu']) {
      try {
        if (await tf.setBackend(name)) {
          await tf.ready()
          return tf.getBackend()
        }
      }
      catch {}
    }
    return tf.getBackend()
  })()
  return backendReady
}

function network(seed: number): tfl.Sequential {
  const model = tfl.sequential()
  model.add(tfl.layers.dense({
    inputShape: [FEATURE_COUNT],
    units: HIDDEN,
    activation: 'relu',
    kernelInitializer: tfl.initializers.glorotUniform({ seed }),
    kernelRegularizer: tfl.regularizers.l2({ l2: 1e-3 }),
  }))
  model.add(tfl.layers.dense({ units: 1, activation: 'sigmoid', kernelInitializer: tfl.initializers.glorotUniform({ seed: seed + 1 }) }))
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'binaryCrossentropy' })
  return model
}

async function weightsOf(model: tfl.Sequential): Promise<NetWeights> {
  const values = await Promise.all(model.getWeights().map(w => w.array()))
  const layers = []
  for (let i = 0; i < values.length; i += 2) layers.push({ kernel: values[i] as number[][], bias: values[i + 1] as number[] })
  return { layers }
}

function predictWith(model: tfl.Sequential, x: number[][]): number[] {
  return tf.tidy(() => Array.from((model.predict(tf.tensor2d(x, [x.length, FEATURE_COUNT])) as tf.Tensor).dataSync()))
}

export async function trainNetwork(x: number[][], y: number[], eloP: number[], seed = 7): Promise<TrainReport & { weights?: NetWeights }> {
  if (x.length < MIN_TRAIN) return { trained: false, active: false, reason: `needs ${MIN_TRAIN} answers, has ${x.length}` }
  const backend = await useBestBackend()
  const split = Math.floor(x.length * 0.8)
  const [trainX, testX] = [x.slice(0, split), x.slice(split)]
  const [trainY, testY] = [y.slice(0, split), y.slice(split)]

  // 1–2. Train on the older answers; watch the newest.
  const model = network(seed)
  const xs = tf.tensor2d(trainX, [trainX.length, FEATURE_COUNT])
  const ys = tf.tensor2d(trainY, [trainY.length, 1])
  const vx = tf.tensor2d(testX, [testX.length, FEATURE_COUNT])
  const vy = tf.tensor2d(testY, [testY.length, 1])
  let best = { loss: Number.POSITIVE_INFINITY, epoch: 0, weights: [] as tf.Tensor[] }
  try {
    await model.fit(xs, ys, {
      epochs: MAX_EPOCHS,
      batchSize: 32,
      shuffle: true,
      validationData: [vx, vy],
      verbose: 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          const loss = logs?.val_loss ?? Number.POSITIVE_INFINITY
          if (loss < best.loss - 1e-5) {
            best.weights.forEach(w => w.dispose())
            best = { loss, epoch: epoch + 1, weights: model.getWeights().map(w => w.clone()) }
          }
          else if (epoch + 1 - best.epoch >= PATIENCE) model.stopTraining = true
        },
      },
    })
    if (best.weights.length) model.setWeights(best.weights)

    // 3. Compare with the skill model on answers neither learned from.
    const p = predictWith(model, testX)
    const baseP = eloP.slice(split)
    const test = { logLoss: logLoss(p, testY), accuracy: accuracy(p, testY), auc: auc(p, testY) }
    const baseline = { logLoss: logLoss(baseP, testY), accuracy: accuracy(baseP, testY), auc: auc(baseP, testY) }
    const report: TrainReport = {
      trained: true,
      active: test.logLoss < baseline.logLoss - MARGIN,
      backend,
      trainRows: trainX.length,
      testRows: testX.length,
      epochs: best.epoch,
      test,
      baseline,
    }
    if (!report.active) return { ...report, reason: 'did not beat the skill model on your newest answers' }

    // 4. Learn from everything, for as long as worked best.
    const final = network(seed)
    const ax = tf.tensor2d(x, [x.length, FEATURE_COUNT])
    const ay = tf.tensor2d(y, [y.length, 1])
    try {
      await final.fit(ax, ay, { epochs: Math.max(1, best.epoch), batchSize: 32, shuffle: true, verbose: 0 })
      return { ...report, weights: await weightsOf(final) }
    }
    finally {
      ax.dispose()
      ay.dispose()
      final.dispose()
    }
  }
  finally {
    for (const t of [xs, ys, vx, vy, ...best.weights]) t.dispose()
    model.dispose()
  }
}
