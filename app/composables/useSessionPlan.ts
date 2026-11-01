import { dayIndex, planSession, type ActivityId } from '#shared/utils/learning'
import { addDays, dateKey } from '#shared/utils/streak'

const storageKey = (date: string) => `rien-plan-${date}`
const skippedKey = (date: string) => `rien-skipped-${date}`

// Steps she skipped today. They finish the session but do not count as done
// for the streak or the done marks.
export function loadSkipped(now = new Date()): ActivityId[] {
  try {
    return JSON.parse(localStorage.getItem(skippedKey(dateKey(now))) ?? '[]') as ActivityId[]
  }
  catch {
    return []
  }
}

export function skipStep(id: ActivityId, now = new Date()) {
  try {
    const skipped = new Set(loadSkipped(now)).add(id)
    localStorage.setItem(skippedKey(dateKey(now)), JSON.stringify([...skipped]))
  }
  catch {}
}

// Answers the skill model needs before it chooses the session's practice.
export const MODEL_MIN_ANSWERS = 30

// Today's session, chosen once a day and remembered so it does not reshuffle
// while she works through it. Storage can fail (private mode); then it is
// simply worked out again.
export async function loadSessionPlan(now = new Date()): Promise<ActivityId[]> {
  const key = storageKey(dateKey(now))
  try {
    const saved = localStorage.getItem(key)
    if (saved) return JSON.parse(saved) as ActivityId[]
  }
  catch {}

  const db = useDb()
  const [queue, counts, learner] = await Promise.all([
    loadWordQueue(now),
    db.mistakeCounts(addDays(now, -WEAK_SPOT_DAYS)),
    useLearner().catch(() => undefined),
  ])
  // Once the skill model has enough answers, its weak skills (right and wrong
  // answers, fading with time) pick the practice; before that, raw slip counts.
  const weakness = learner && learner.answers >= MODEL_MIN_ANSWERS ? weaknessByType(learner, now) : counts
  const plan = planSession({ dueWords: queue.length, mistakeCounts: weakness, speech: canListen(), dayIndex: dayIndex(now) })
  try {
    localStorage.setItem(key, JSON.stringify(plan))
  }
  catch {}
  return plan
}
