import { achievementFish, skillFish, tankChanges } from '#shared/utils/tank'

// Everything the tank shows, worked out from her study history.
export async function loadTank(now = new Date()) {
  const db = useDb()
  const [sessions, words, learned, bosses, talks] = await Promise.all([
    db.sessions(),
    db.countCards(),
    db.countLearned(),
    db.bossResults(),
    db.talkResults(),
  ])
  const native = isNativeApp()
  return {
    skills: skillFish(sessions, now, native),
    awards: achievementFish({ sessions, words, learned, bosses, talks: talks.length, native }),
  }
}

// Messages shown across the top of the app ("Fixer grew…").
export function useToasts() {
  return useState<string[]>('rien-toasts', () => [])
}

// Runs an action and announces what it changed in the tank.
export async function withTankNews<T>(action: () => Promise<T>): Promise<T> {
  const before = await loadTank()
  const result = await action()
  const after = await loadTank()
  const news = tankChanges(before, after)
  if (news.length) useToasts().value.push(...news)
  return result
}
