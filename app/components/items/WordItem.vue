<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import { blankExample, checkAnswer, normalizeAnswer, type Verdict } from '#shared/utils/answer'
import { comesBackLabel, hintFor, maxHintLevel } from '#shared/utils/learning'
import { gradeAnswer } from '#shared/utils/scheduler'
import { vPlainInput } from '~/directives/plainInput'

// One word question: she sees the meaning and types the English word. A hint
// reveals letters (and caps the grade at Hard); after a miss she types the
// word once correctly, which fixes the right form in memory.
const props = defineProps<{ card: CardRow, khmerHints: boolean }>()
const emit = defineEmits<{
  answered: [answer: { card: CardRow, result: Verdict['result'] }]
  next: []
}>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const typed = ref('')
const retyped = ref('')
const hintLevel = ref(0)
const verdict = ref<Verdict | null>(null)
const comesBack = ref('')
const shownAt = performance.now()
const answerField = ref<{ focus?: () => void } | null>(null)
const retypeField = ref<{ focus?: () => void } | null>(null)

const blanked = computed(() => blankExample(props.card.example, props.card.answer))
const showKhmer = computed(() =>
  Boolean(props.card.khmer) && (props.khmerHints || (!props.card.meaning && !blanked.value)))
const canHint = computed(() => hintLevel.value < maxHintLevel(props.card.answer))
const needsRetype = computed(() => verdict.value?.result === 'wrong')
const retypeOk = computed(() => normalizeAnswer(retyped.value) === normalizeAnswer(props.card.answer))

onMounted(() => answerField.value?.focus?.())

function hint() {
  if (!canHint.value) return
  hintLevel.value++
  haptic('tap')
  answerField.value?.focus?.()
}

async function submit(giveUp = false) {
  if (verdict.value) return
  if (!giveUp && !typed.value.trim()) return
  let result: Verdict = giveUp ? { result: 'wrong' } : checkAnswer(typed.value, props.card.answer)
  if (result.result === 'correct' && hintLevel.value > 0) result = { result: 'almost', hint: 'Right, with a hint' }
  verdict.value = result
  haptic(result.result === 'correct' ? 'success' : result.result === 'almost' ? 'warning' : 'error')
  const graded = gradeAnswer(props.card, result, typed.value, performance.now() - shownAt, new Date())
  comesBack.value = comesBackLabel(graded.card.due, new Date())
  await db.saveAnswer(graded)
  emit('answered', { card: graded.card, result: result.result })
  if (result.result === 'wrong') nextTick(() => retypeField.value?.focus?.())
}

function next() {
  if (needsRetype.value && !retypeOk.value) return
  emit('next')
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
  <SqCard class="rien-rise">
    <Squircle v-if="card.image" :radius="20" :surface="false" class="rien-word-image-wrap">
      <img :src="card.image" alt="" class="rien-word-image">
    </Squircle>
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
        <p v-if="hintLevel > 0" class="rien-hint" aria-live="polite">{{ hintFor(card.answer, hintLevel) }}</p>
        <div class="rien-row">
          <SqBtn variant="text" :disabled="!canHint" @click="hint">{{ hintLevel ? 'Another letter' : 'Hint' }}</SqBtn>
          <SqBtn variant="text" @click="submit(true)">I don't know</SqBtn>
        </div>
        <ActionBar>
          <SqBtn color="primary" size="large" :disabled="!typed.trim()" @click="submit()">Check</SqBtn>
        </ActionBar>
      </form>

      <template v-else>
        <SqAlert
          :type="feedback!.type"
          variant="tonal"
          :title="feedback!.title"
          :class="verdict.result === 'wrong' ? 'rien-shake' : 'rien-pop'"
        >
          <template v-if="verdict.result !== 'correct' && typed.trim()">
            You typed “{{ typed.trim() }}”.
          </template>
        </SqAlert>
        <p class="rien-answer rien-pop">{{ card.answer }}</p>
        <p class="rien-next-review"><RienIcon name="sparkles" :size="16" />{{ comesBack }}</p>
        <p v-if="card.example" class="rien-example">{{ card.example }}</p>
        <p v-if="card.khmer && !showKhmer" class="rien-muted rien-khmer">{{ card.khmer }}</p>

        <form v-if="needsRetype" class="rien-stack" @submit.prevent="next">
          <SqTextField
            ref="retypeField"
            v-model="retyped"
            v-plain-input
            label="Type it once to remember it"
            :error-messages="retyped.trim() && !retypeOk ? 'Not yet. Copy it letter by letter.' : undefined"
          />
        </form>

        <ActionBar>
          <SqBtn color="primary" size="large" :disabled="needsRetype && !retypeOk" @click="next">
            {{ needsRetype && !retypeOk ? 'Type the word to continue' : 'Next' }}
          </SqBtn>
          <SqBtn v-if="canSpeak" variant="tonal" size="large" aria-label="Hear it" @click="speak(card.answer)">
            <RienIcon name="sound-hunter" />
          </SqBtn>
        </ActionBar>
      </template>
    </SqCardText>
  </SqCard>
</template>
