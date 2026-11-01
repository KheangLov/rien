/// <reference lib="webworker" />
import { createDexieRepository, RienDexie } from '../data/dexie'

// Restores a backup away from the main thread: reading the JSON, checking it
// and writing a year of answers to IndexedDB held the screen for over half a
// second on a phone-speed CPU. Receives the file's text; replies with the
// number of words restored, or why the file was refused.
self.onmessage = async ({ data }: MessageEvent<string>) => {
  const db = new RienDexie()
  try {
    let backup: unknown
    try {
      backup = JSON.parse(data)
    }
    catch {
      self.postMessage({ ok: false, invalid: true, error: 'This file is not a Rien backup.' })
      return
    }
    self.postMessage({ ok: true, result: await createDexieRepository(db).importAll(backup) })
  }
  catch (error) {
    // A file that is not a valid backup is refused, not retried elsewhere.
    self.postMessage({ ok: false, invalid: (error as Error)?.name === 'ZodError', error: String(error) })
  }
  finally {
    db.close()
  }
}
