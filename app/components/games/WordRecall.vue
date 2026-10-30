<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import { blankExample, checkAnswer, type Verdict } from '#shared/utils/answer'
import { gradeAnswer } from '#shared/utils/scheduler'
import { vPlainInput } from '~/directives/plainInput'

// Cards per session; FSRS decides which ones are due.
const SESSION_SIZE = 20
// A missed card comes back at most this many more times in one session.
const MAX_RETRIES = 2

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const loading = ref(true)
const khmerHints = ref(true)
const queue = ref<CardRow[]>([])
const retries = new Map<string, number>()
const position = ref(0)
const typed = ref('')
const verdict = ref<Verdict | null>(null)
const shownAt = ref(0)
const score = reactive({ right: 0, missed: new Set<string>() })
const answerField = ref<{ focus?: () => void } | null>(null)

const card = computed(() => queue.value[position.value])
const finished = computed(() => !loading.value && position.value >= queue.value.length)
const progress = computed(() =>
  queue.value.length ? Math.round((position.value / queue.value.length) * 100) : 0)
const blanked = computed(() =>
  card.value ? blankExample(card.value.example, card.value.answer) : undefined)
const showKhmer = computed(() =>
  Boolean(card.value?.khmer) && (khmerHints.value || (!card.value?.meaning && !blanked.value)))

onMounted(async () => {
  const [settings, due] = await Promise.all([
    db.getSettings(),
    db.dueCards(new Date(), SESSION_SIZE),
  ])
  khmerHints.value = settings.khmerHints
  queue.value = due
  loading.value = false
  startCard()
})

function startCard() {
  typed.value = ''
  verdict.value = null
  shownAt.value = performance.now()
  nextTick(() => answerField.value?.focus?.())
}

async function submit(giveUp = false) {
  const current = card.value
  if (!current || verdict.value) return
  if (!giveUp && !typed.value.trim()) return

  const result: Verdict = giveUp ? { result: 'wrong' } : checkAnswer(typed.value, current.answer)
  verdict.value = result
  const graded = gradeAnswer(current, result, typed.value, performance.now() - shownAt.value, new Date())
  // Keep the updated schedule for a retry later in this session.
  queue.value[position.value] = graded.card
  await db.saveAnswer(graded)

  if (result.result === 'wrong') {
    score.missed.add(current.id)
    const used = retries.get(current.id) ?? 0
    if (used < MAX_RETRIES) {
      retries.set(current.id, used + 1)
      queue.value.push(graded.card)
    }
  }
  else if (!score.missed.has(current.id)) {
    score.right++
  }
}

function next() {
  position.value++
  if (!finished.value) startCard()
}

const feedback = computed(() => {
  const v = verdict.value
  if (!v) return null
  if (v.result === 'correct') return { type: 'success' as const, title: 'Correct' }
  if (v.result === 'almost') return { type: 'warning' as const, title: v.hint ?? 'Nearly' }
  return { type: 'error' as const, title: v.hint ?? (typed.value.trim() ? 'Not quite' : 'Here it is') }
})
</script>

<template>
  <section class="rien-stack">
    <SqProgressLinear :model-value="progress" color="primary" />

    <SqSkeleton v-if="loading" height="200" />

    <SqEmptyState
      v-else-if="queue.length === 0"
      title="Nothing to review"
      text="Every word is resting. Add new ones after your next class."
    >
      <SqBtn to="/add-words" color="primary">Add words</SqBtn>
    </SqEmptyState>

    <SqCard v-else-if="finished" title="Session done" variant="tonal">
      <SqCardText>
        <p class="rien-big">{{ score.right }} / {{ score.right + score.missed.size }}</p>
        <p class="rien-muted">
          right first time.
          <template v-if="score.missed.size">
            The {{ score.missed.size === 1 ? 'word you missed comes' : `${score.missed.size} words you missed come` }} back soon.
          </template>
        </p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
        <SqBtn to="/add-words" variant="tonal">Add words</SqBtn>
      </SqCardActions>
    </SqCard>

    <SqCard v-else-if="card" :key="`${card.id}-${position}`">
      <SqCardText class="rien-stack rien-card-body">
        <p v-if="card.meaning" class="rien-cue">{{ card.meaning }}</p>
        <p v-if="showKhmer" class="rien-cue rien-khmer">{{ card.khmer }}</p>
        <p v-if="blanked" class="rien-example">{{ blanked }}</p>

        <form v-if="!verdict" class="rien-stack" @submit.prevent="submit()">
          <SqTextField
            ref="answerField"
            v-model="typed"
            v-plain-input
            label="Type the English word"
          />
          <div class="rien-row">
            <SqBtn type="submit" color="primary" size="large" :disabled="!typed.trim()">Check</SqBtn>
            <SqBtn variant="text" @click="submit(true)">I don't know</SqBtn>
          </div>
        </form>

        <template v-else>
          <SqAlert :type="feedback!.type" variant="tonal" :title="feedback!.title">
            <template v-if="verdict.result !== 'correct' && typed.trim()">
              You typed “{{ typed.trim() }}”.
            </template>
          </SqAlert>
          <p class="rien-answer">{{ card.answer }}</p>
          <p v-if="card.example" class="rien-example">{{ card.example }}</p>
          <p v-if="card.khmer && !showKhmer" class="rien-muted rien-khmer">{{ card.khmer }}</p>
          <div class="rien-row">
            <SqBtn color="primary" size="large" autofocus @click="next">Next</SqBtn>
            <SqBtn v-if="canSpeak" variant="tonal" @click="speak(card.answer)">Hear it</SqBtn>
          </div>
        </template>
      </SqCardText>
    </SqCard>
  </section>
</template>
