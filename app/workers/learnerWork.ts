import type { AttemptRow, Book, Level, ReviewRow } from '#shared/schemas/db'
import { fitFsrs, type FsrsFit } from '#shared/utils/fsrsFit'
import { evidenceFrom, tune, type Model, type ModelParams, type SelfCheck } from '#shared/utils/mastery'
import { msPerLetter } from '#shared/utils/scheduler'
import { levelFor } from '#shared/utils/skills'

// The skill model's heavy part, the same in the background thread
// (learner.worker.ts) and, if that cannot start, on the main thread.

export interface LearnerInput {
  attempts: AttemptRow[]
  reviews: ReviewRow[]
  cards: { id: string, book: Book, file: number }[]
  // Her book and File's level, where the model starts before any answers.
  level: Level
  // Minutes, as Date.getTimezoneOffset(): days are her local days.
  timezoneOffset: number
  now: Date
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
}

const PACE_DAYS = 60

export function buildLearner(input: LearnerInput): LearnerOutput {
  const levels = new Map(input.cards.map(c => [c.id, levelFor(c.book, c.file)]))
  const evidence = evidenceFrom(input.attempts, input.reviews, id => levels.get(id) ?? input.level)
  const recent = input.now.getTime() - PACE_DAYS * 86_400_000
  const { model, check, params, tuned } = tune(evidence, input.level)
  return {
    model,
    check,
    params,
    tuned,
    fit: fitFsrs(input.reviews, input.timezoneOffset),
    perLetter: msPerLetter(input.reviews.filter(r => r.at.getTime() >= recent)),
    answers: evidence.length,
  }
}
