/// <reference lib="webworker" />
import { RienDexie } from '../data/dexie'
import { buildLearner, type LearnerInput } from './learnerWork'

// Builds the skill model away from the main thread, so the screen never waits
// on it. On the web this thread reads her answer log from IndexedDB itself (a
// year of answers never passes through the main thread); the phone apps send
// it, since their SQLite lives behind a plugin only the main thread can call.

type Request = Omit<LearnerInput, 'attempts' | 'reviews' | 'cards'> & Partial<Pick<LearnerInput, 'attempts' | 'reviews' | 'cards'>> & { since: Date }

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    let { attempts, reviews, cards } = data
    if (!attempts || !reviews || !cards) {
      const db = new RienDexie()
      ;[attempts, reviews, cards] = await Promise.all([
        db.attempts.where('at').aboveOrEqual(data.since).toArray(),
        db.reviews.where('at').aboveOrEqual(data.since).toArray(),
        db.cards.toArray().then(rows => rows.map(({ id, book, file }) => ({ id, book, file }))),
      ])
      db.close()
    }
    self.postMessage({ ok: true, result: buildLearner({ ...data, attempts, reviews, cards }) })
  }
  catch (error) {
    self.postMessage({ ok: false, error: String(error) })
  }
}
