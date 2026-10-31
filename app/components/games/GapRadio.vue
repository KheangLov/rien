<script setup lang="ts">
import type { GrammarRow } from '#shared/schemas/db'
import type { Verdict } from '#shared/utils/answer'
import { checkGaps, gradeRadio, radioAnswers, radioTokens, type RadioCard } from '#shared/utils/radio'
import { pickRound } from '#shared/utils/rounds'
import { vPlainInput } from '~/directives/plainInput'

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const loading = ref(true)
const loadError = ref(false)
const card = ref<RadioCard | null>(null)
const states = ref(new Map<string, GrammarRow>())
const typed = ref<string[]>([])
const verdicts = ref<Verdict[] | null>(null)
const right = ref(0)

const tokens = computed(() => (card.value ? radioTokens(card.value.text) : []))
const answers = computed(() => radioAnswers(tokens.value))
const allTyped = computed(() => typed.value.every(t => t.trim()))

onMounted(async () => {
  try {
    const practice = await loadPractice()
    states.value = practice.states
    card.value = pickRound(practice.radioCards, practice.states, practice.counts, practice.now, 1)[0] ?? null
    typed.value = answers.value.map(() => '')
  }
  catch (error) {
    console.error('[rien] could not start Gap Radio', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function play(rate: number) {
  if (card.value) speak(card.value.text, rate)
}

async function check() {
  const current = card.value
  if (!current || verdicts.value) return
  window.speechSynthesis?.cancel()
  verdicts.value = checkGaps(answers.value, typed.value)
  const graded = gradeRadio(current, states.value.get(current.itemId), verdicts.value, new Date())
  right.value = graded.right
  const [first, ...rest] = graded.mistakes
  await db.saveGrammarAnswer(graded.row, first)
  for (const mistake of rest) await db.saveMistake(mistake)
}

function finish() {
  emit('done', { clean: right.value, total: answers.value.length })
}
</script>

<template>
  <section class="rien-stack">
    <SqSkeleton v-if="loading" height="260" />

    <SqAlert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      title="Could not load the texts"
      text="Open Rien once while online so it can save them for offline use."
    />

    <SqEmptyState
      v-else-if="!card"
      title="All caught up"
      text="Every text is resting. They come back when they are due."
    />

    <template v-else>
      <SqCard variant="tonal">
        <SqCardText class="rien-stack rien-card-body">
          <strong class="rien-cue">{{ card.title }}</strong>
          <p class="rien-muted">
            {{ verdicts ? `${right} of ${answers.length} right.` : 'Listen, then type the missing words. Play it as often as you like.' }}
          </p>
          <SqAlert v-if="!canSpeak" type="warning" variant="tonal" text="This phone cannot read aloud here, so try reading the text instead." />
          <div v-else class="rien-row">
            <SqBtn color="primary" @click="play(0.85)">Play</SqBtn>
            <SqBtn variant="tonal" @click="play(0.65)">Play slower</SqBtn>
          </div>
        </SqCardText>
      </SqCard>

      <SqCard>
        <SqCardText class="rien-card-body">
          <p class="rien-radio">
            <template v-for="(token, index) in tokens" :key="index">
              <span v-if="token.gap === undefined">{{ token.before }}{{ token.word }}{{ token.after }}</span>
              <span v-else class="rien-gap-wrap">{{ token.before }}<input
                v-if="!verdicts"
                v-model="typed[token.gap]"
                v-plain-input
                class="rien-gap"
                :aria-label="`Missing word ${token.gap + 1}`"
                :size="Math.max(4, token.word.length)"
              ><span
                v-else
                class="rien-gap-result"
                :class="`is-${verdicts[token.gap]!.result}`"
              >{{ token.word }}<small v-if="verdicts[token.gap]!.result !== 'correct'"> ({{ typed[token.gap]?.trim() || '—' }})</small></span>{{ token.after }}</span>
              <!-- An explicit space: the template compiler drops trailing spaces inside tags. -->
              {{ ' ' }}
            </template>
          </p>
        </SqCardText>
        <SqCardActions>
          <SqBtn v-if="!verdicts" color="primary" size="large" :disabled="!allTyped" @click="check">Check</SqBtn>
          <SqBtn v-if="!verdicts" variant="text" @click="check">Show answers</SqBtn>
          <SqBtn v-else color="primary" size="large" @click="finish">Done</SqBtn>
        </SqCardActions>
      </SqCard>

      <SqCard v-if="verdicts && right === answers.length" title="Every word caught" variant="tonal">
        <SqCardActions>
          <SqBtn to="/" color="primary">Back to today</SqBtn>
        </SqCardActions>
      </SqCard>
    </template>
  </section>
</template>
