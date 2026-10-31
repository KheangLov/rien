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
  const [queue, counts] = await Promise.all([
    loadWordQueue(now),
    db.mistakeCounts(addDays(now, -WEAK_SPOT_DAYS)),
  ])
  const plan = planSession({ dueWords: queue.length, mistakeCounts: counts, native: isNativeApp(), dayIndex: dayIndex(now) })
  try {
    localStorage.setItem(key, JSON.stringify(plan))
  }
  catch {}
  return plan
}
