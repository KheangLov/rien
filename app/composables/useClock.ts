// A clock that ticks once a minute and when the app comes back to the foreground,
// so "due" counts stay current without a reload.
export function useClock(intervalMs = 60_000) {
  const now = shallowRef(new Date())
  const tick = () => { now.value = new Date() }
  const timer = setInterval(tick, intervalMs)
  const onVisible = () => { if (document.visibilityState === 'visible') tick() }
  document.addEventListener('visibilitychange', onVisible)
  onScopeDispose(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
  return readonly(now)
}
