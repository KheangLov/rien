<script setup lang="ts">
// Day 1 check from the plan: does reading aloud and speech recognition work on her
// iPhone, in a Safari tab and from the Home Screen? Every call starts from a tap.

type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string, confidence: number }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

const log = ref<string[]>([])
const heard = ref('')
const listening = ref(false)
const testWord = ref('She wanted two apples.')

const env = reactive({
  standalone: false,
  ttsSupported: false,
  sttSupported: false,
  voices: 0,
  englishVoices: 0,
  userAgent: '',
})

function note(line: string) {
  log.value.push(`${new Date().toLocaleTimeString()}  ${line}`)
}

function countVoices() {
  const voices = window.speechSynthesis?.getVoices() ?? []
  env.voices = voices.length
  env.englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en')).length
}

onMounted(() => {
  env.standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  env.ttsSupported = 'speechSynthesis' in window
  env.sttSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  env.userAgent = navigator.userAgent
  if (env.ttsSupported) {
    countVoices()
    window.speechSynthesis.addEventListener('voiceschanged', countVoices)
  }
})

function speak() {
  if (!env.ttsSupported) return note('Read aloud: not supported')
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(testWord.value)
  u.lang = 'en-US'
  u.rate = 0.9
  u.onstart = () => note('Read aloud: started')
  u.onend = () => note('Read aloud: finished')
  u.onerror = e => note(`Read aloud: error (${e.error})`)
  window.speechSynthesis.speak(u)
  countVoices()
}

function listen() {
  const Ctor = (window as unknown as { SpeechRecognition?: new () => Recognition, webkitSpeechRecognition?: new () => Recognition })
  const Recognizer = Ctor.SpeechRecognition ?? Ctor.webkitSpeechRecognition
  if (!Recognizer) return note('Recognition: not supported here')

  // Do not start the microphone while audio is playing (known iOS hang).
  window.speechSynthesis?.cancel()

  // Always a fresh recognizer per attempt.
  const rec = new Recognizer()
  rec.lang = 'en-US'
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.onresult = (e) => {
    const alts = Array.from(e.results[0] ?? [])
    heard.value = alts.map(a => a.transcript).join(' | ')
    note(`Recognition: heard "${alts[0]?.transcript ?? ''}" (confidence ${alts[0]?.confidence?.toFixed(2) ?? '?'})`)
  }
  rec.onerror = e => note(`Recognition: error (${e.error})`)
  rec.onend = () => {
    listening.value = false
    note('Recognition: ended')
  }
  try {
    rec.start()
    listening.value = true
    heard.value = ''
    note('Recognition: listening…')
  }
  catch (err) {
    note(`Recognition: failed to start (${(err as Error).message})`)
  }
}

const report = computed(() => [
  `Opened from: ${env.standalone ? 'Home Screen' : 'browser tab'}`,
  `Read aloud supported: ${env.ttsSupported ? 'yes' : 'no'} (voices ${env.voices}, English ${env.englishVoices})`,
  `Recognition supported: ${env.sttSupported ? 'yes' : 'no'}`,
  `Last heard: ${heard.value || '—'}`,
  `Browser: ${env.userAgent}`,
  '',
  ...log.value,
].join('\n'))

async function copyReport() {
  try {
    await navigator.clipboard.writeText(report.value)
    note('Report copied')
  }
  catch {
    note('Copy failed: select the text below instead')
  }
}
</script>

<template>
  <main class="rien-page">
    <div class="rien-row">
      <SqBtn to="/" variant="text">← Back</SqBtn>
    </div>

    <SqCard title="Speech test" subtitle="Run once in Safari and once from the Home Screen">
      <SqCardText>
        <SqTextField v-model="testWord" label="Sentence to test" />
      </SqCardText>
      <SqCardActions>
        <SqBtn color="primary" @click="speak">1. Read it aloud</SqBtn>
        <SqBtn color="secondary" :disabled="listening" @click="listen">
          {{ listening ? 'Listening…' : '2. Say it' }}
        </SqBtn>
      </SqCardActions>
    </SqCard>

    <SqAlert v-if="heard" type="success" variant="tonal" title="What the phone heard" :text="heard" />
    <SqAlert
      v-if="!env.sttSupported"
      type="warning"
      variant="tonal"
      text="Speech recognition is not available here. In the Home Screen app this is expected on iPhone; Say It will move to the native app."
    />

    <SqCard title="Report" variant="outlined">
      <SqCardText>
        <pre class="rien-log">{{ report }}</pre>
      </SqCardText>
      <SqCardActions>
        <SqBtn variant="tonal" @click="copyReport">Copy report</SqBtn>
      </SqCardActions>
    </SqCard>
  </main>
</template>
