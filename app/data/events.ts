import type { StudyRepository } from './repository'

export interface ObservableRepository extends StudyRepository {
  // Called after any write, so screens can re-run their queries.
  subscribe(listener: () => void): () => void
}

const WRITES = [
  'saveSettings',
  'addWord',
  'deleteCard',
  'setCardImage',
  'saveAnswer',
  'saveGrammarAnswer',
  'saveMistake',
  'saveAttempts',
  'saveWriting',
  'recordActivity',
  'saveBossResult',
  'saveTalk',
  'importAll',
] as const satisfies readonly (keyof StudyRepository)[]

export function withChangeEvents(repository: StudyRepository): ObservableRepository {
  const listeners = new Set<() => void>()
  const observable = Object.create(repository) as ObservableRepository

  for (const name of WRITES) {
    const write = repository[name] as (...args: unknown[]) => Promise<unknown>
    Object.defineProperty(observable, name, {
      value: async (...args: unknown[]) => {
        const result = await write.apply(repository, args)
        for (const listener of listeners) listener()
        return result
      },
    })
  }

  observable.subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return observable
}

// A repository that can be used straight away while the real one is still
// opening (the native SQLite database opens asynchronously).
export function lazyRepository(opening: Promise<StudyRepository>): StudyRepository {
  return new Proxy({} as StudyRepository, {
    get: (_, name: string) =>
      async (...args: unknown[]) => {
        const repository = await opening
        const method = repository[name as keyof StudyRepository] as (...a: unknown[]) => unknown
        return method.apply(repository, args)
      },
  })
}
