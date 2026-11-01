import { Capacitor } from '@capacitor/core'
import type { AttemptKind, Level, MistakeType } from '#shared/schemas/db'
import { learn, skillReport, suitability, workingLevel, type Evidence, type Model, type SkillReport } from '#shared/utils/mastery'
import { applyFsrsParams, DEFAULT_MS_PER_LETTER } from '#shared/utils/scheduler'
import { levelFor, mistakeTypeOf } from '#shared/utils/skills'
import { addDays } from '#shared/utils/streak'
import type { LearnerInput, LearnerOutput } from '~/workers/learnerWork'

// The skill model for this run of the app (shared/utils/mastery.ts): built once
// from her answer log in a background thread, then updated in memory as she
// answers, so it is always current without being rebuilt.

export interface Learner {
  model: Model
  // Her book and File's level.
  level: Level
  // Her usual time per letter for a typed word (grading speed).
  perLetter: number
  answers: number
}

// A year of answers is plenty; older ones have faded from the model anyway.
const HISTORY_DAYS = 365

let building: Promise<Learner> | undefined
let current: Learner | undefined

export function useLearner(): Promise<Learner> {
  building ??= build().then((learner) => {
    current = learner
    return learner
  })
  return building
}

// The model if it is ready, without waiting (for grading as she types).
export function learnerNow(): Learner | undefined {
  return current
}

// Forget the model, e.g. after a backup is restored; it rebuilds on next use.
export function resetLearner(): void {
  building = undefined
  current = undefined
}

// One answer, learned straight away.
export function learnerHeard(evidence: Evidence): void {
  if (current) learn(current.model, evidence)
  else void building?.then(learner => learn(learner.model, evidence))
}

// The attempt row for an answer, and the same answer for the model.
export function attemptFor(item: { itemId: string, skill: string, level: Level }, kind: AttemptKind, score: number, ms: number, at = new Date()) {
  const attempt = { itemId: item.itemId, kind, skill: item.skill, level: item.level, score: Math.min(1, Math.max(0, score)), ms: Math.max(0, Math.round(ms)), at }
  learnerHeard(attempt)
  return attempt
}

// How well an unseen item suits her now (for pickRound), once the model is ready.
export function rankWith(learner: Learner | undefined, now: Date) {
  return learner ? (item: { itemId: string, skill: string, level: Level }) => suitability(learner.model, item, now) : undefined
}

export function weakSkills(learner: Learner, now: Date): SkillReport[] {
  return skillReport(learner.model, learner.level, now)
}

export const workingLevelOf = (learner: Learner) => workingLevel(learner.model)

// Weakness per mistake type, for the daily session plan: skills she gets right
// less than 75% of the time, weighted by how far below that and how sure the
// model is. Empty until the model has evidence.
export function weaknessByType(learner: Learner, now: Date): Partial<Record<MistakeType, number>> {
  const out: Partial<Record<MistakeType, number>> = {}
  for (const s of weakSkills(learner, now)) {
    if (s.p >= 0.75 || s.skill === 'vocabulary') continue
    const type = mistakeTypeOf(s.skill)
    out[type] = (out[type] ?? 0) + (0.75 - s.p) * Math.min(10, s.n)
  }
  return out
}

async function build(): Promise<Learner> {
  const db = useDb()
  const settings = await db.getSettings()
  // Her fitted FSRS parameters from last time apply at once; the new fit below
  // replaces them when it is ready.
  applyFsrsParams(settings.fsrsParams)
  const now = new Date()
  const since = addDays(now, -HISTORY_DAYS)
  const level = levelFor(settings.book, settings.file)
  const base = { level, now, since, timezoneOffset: now.getTimezoneOffset() }

  let output: LearnerOutput
  try {
    // The phone apps read SQLite here (only the main thread can call the
    // plugin); on the web the background thread reads IndexedDB itself.
    const data = Capacitor.isNativePlatform()
      ? {
          attempts: await db.attemptsSince(since),
          reviews: await db.reviewsSince(since),
          cards: (await db.allCards()).map(({ id, book, file }) => ({ id, book, file })),
        }
      : {}
    output = await inBackground({ ...base, ...data })
  }
  catch (error) {
    console.warn('[rien] skill model built on the main thread', error)
    const { buildLearner } = await import('~/workers/learnerWork')
    output = buildLearner({
      ...base,
      attempts: await db.attemptsSince(since),
      reviews: await db.reviewsSince(since),
      cards: (await db.allCards()).map(({ id, book, file }) => ({ id, book, file })),
    })
  }

  if (output.fit) {
    applyFsrsParams(output.fit.params)
    const changed = output.fit.params.some((w, i) => w !== settings.fsrsParams?.[i])
    if (changed) await db.saveSettings({ fsrsParams: output.fit.params, fsrsFittedAt: now })
  }
  return { model: output.model, level, perLetter: output.perLetter || DEFAULT_MS_PER_LETTER, answers: output.answers }
}

function inBackground(input: Partial<LearnerInput> & Omit<LearnerInput, 'attempts' | 'reviews' | 'cards'> & { since: Date }): Promise<LearnerOutput> {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') return reject(new Error('no Worker'))
    const worker = new Worker(new URL('../workers/learner.worker.ts', import.meta.url), { type: 'module' })
    const done = () => worker.terminate()
    worker.onmessage = ({ data }) => {
      done()
      if (data.ok) resolve(data.result)
      else reject(new Error(data.error))
    }
    worker.onerror = (event) => {
      done()
      reject(new Error(event.message || 'worker failed'))
    }
    worker.postMessage(input)
  })
}
