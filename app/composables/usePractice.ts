import type { GrammarRow } from '#shared/schemas/db'
import { builderCards } from '#shared/utils/builder'
import { fixItCards, packsFor } from '#shared/utils/fixit'
import { radioCards } from '#shared/utils/radio'
import { soundCards } from '#shared/utils/sounds'
import { addDays } from '#shared/utils/streak'

// Mistakes from the last 30 days decide what comes up first.
export const WEAK_SPOT_DAYS = 30

// Everything a practice round needs: her settings, the pack items for her
// level, their review state and her recent mistakes.
export async function loadPractice(now = new Date()) {
  const db = useDb()
  const since = addDays(now, -WEAK_SPOT_DAYS)
  const [packs, settings, rows, counts] = await Promise.all([
    usePacks(),
    db.getSettings(),
    db.grammarStates(),
    db.mistakeCounts(since),
  ])
  const active = packsFor(packs, settings)
  return {
    now,
    since,
    settings,
    fixCards: fixItCards(active),
    soundCards: soundCards(active),
    builderCards: builderCards(active),
    radioCards: radioCards(active),
    states: new Map<string, GrammarRow>(rows.map(row => [row.itemId, row])),
    counts,
  }
}
