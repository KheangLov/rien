import type { StudyRepository } from './repository'

// Web only: backups are restored in a background thread (restore.worker.ts).
// The repository is used as it is for everything else, and for restores where
// a thread cannot start.
export function withBackgroundRestore(repository: StudyRepository): StudyRepository {
  const wrapped = Object.create(repository) as StudyRepository
  wrapped.importAll = async (raw) => {
    if (typeof raw !== 'string' || typeof Worker === 'undefined') return repository.importAll(raw)
    try {
      return await inBackground(raw)
    }
    catch (error) {
      if ((error as { invalid?: boolean }).invalid) throw error
      console.warn('[rien] restoring on the main thread', error)
      return repository.importAll(raw)
    }
  }
  return wrapped
}

function inBackground(text: string): Promise<{ cards: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/restore.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      worker.terminate()
      if (data.ok) resolve(data.result)
      else reject(Object.assign(new Error(data.error), { invalid: data.invalid }))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'restore thread failed'))
    }
    worker.postMessage(text)
  })
}
