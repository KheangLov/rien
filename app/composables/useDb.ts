import { createDexieRepository } from '~/data/dexie'
import type { StudyRepository } from '~/data/repository'

let repository: StudyRepository | undefined

export function useDb(): StudyRepository {
  repository ??= createDexieRepository()
  return repository
}
