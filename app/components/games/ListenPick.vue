<script setup lang="ts">
import { listenQuestions, type ChoiceQuestion } from '#shared/utils/quick'
import QuickChoices from './QuickChoices.vue'
import QuickDone from './QuickDone.vue'

// Listen & Pick: hear a word, choose it from four that look alike. Her own
// words come first, topped up with picture words, so it works from day one.
const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const RIGHT_PAUSE_MS = 700
const WRONG_PAUSE_MS = 1600

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()
const loading = ref(true)
const loadError = ref(false)
const saved = ref<string[]>([])
const questions = ref<ChoiceQuestion[]>([])
const index = ref(0)
const picked = ref<string | null>(null)
const score = ref(0)
const finished = ref(false)
// Phones only read aloud after a first tap, so the first word waits for one.
const started = ref(false)
const { combo, best, cheer, hit, miss } = useCombo()
let pause: ReturnType<typeof setTimeout> | undefined

const current = computed(() => questions.value[index.value])
const progress = computed(() => (questions.value.length ? (index.value / questions.value.length) * 100 : 0))

async function load() {
  loading.value = true
  try {
    saved.value = (await db.allCards()).filter(card => card.type === 'word').map(card => card.answer)
  }
  catch (error) {
    console.error('[rien] could not start Listen & Pick', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
}

function newRound() {
  questions.value = listenQuestions(saved.value)
  index.value = 0
  score.value = 0
  picked.value = null
  finished.value = false
  miss()
}

onMounted(async () => {
  await load()
  newRound()
})
onBeforeUnmount(() => clearTimeout(pause))

function play(rate = 0.85) {
  if (!current.value) return
  started.value = true
  speak(current.value.answer, rate)
}

// When the current word was first played, for the answer's time.
let shownAt = performance.now()
watch(index, () => { shownAt = performance.now() })

function pick(option: string) {
  const question = current.value
  if (!question || picked.value !== null) return
  picked.value = option
  const right = option === question.answer
  const item = { itemId: `listen:${question.answer}`, skill: 'listening', level: 'A2' as const }
  void db.saveAttempts([attemptFor(item, 'listen', right ? 1 : 0, performance.now() - shownAt)]).catch(() => {})
  if (right) {
    score.value++
    hit()
    haptic('success')
  }
  else {
    miss()
    haptic('error')
    speak(question.answer)
  }
  pause = setTimeout(next, right ? RIGHT_PAUSE_MS : WRONG_PAUSE_MS)
}

function next() {
  picked.value = null
  index.value++
  if (index.value >= questions.value.length) {
    finished.value = true
    emit('done', { clean: score.value, total: questions.value.length })
    return
  }
  play()
}

function again() {
  newRound()
  play()
}
</script>

<template>
  <section class="rien-stack">
    <div class="rien-round-top">
      <SqProgressLinear :model-value="finished ? 100 : progress" color="primary" />
      <ComboChip :combo="combo" :cheer="cheer" />
    </div>

    <SqSkeleton v-if="loading" height="260" />

    <SqAlert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      title="Could not load your words"
      text="Try closing Rien and opening it again."
    />

    <SqAlert
      v-else-if="!canSpeak"
      type="warning"
      variant="tonal"
      title="This phone cannot read aloud here"
      text="Listen & Pick needs the phone's voice. Try it in the Rien app or another browser."
    />

    <QuickDone v-else-if="finished" :score="score" :total="questions.length" :best="best" note="Every word you heard is one your ear now knows a little better." @again="again" />

    <template v-else-if="current">
      <SqCard variant="tonal" class="rien-listen-card">
        <SqCardText class="rien-listen-body">
          <button type="button" class="rien-listen-play" :class="{ 'is-pulsing': !started }" aria-label="Play the word" @click="play()">
            <RienIcon name="volume" :size="44" weight="fill" />
          </button>
          <p class="rien-muted">{{ started ? 'Which word did you hear?' : 'Tap to hear the word' }}</p>
          <SqBtn v-if="started" variant="text" size="small" @click="play(0.6)">
            <RienIcon name="slower" :size="18" weight="bold" /> Slower
          </SqBtn>
        </SqCardText>
      </SqCard>

      <QuickChoices v-if="started" :options="current.options" :answer="current.answer" :picked="picked" @pick="pick" />
    </template>
  </section>
</template>
