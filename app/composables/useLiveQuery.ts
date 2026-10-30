import { liveQuery, type Subscription } from 'dexie'
import type { WatchSource } from 'vue'

// Re-runs the query whenever the Dexie tables it reads change,
// and when `deps` changes (for example a clock, for due counts).
export function useLiveQuery<T>(query: () => Promise<T>, initial: T, deps?: WatchSource) {
  const value = shallowRef<T>(initial)
  let subscription: Subscription | undefined

  function subscribe() {
    subscription?.unsubscribe()
    subscription = liveQuery(query).subscribe({
      next: (result) => { value.value = result },
      error: (error) => { console.error('[rien] live query failed', error) },
    })
  }

  if (deps) watch(deps, subscribe)
  subscribe()
  onScopeDispose(() => subscription?.unsubscribe())
  return readonly(value)
}
