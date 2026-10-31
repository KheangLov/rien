<script setup lang="ts">
import { MISTAKE_LABELS, type GrammarRow } from '#shared/schemas/db'
import { correctedText, gradeFixIt, tokenize, wrongIndex, type FixItCard } from '#shared/utils/fixit'
import { shuffle } from '#shared/utils/rounds'

// After this many wrong taps the mistake is shown, so she is never stuck.
const MAX_WRONG_TAPS = 2

// One Fix It sentence: tap the wrong word, then choose the fix.
const props = defineProps<{ card: FixItCard, previous?: GrammarRow }>()
const emit = defineEmits<{
  answered: [answer: { row: GrammarRow, slipped: boolean }]
  next: []
}>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const phase = ref<'find' | 'choose' | 'result'>('find')
const wrongTaps = ref<number[]>([])
const choices = ref<string[]>([])
const picked = ref<string | null>(null)

const tokens = computed(() => tokenize(props.card.text))
const target = computed(() => wrongIndex(props.card))
const fixedRight = computed(() => picked.value === props.card.fix)
const fixed = computed(() => correctedText(props.card))

function openChoices() {
  phase.value = 'choose'
  choices.value = shuffle([props.card.fix, ...props.card.distractors])
}

function tap(index: number) {
  if (phase.value !== 'find') return
  if (index === target.value) return openChoices()
  haptic('warning')
  if (!wrongTaps.value.includes(index)) wrongTaps.value.push(index)
  if (wrongTaps.value.length >= MAX_WRONG_TAPS) openChoices()
}

async function choose(choice: string) {
  if (phase.value !== 'choose') return
  picked.value = choice
  phase.value = 'result'
  const result = { wrongTaps: wrongTaps.value.length, wrongChoice: choice !== props.card.fix }
  const { row, mistake } = gradeFixIt(props.card, props.previous, result, new Date())
  haptic(!mistake ? 'success' : result.wrongChoice ? 'error' : 'warning')
  await db.saveGrammarAnswer(row, mistake)
  emit('answered', { row, slipped: Boolean(mistake) })
}
</script>

<template>
  <SqCard>
    <SqCardText class="rien-stack rien-card-body">
      <p class="rien-muted">
        {{ phase === 'find' ? 'Tap the word with the mistake.' : phase === 'choose' ? 'Choose the fix.' : MISTAKE_LABELS[card.type] }}
      </p>

      <p v-if="phase !== 'result'" class="rien-sentence" :aria-label="card.text">
        <button
          v-for="(token, index) in tokens"
          :key="index"
          type="button"
          class="rien-token"
          :class="{
            'is-wrong': wrongTaps.includes(index),
            'is-target': phase === 'choose' && index === target,
          }"
          :disabled="phase !== 'find'"
          @click="tap(index)"
        >
          {{ token }}
        </button>
      </p>

      <div v-if="phase === 'choose'" class="rien-choices">
        <SqBtn
          v-for="choice in choices"
          :key="choice"
          variant="tonal"
          size="large"
          @click="choose(choice)"
        >
          {{ choice }}
        </SqBtn>
      </div>

      <template v-if="phase === 'result'">
        <SqAlert
          :type="fixedRight && wrongTaps.length === 0 ? 'success' : fixedRight ? 'warning' : 'error'"
          variant="tonal"
          :title="fixedRight ? (wrongTaps.length === 0 ? 'Correct' : 'Fixed, after a search') : `Not “${picked}”`"
          :text="card.explain"
        />
        <p class="rien-sentence-fixed">{{ fixed }}</p>
        <p class="rien-muted rien-strike">{{ card.text }}</p>
        <div class="rien-row rien-actions">
          <SqBtn color="primary" size="large" @click="emit('next')">Next</SqBtn>
          <SqBtn v-if="canSpeak" variant="tonal" size="large" aria-label="Hear it" @click="speak(fixed)"><RienIcon name="sound-hunter" /></SqBtn>
        </div>
      </template>
    </SqCardText>
  </SqCard>
</template>
