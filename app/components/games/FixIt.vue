<script setup lang="ts">
import { MISTAKE_LABELS, type GrammarRow, type MistakeType } from '#shared/schemas/db'
import {
  correctedText,
  fixItCards,
  gradeFixIt,
  packsFor,
  pickFixItRound,
  tokenize,
  wrongIndex,
  type FixItCard,
} from '#shared/utils/fixit'
import { addDays } from '#shared/utils/streak'

const ROUND_SIZE = 8
// After this many wrong taps the mistake is shown, so she is never stuck.
const MAX_WRONG_TAPS = 2
// Mistakes from the last 30 days decide which types come up first.
const WEAK_SPOT_DAYS = 30

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const loading = ref(true)
const loadError = ref(false)
const round = ref<FixItCard[]>([])
const states = new Map<string, GrammarRow>()
const position = ref(0)
const phase = ref<'find' | 'choose' | 'result'>('find')
const wrongTaps = ref<number[]>([])
const choices = ref<string[]>([])
const picked = ref<string | null>(null)
const clean = ref(0)
const missedTypes = ref<MistakeType[]>([])

const card = computed(() => round.value[position.value])
const tokens = computed(() => (card.value ? tokenize(card.value.text) : []))
const target = computed(() => (card.value ? wrongIndex(card.value) : -1))
const finished = computed(() => !loading.value && round.value.length > 0 && position.value >= round.value.length)
const progress = computed(() =>
  round.value.length ? Math.round((position.value / round.value.length) * 100) : 0)
const fixedRight = computed(() => picked.value === card.value?.fix)

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

onMounted(async () => {
  try {
    const now = new Date()
    const [packs, settings, rows, counts] = await Promise.all([
      usePacks(),
      db.getSettings(),
      db.grammarStates(),
      db.mistakeCounts(addDays(now, -WEAK_SPOT_DAYS)),
    ])
    for (const row of rows) states.set(row.itemId, row)
    round.value = pickFixItRound(fixItCards(packsFor(packs, settings)), states, counts, now, ROUND_SIZE)
  }
  catch (error) {
    console.error('[rien] could not start Fix It', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function startCard() {
  phase.value = 'find'
  wrongTaps.value = []
  picked.value = null
}

function openChoices() {
  phase.value = 'choose'
  choices.value = shuffle([card.value!.fix, ...card.value!.distractors])
}

function tap(index: number) {
  if (phase.value !== 'find') return
  if (index === target.value) return openChoices()
  if (!wrongTaps.value.includes(index)) wrongTaps.value.push(index)
  if (wrongTaps.value.length >= MAX_WRONG_TAPS) openChoices()
}

async function choose(choice: string) {
  const current = card.value
  if (!current || phase.value !== 'choose') return
  picked.value = choice
  phase.value = 'result'

  const result = { wrongTaps: wrongTaps.value.length, wrongChoice: choice !== current.fix }
  const { row, mistake } = gradeFixIt(current, states.get(current.itemId), result, new Date())
  states.set(row.itemId, row)
  if (mistake) missedTypes.value.push(mistake.type)
  else clean.value++
  await db.saveGrammarAnswer(row, mistake)
}

function next() {
  position.value++
  if (finished.value) emit('done', { clean: clean.value, total: round.value.length })
  else startCard()
}

const practiceLabels = computed(() =>
  [...new Set(missedTypes.value)].map(type => MISTAKE_LABELS[type]))
</script>

<template>
  <section class="rien-stack">
    <SqProgressLinear :model-value="progress" color="primary" />

    <SqSkeleton v-if="loading" height="200" />

    <SqAlert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      title="Could not load the sentences"
      text="Open Rien once while online so it can save them for offline use."
    />

    <SqEmptyState
      v-else-if="round.length === 0"
      title="All caught up"
      text="You have practised every sentence for now. They come back when they are due."
    />

    <SqCard v-else-if="finished" title="Round done" variant="tonal">
      <SqCardText>
        <p class="rien-big">{{ clean }} / {{ round.length }}</p>
        <p class="rien-muted">fixed without a slip.</p>
        <p v-if="practiceLabels.length" class="rien-muted">
          To practise: {{ practiceLabels.join(', ') }}. These come up more often from now on.
        </p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
      </SqCardActions>
    </SqCard>

    <SqCard v-else-if="card" :key="`${card.itemId}-${position}`">
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
          <p class="rien-sentence-fixed">{{ correctedText(card) }}</p>
          <p class="rien-muted rien-strike">{{ card.text }}</p>
          <div class="rien-row">
            <SqBtn color="primary" size="large" @click="next">Next</SqBtn>
            <SqBtn v-if="canSpeak" variant="tonal" @click="speak(correctedText(card))">Hear it</SqBtn>
          </div>
        </template>
      </SqCardText>
    </SqCard>
  </section>
</template>
