import { limitNew } from '#shared/utils/learning'

// The words for one Word Recall round: everything due for review, plus new
// words up to what is left of today's new-word allowance.
export async function loadWordQueue(now = new Date(), limit?: number) {
  const db = useDb()
  const settings = await db.getSettings()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [due, introduced] = await Promise.all([
    db.dueCards(now, 500),
    db.countIntroducedSince(startOfDay),
  ])
  return limitNew(due, settings.newPerDay - introduced, limit ?? settings.dailyGoal)
}
