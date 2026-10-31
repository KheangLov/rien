// A countdown that measures against the clock, so it stays right if the phone
// throttles timers. While running it asks the screen to stay on (where supported).
export function useCountdown(totalMs: number) {
  const remaining = ref(totalMs)
  const running = ref(false)
  let endAt = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let wakeLock: { release: () => Promise<void> } | undefined

  async function keepAwake(on: boolean) {
    try {
      if (on && !wakeLock) {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
        wakeLock = await nav.wakeLock?.request('screen')
      }
      else if (!on && wakeLock) {
        await wakeLock.release()
        wakeLock = undefined
      }
    }
    catch {
      // Not supported or refused: the timer still works, the screen may dim.
    }
  }

  function stopTimer() {
    clearInterval(timer)
    timer = undefined
    running.value = false
    void keepAwake(false)
  }

  function tick() {
    remaining.value = Math.max(0, endAt - Date.now())
    if (remaining.value === 0) stopTimer()
  }

  function start() {
    if (running.value || remaining.value === 0) return
    endAt = Date.now() + remaining.value
    running.value = true
    timer = setInterval(tick, 250)
    void keepAwake(true)
  }

  function pause() {
    if (!running.value) return
    tick()
    stopTimer()
  }

  // The wake lock is dropped when the app is hidden; take it again on return.
  function onVisible() {
    if (document.visibilityState === 'visible' && running.value) {
      tick()
      wakeLock = undefined
      void keepAwake(true)
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  onScopeDispose(() => {
    stopTimer()
    document.removeEventListener('visibilitychange', onVisible)
  })

  const elapsedMs = computed(() => totalMs - remaining.value)
  const label = computed(() => {
    const seconds = Math.ceil(remaining.value / 1000)
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  })

  return { remaining, running, elapsedMs, label, finished: computed(() => remaining.value === 0), start, pause }
}
