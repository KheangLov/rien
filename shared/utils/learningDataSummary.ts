// A plain count of the answers Rien's models can learn from, for Settings.
// Only totals and a coarse model state; never items, answers or weights.
import type { AttemptRow, Settings } from '#shared/schemas/db'

// A year of answers is plenty; older ones have faded from the model anyway.
// The learner model (app/composables/useLearner.ts) and Settings both use it,
// so the summary counts exactly what the model sees.
export const LEARNER_HISTORY_DAYS = 365

type MlState = 'not-trained' | 'baseline' | 'active'

export interface LearningDataSummary {
  attempts: number
  uniqueItems: number
  repeatedAttempts: number
  wordReviews: number
  skills: number
  trainingExamples: number
  mlState: MlState
}

export function summarizeLearningData(
  attempts: readonly Pick<AttemptRow, 'itemId' | 'skill'>[],
  reviews: readonly unknown[],
  mlModel?: Pick<NonNullable<Settings['mlModel']>, 'report'>,
): LearningDataSummary {
  const items = new Set<string>()
  const skills = new Set<string>()
  for (const attempt of attempts) {
    items.add(attempt.itemId)
    skills.add(attempt.skill)
  }
  if (reviews.length) skills.add('vocabulary')
  const report = mlModel?.report
  return {
    attempts: attempts.length,
    uniqueItems: items.size,
    repeatedAttempts: attempts.length - items.size,
    wordReviews: reviews.length,
    skills: skills.size,
    trainingExamples: attempts.length + reviews.length,
    mlState: !report?.trained ? 'not-trained' : report.active ? 'active' : 'baseline',
  }
}
