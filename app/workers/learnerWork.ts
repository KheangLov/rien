import type { AttemptRow, Book, Level, ReviewRow, Settings } from '#shared/schemas/db'
import { buildDataset } from '#shared/ml/dataset'
import { FEATURE_COUNT, type FeatureState } from '#shared/ml/features'
import type { TrainReport } from '#shared/ml/train'
import { fitFsrs, type FsrsFit } from '#shared/utils/fsrsFit'
import { evidenceFrom, tune, type Model, type ModelParams, type SelfCheck } from '#shared/utils/mastery'
import { msPerLetter } from '#shared/utils/scheduler'
import { levelFor } from '#shared/utils/skills'

// The skill model's heavy part: in the background thread (learner.worker.ts)
// and, without training the network, on the main thread if that cannot start.

export type MlModel = NonNullable<Settings['mlModel']>

export interface LearnerInput {
  attempts: AttemptRow[]
  reviews: ReviewRow[]
  cards: { id: string, book: Book, file: number }[]
  // Her book and File's level, where the model starts before any answers.
  level: Level
  // Minutes, as Date.getTimezoneOffset(): days are her local days.
  timezoneOffset: number
  now: Date
  // The network trained last time, if any (from her settings).
  previousMl?: MlModel
  // Train the network when it is due (only in the background thread).
  allowTraining?: boolean
}

export interface LearnerOutput {
  model: Model
  // How well it predicted her past answers, and the speeds it settled on
  // (fitted to her once she has enough answers).
  check: SelfCheck
  params: ModelParams
  tuned: boolean
  fit: FsrsFit | null
  perLetter: number
  answers: number
  // What the network's features remember of her history, for live predictions.
  featureState: FeatureState
  // The network, newly trained or kept from last time.
  ml?: MlModel
  mlTrainedNow: boolean
}

const PACE_DAYS = 60
// Retrain once she has this many more answers, or after this long.
const RETRAIN_ANSWERS = 50
const RETRAIN_DAYS = 7

export async function buildLearner(input: LearnerInput): Promise<LearnerOutput> {
  const levels = new Map(input.cards.map(c => [c.id, levelFor(c.book, c.file)]))
  const evidence = evidenceFrom(input.attempts, input.reviews, id => levels.get(id) ?? input.level)
  const recent = input.now.getTime() - PACE_DAYS * 86_400_000
  const tuned = tune(evidence, input.level)
  const data = buildDataset(evidence, input.level, tuned.params)

  const prev = input.previousMl
  const fresh = prev && prev.featureCount === FEATURE_COUNT
    && evidence.length - prev.trainedAnswers < RETRAIN_ANSWERS
    && input.now.getTime() - new Date(prev.trainedAt).getTime() < RETRAIN_DAYS * 86_400_000
  let ml: MlModel | undefined = prev && prev.featureCount === FEATURE_COUNT ? prev : undefined
  let mlTrainedNow = false
  if (!fresh && input.allowTraining) {
    // TensorFlow.js is loaded only here, in the background thread.
    const { MIN_TRAIN, trainNetwork } = await import('#shared/ml/train')
    if (data.x.length >= MIN_TRAIN) {
      const result = await trainNetwork(data.x, data.y, data.eloP)
      const { weights, ...report } = result
      ml = { weights, report: report as TrainReport, trainedAnswers: evidence.length, trainedAt: input.now, featureCount: FEATURE_COUNT }
      mlTrainedNow = true
    }
  }

  return {
    model: data.model,
    check: tuned.check,
    params: tuned.params,
    tuned: tuned.tuned,
    fit: fitFsrs(input.reviews, input.timezoneOffset),
    perLetter: msPerLetter(input.reviews.filter(r => r.at.getTime() >= recent)),
    answers: evidence.length,
    featureState: data.state,
    ml,
    mlTrainedNow,
  }
}
