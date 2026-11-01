<script setup lang="ts">
import { pictureQuestions, type ChoiceQuestion } from '#shared/utils/quick'
import QuickChoices from './QuickChoices.vue'
import QuickDone from './QuickDone.vue'

// Picture Match: see a picture, choose its word. Her own photos come first,
// then picture words (wrong choices from the same group: fruit with fruit).
// The right word is read aloud, so she hears it too.
const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const RIGHT_PAUSE_MS = 800
const WRONG_PAUSE_MS = 1600

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()
const loading = ref(true)
const loadError = ref(false)
const photos = ref<{ answer: string, image: string }[]>([])
const saved = ref<string[]>([])
const questions = ref<ChoiceQuestion[]>([])
const index = ref(0)
const picked = ref<string | null>(null)
const score = ref(0)
const finished = ref(false)
const { combo, best, cheer, hit, miss } = useCombo()
let pause: ReturnType<typeof setTimeout> | undefined

const current = computed(() => questions.value[index.value])
const progress = computed(() => (questions.value.length ? (index.value / questions.value.length) * 100 : 0))

function newRound() {
  questions.value = pictureQuestions(photos.value, saved.value)
  index.value = 0
  score.value = 0
  picked.value = null
  finished.value = false
  miss()
}

onMounted(async () => {
  try {
    const cards = (await db.allCards()).filter(card => card.type === 'word')
    saved.value = cards.map(card => card.answer)
    photos.value = cards.flatMap(card => (card.image ? [{ answer: card.answer, image: card.image }] : []))
  }
  catch (error) {
    console.error('[rien] could not start Picture Match', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
  newRound()
})
onBeforeUnmount(() => clearTimeout(pause))

// When the current picture appeared, for the answer's time.
let shownAt = performance.now()
watch(index, () => { shownAt = performance.now() })

function pick(option: string) {
  const question = current.value
  if (!question || picked.value !== null) return
  picked.value = option
  const right = option === question.answer
  // Her own photos are her own words; picture words are everyday A2 words.
  const item = { itemId: `word:${question.answer}`, skill: 'vocabulary', level: question.image ? 'A2+' as const : 'A2' as const }
  void db.saveAttempts([attemptFor(item, 'picture', right ? 1 : 0, performance.now() - shownAt)]).catch(() => {})
  if (right) {
    score.value++
    hit()
    haptic('success')
  }
  else {
    miss()
    haptic('error')
  }
  if (canSpeak) speak(question.answer)
  pause = setTimeout(next, right ? RIGHT_PAUSE_MS : WRONG_PAUSE_MS)
}

function next() {
  picked.value = null
  index.value++
  if (index.value >= questions.value.length) {
    finished.value = true
    emit('done', { clean: score.value, total: questions.value.length })
  }
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

    <QuickDone v-else-if="finished" :score="score" :total="questions.length" :best="best" note="Add a photo to a word in Words, and it shows up here too." @again="newRound" />

    <template v-else-if="current">
      <Transition name="rien-picture" mode="out-in">
        <Squircle :key="index" tag="figure" class="rien-picture" :radius="30" :class="picked && (picked === current.answer ? 'is-right' : 'is-wrong')">
          <img v-if="current.image" :src="current.image" alt="" class="rien-picture-photo">
          <span v-else class="rien-picture-emoji" aria-hidden="true">{{ current.emoji }}</span>
        </Squircle>
      </Transition>
      <p class="rien-muted rien-picture-ask">What is this?</p>
      <QuickChoices :options="current.options" :answer="current.answer" :picked="picked" @pick="pick" />
    </template>
  </section>
</template>
