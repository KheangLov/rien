// Listens for as long as she talks (IELTS Speaking answers run up to two
// minutes): speech recognition stops at each pause, so this starts it again
// until she taps Done, collecting what was heard.
export function useLongListen() {
  const { supported, ensurePermission, listen, stop } = useListen()
  const settings = useLiveQuery(() => useDb().getSettings(), null)
  const parts = ref<string[]>([])
  const partial = ref('')
  const listening = ref(false)
  const error = ref<string | null>(null)
  let startedAt = 0
  let seconds = 0

  const transcript = computed(() => [...parts.value, partial.value].filter(Boolean).join(' '))

  async function start() {
    error.value = null
    if (!(await ensurePermission())) {
      error.value = 'Rien needs the microphone and speech recognition. Allow them in your phone\'s Settings.'
      return
    }
    parts.value = []
    partial.value = ''
    listening.value = true
    startedAt = performance.now()
    while (listening.value) {
      try {
        const heard = await listen((text) => { partial.value = text }, { online: settings.value?.speechOnline, maxSeconds: 55 })
        const best = heard.alternatives[0]
        if (best) parts.value.push(best)
        partial.value = ''
      }
      catch (e) {
        const reason = (e as Error).message
        // Silence just means she paused; anything else stops listening.
        if (reason !== 'no-speech' && reason !== 'aborted' && listening.value) {
          error.value = reason === 'not-allowed' ? 'The microphone is blocked. Allow it in your browser or phone settings.' : 'Listening stopped. Tap to try again.'
          break
        }
      }
    }
    if (partial.value) parts.value.push(partial.value)
    partial.value = ''
    seconds = (performance.now() - startedAt) / 1000
    listening.value = false
  }

  // Stops listening; returns how long she talked, in seconds.
  async function finish(): Promise<number> {
    const end = (performance.now() - startedAt) / 1000
    listening.value = false
    await stop()
    seconds = end
    return end
  }

  return { supported, listening, transcript, error, start, finish, seconds: () => seconds }
}
