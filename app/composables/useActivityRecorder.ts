import { dateKey } from '#shared/utils/streak'

// Records a finished round towards today's session and the streak, with the
// minutes since the round started (capped, in case the app sat open).
export function useActivityRecorder() {
  const db = useDb()
  let startedAt = Date.now()

  return {
    restart() {
      startedAt = Date.now()
    },
    async record(game: string) {
      const minutes = Math.min(60, (Date.now() - startedAt) / 60_000)
      await db.recordActivity(dateKey(new Date()), game, minutes)
      startedAt = Date.now()
    },
  }
}
