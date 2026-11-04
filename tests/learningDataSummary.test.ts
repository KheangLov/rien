import { describe, expect, it } from 'vitest'
import { LEARNER_HISTORY_DAYS, summarizeLearningData } from '#shared/utils/learningDataSummary'

const attempt = (itemId: string, skill: string) => ({ itemId, skill })
const report = (trained: boolean, active: boolean) => ({ report: { trained, active } })

describe('summarizeLearningData', () => {
  it('uses a one-year window', () => {
    expect(LEARNER_HISTORY_DAYS).toBe(365)
  })

  it('counts nothing for an empty history', () => {
    expect(summarizeLearningData([], [])).toEqual({
      attempts: 0, uniqueItems: 0, repeatedAttempts: 0, wordReviews: 0, skills: 0, trainingExamples: 0, mlState: 'not-trained',
    })
  })

  it('separates different questions from repeated ones', () => {
    const summary = summarizeLearningData([
      attempt('fix-1', 'articles'),
      attempt('fix-1', 'articles'),
      attempt('fix-1', 'articles'),
      attempt('sound-2', 'ed-endings'),
    ], [])
    expect(summary.attempts).toBe(4)
    expect(summary.uniqueItems).toBe(2)
    expect(summary.repeatedAttempts).toBe(2)
    expect(summary.skills).toBe(2)
  })

  it('counts vocabulary as a skill only when there are word reviews', () => {
    expect(summarizeLearningData([attempt('a', 'articles')], []).skills).toBe(1)
    const reviewsOnly = summarizeLearningData([], [{}, {}])
    expect(reviewsOnly.skills).toBe(1)
    expect(reviewsOnly.repeatedAttempts).toBe(0)
    expect(summarizeLearningData([attempt('a', 'articles')], [{}]).skills).toBe(2)
    // An attempt that already uses vocabulary is not counted twice.
    expect(summarizeLearningData([attempt('a', 'vocabulary')], [{}]).skills).toBe(1)
  })

  it('totals practice answers and word reviews', () => {
    const summary = summarizeLearningData([attempt('a', 'articles'), attempt('b', 'articles')], [{}, {}, {}])
    expect(summary.wordReviews).toBe(3)
    expect(summary.trainingExamples).toBe(5)
  })

  it('reports the model state', () => {
    expect(summarizeLearningData([], []).mlState).toBe('not-trained')
    expect(summarizeLearningData([], [], report(false, false)).mlState).toBe('not-trained')
    expect(summarizeLearningData([], [], report(true, false)).mlState).toBe('baseline')
    expect(summarizeLearningData([], [], report(true, true)).mlState).toBe('active')
  })
})
