<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import { blankExample, checkAnswer, type Verdict } from '#shared/utils/answer'
import { gradeAnswer } from '#shared/utils/scheduler'
import { vPlainInput } from '~/directives/plainInput'

// One word question: she sees the meaning and types the English word.
const props = defineProps<{ card: CardRow, khmerHints: boolean }>()
const emit = defineEmits<{
  answered: [answer: { card: CardRow, result: Verdict['result'] }]
  next: []
}>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const typed = ref('')
const verdict = ref<Verdict | null>(null)
const shownAt = performance.now()
const answerField = ref<{ focus?: () => void } | null>(null)

const blanked = computed(() => blankExample(props.card.example, props.card.answer))
const showKhmer = computed(() =>
  Boolean(props.card.khmer) && (props.khmerHints || (!props.card.meaning && !blanked.value)))

onMounted(() => answerField.value?.focus?.())

async function submit(giveUp = false) {
  if (verdict.value) return
  if (!giveUp && !typed.value.trim()) return
  const result: Verdict = giveUp ? { result: 'wrong' } : checkAnswer(typed.value, props.card.answer)
  verdict.value = result
  const graded = gradeAnswer(props.card, result, typed.value, performance.now() - shownAt, new Date())
  await db.saveAnswer(graded)
  emit('answered', { card: graded.card, result: result.result })
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
  <SqCard>
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
          <SqBtn color="primary" size="large" @click="emit('next')">Next</SqBtn>
          <SqBtn v-if="canSpeak" variant="tonal" @click="speak(card.answer)">Hear it</SqBtn>
        </div>
      </template>
    </SqCardText>
  </SqCard>
</template>
