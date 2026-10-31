import { Capacitor } from '@capacitor/core'
import { createDexieRepository } from '~/data/dexie'
import { lazyRepository, withChangeEvents, type ObservableRepository } from '~/data/events'

let repository: ObservableRepository | undefined

// IndexedDB (Dexie) on the web; SQLite in the native iPhone app, where iOS
// may clear web storage when space runs low.
export function useDb(): ObservableRepository {
  repository ??= withChangeEvents(
    Capacitor.isNativePlatform()
      ? lazyRepository(import('~/data/native').then(m => m.openNativeRepository()))
      : createDexieRepository(),
  )
  return repository
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
