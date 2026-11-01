<script setup lang="ts">
import type { FixItCard } from '#shared/utils/fixit'
import { SPEED_SECONDS, speedQuestions, type SpeedQuestion } from '#shared/utils/quick'

// Speed Round: 60 seconds of Fix It sentences, each shown with its mistake or
// corrected. Right or wrong? One tap each; a wrong call shows the right
// sentence for a moment. Her best score is kept on this phone.
const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const BEST_KEY = 'rien-speed-best'
const RIGHT_PAUSE_MS = 450
const WRONG_PAUSE_MS = 1700

const loading = ref(true)
const loadError = ref(false)
const cards = ref<FixItCard[]>([])
const questions = ref<SpeedQuestion[]>([])
const index = ref(0)
const phase = ref<'ready' | 'playing' | 'done'>('ready')
const score = ref(0)
const answered = ref(0)
const feedback = ref<{ right: boolean, question: SpeedQuestion } | null>(null)
const best = ref(0)
const newBest = ref(false)
const { combo, best: bestCombo, cheer, hit, miss } = useCombo()
const clock = useCountdown(SPEED_SECONDS * 1000)
let pause: ReturnType<typeof setTimeout> | undefined

const current = computed(() => questions.value[index.value % Math.max(1, questions.value.length)])
const timeShare = computed(() => (clock.remaining.value / (SPEED_SECONDS * 1000)) * 100)
const seconds = computed(() => Math.ceil(clock.remaining.value / 1000))

onMounted(async () => {
  try {
    best.value = Number(localStorage.getItem(BEST_KEY)) || 0
  }
  catch {}
  try {
    const practice = await loadPractice()
    cards.value = practice.fixCards
    questions.value = speedQuestions(cards.value)
  }
  catch (error) {
    console.error('[rien] could not start Speed Round', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

onBeforeUnmount(() => clearTimeout(pause))

// A fresh order each go, with sentences shown right or wrong anew.
function start() {
  questions.value = speedQuestions(cards.value)
  index.value = 0
  score.value = 0
  answered.value = 0
  feedback.value = null
  newBest.value = false
  miss()
  clock.reset()
  clock.start()
  phase.value = 'playing'
}

watch(clock.finished, (over) => {
  if (!over || phase.value !== 'playing') return
  clearTimeout(pause)
  phase.value = 'done'
  if (score.value > best.value) {
    newBest.value = best.value > 0
    best.value = score.value
    try {
      localStorage.setItem(BEST_KEY, String(score.value))
    }
    catch {}
  }
  haptic('success')
  emit('done', { clean: score.value, total: answered.value })
})

function call(saysRight: boolean) {
  const question = current.value
  if (!question || feedback.value || phase.value !== 'playing') return
  const right = saysRight === question.correct
  answered.value++
  if (right) {
    score.value++
    hit()
    haptic('tap')
  }
  else {
    miss()
    haptic('error')
  }
  feedback.value = { right, question }
  pause = setTimeout(() => {
    feedback.value = null
    index.value++
  }, right ? RIGHT_PAUSE_MS : WRONG_PAUSE_MS)
}
</script>

<template>
  <section class="rien-stack">
    <SqSkeleton v-if="loading" height="260" />

    <SqAlert
      v-else-if="loadError || questions.length === 0"
      type="error"
      variant="tonal"
      title="Could not load the sentences"
      text="Open Rien once while online so it can save them for offline use."
    />

    <SqCard v-else-if="phase === 'ready'" class="rien-speed-intro">
      <SqCardText class="rien-stack rien-card-body">
        <span class="rien-speed-badge"><RienIcon name="speed-round" :size="34" weight="duotone" /></span>
        <h2>{{ SPEED_SECONDS }} seconds</h2>
        <p class="rien-muted">Is each sentence right or wrong? Answer as many as you can. A wrong call shows the right sentence for a moment.</p>
        <p v-if="best" class="rien-best-combo"><RienIcon name="goal" :size="18" weight="fill" /> Your best: {{ best }}</p>
      </SqCardText>
      <ActionBar>
        <SqBtn color="primary" size="large" @click="start">Start</SqBtn>
      </ActionBar>
    </SqCard>

    <template v-else-if="phase === 'playing' && current">
      <div class="rien-speed-top">
        <div class="rien-speed-clock" :class="{ 'is-low': seconds <= 10 }">
          <span class="rien-speed-time" :style="{ width: `${timeShare}%` }" />
        </div>
        <strong class="rien-speed-seconds" :class="{ 'is-low': seconds <= 10 }">{{ seconds }}s</strong>
        <span class="rien-speed-score">{{ score }}</span>
        <ComboChip :combo="combo" :cheer="cheer" />
      </div>

      <Transition name="rien-speed-card" mode="out-in">
        <SqCard
          :key="index"
          class="rien-speed-card"
          :class="feedback && (feedback.right ? 'is-right' : 'is-wrong')"
        >
          <SqCardText class="rien-card-body">
            <p class="rien-speed-sentence">{{ current.sentence }}</p>
            <div v-if="feedback && !feedback.right" class="rien-speed-fix">
              <strong>{{ feedback.question.correct ? 'It was right.' : 'It should be:' }}</strong>
              <span v-if="!feedback.question.correct">{{ feedback.question.fixed }}</span>
            </div>
          </SqCardText>
        </SqCard>
      </Transition>

      <div class="rien-speed-buttons">
        <button type="button" class="rien-speed-btn is-no" :disabled="!!feedback" @click="call(false)">
          <RienIcon name="close" :size="30" weight="bold" /> Wrong
        </button>
        <button type="button" class="rien-speed-btn is-yes" :disabled="!!feedback" @click="call(true)">
          <RienIcon name="check" :size="30" weight="bold" /> Right
        </button>
      </div>
    </template>

    <SqCard v-else-if="phase === 'done'" title="Time!" variant="tonal" class="rien-pop">
      <Confetti v-if="newBest || (answered > 0 && score === answered)" />
      <SqCardText>
        <p class="rien-big">{{ score }}</p>
        <p class="rien-muted">right out of {{ answered }} in {{ SPEED_SECONDS }} seconds.</p>
        <p v-if="newBest" class="rien-best-combo"><RienIcon name="goal" :size="18" weight="fill" /> New best!</p>
        <p v-else-if="best" class="rien-muted">Your best: {{ best }}</p>
        <p v-if="bestCombo >= 3" class="rien-best-combo"><RienIcon name="flame" :size="18" weight="fill" /> Best streak: {{ bestCombo }} in a row</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn variant="tonal" @click="start">Play again</SqBtn>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
      </SqCardActions>
    </SqCard>
  </section>
</template>
