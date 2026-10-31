import type { WatchSource } from 'vue'

// Re-runs the query after every write to the study data, and when `deps`
// changes (for example a clock, for due counts).
export function useLiveQuery<T>(query: () => Promise<T>, initial: T, deps?: WatchSource) {
  const db = useDb()
  const value = shallowRef<T>(initial)
  let latest = 0

  async function refresh() {
    const run = ++latest
    try {
      const result = await query()
      // Ignore a slower, older run that finishes after a newer one.
      if (run === latest) value.value = result
    }
    catch (error) {
      console.error('[rien] live query failed', error)
    }
  }

  const unsubscribe = db.subscribe(refresh)
  if (deps) watch(deps, refresh)
  void refresh()
  onScopeDispose(unsubscribe)
  return readonly(value)
}
