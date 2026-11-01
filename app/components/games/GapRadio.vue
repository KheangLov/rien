<script setup lang="ts">
import type { GrammarRow } from '#shared/schemas/db'
import type { Verdict } from '#shared/utils/answer'
import { checkGaps, gradeRadio, radioAnswers, radioTokens, type RadioCard } from '#shared/utils/radio'
import { pickRound } from '#shared/utils/rounds'
import { vInputAttrs } from '~/directives/inputAttrs'
import { vPlainInput } from '~/directives/plainInput'

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const { supported: canSpeak, speakTracked } = useSpeech()
// The word being read aloud, for the highlight, and whether it is playing
// (some phones send no word positions, so this is kept apart).
const reading = ref(-1)
const playing = ref(false)
const gapInputs = ref<HTMLInputElement[]>([])

const loading = ref(true)
const loadError = ref(false)
const card = ref<RadioCard | null>(null)
const states = ref(new Map<string, GrammarRow>())
const typed = ref<string[]>([])
const verdicts = ref<Verdict[] | null>(null)
const right = ref(0)

const tokens = computed(() => (card.value ? radioTokens(card.value.text) : []))
const answers = computed(() => radioAnswers(tokens.value))
const filled = computed(() => typed.value.filter(t => t.trim()).length)
const allTyped = computed(() => filled.value === answers.value.length)

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

// Character offset where each token starts in the spoken text.
const offsets = computed(() => {
  let at = 0
  return tokens.value.map((t) => {
    const start = at
    at += `${t.before}${t.word}${t.after}`.length + 1
    return start
  })
})

function play(rate: number) {
  const text = tokens.value.map(t => `${t.before}${t.word}${t.after}`).join(' ')
  playing.value = true
  speakTracked(text, rate, (charIndex) => {
    if (charIndex < 0) {
      reading.value = -1
      playing.value = false
      return
    }
    let index = 0
    while (index + 1 < offsets.value.length && offsets.value[index + 1]! <= charIndex) index++
    reading.value = index
  })
}

function stop() {
  stopSpeaking()
  reading.value = -1
  playing.value = false
}

// The keyboard's Next key goes to the following gap; the last one closes it.
function nextGap(gap: number) {
  const next = gapInputs.value[gap + 1]
  if (next) next.focus()
  else gapInputs.value[gap]?.blur()
}

async function check() {
  const current = card.value
  if (!current || verdicts.value) return
  stop()
  verdicts.value = checkGaps(answers.value, typed.value)
  const graded = gradeRadio(current, states.value.get(current.itemId), verdicts.value, new Date())
  right.value = graded.right
  haptic(graded.mistakes.length === 0 ? 'success' : right.value >= answers.value.length / 2 ? 'warning' : 'error')
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
      <SqCard variant="tonal" class="rien-radio-head">
        <SqCardText class="rien-stack rien-card-body">
          <div class="rien-radio-title">
            <span class="rien-radio-icon"><RienIcon name="gap-radio" :size="26" weight="duotone" /></span>
            <div>
              <strong class="rien-cue">{{ card.title }}</strong>
              <p class="rien-muted">
                {{ verdicts ? `${right} of ${answers.length} right` : 'Listen, then fill the gaps' }}
              </p>
            </div>
            <span class="rien-onair" :class="{ 'is-on': playing }" aria-hidden="true">
              <i />ON AIR
            </span>
          </div>

          <SqAlert v-if="!canSpeak" type="warning" variant="tonal" text="This phone cannot read aloud here, so try reading the text instead." />
          <div v-else-if="!verdicts" class="rien-radio-player">
            <SqBtn v-if="!playing" color="primary" @click="play(0.85)">
              <RienIcon name="play" :size="20" weight="fill" /> Play
            </SqBtn>
            <SqBtn v-else color="primary" @click="stop">
              <RienIcon name="stop" :size="20" weight="fill" /> Stop
            </SqBtn>
            <SqBtn variant="tonal" :disabled="playing" @click="play(0.65)">
              <RienIcon name="slower" :size="20" weight="bold" /> Slower
            </SqBtn>
            <span class="rien-eq" :class="{ 'is-on': playing }" aria-hidden="true"><i /><i /><i /><i /></span>
          </div>

          <div class="rien-radio-progress">
            <SqProgressLinear
              :model-value="verdicts ? (right / answers.length) * 100 : (filled / answers.length) * 100"
              :color="verdicts && right < answers.length ? 'warning' : 'primary'"
            />
            <span class="rien-muted">{{ verdicts ? `${right}/${answers.length}` : `${filled} of ${answers.length} filled` }}</span>
          </div>
        </SqCardText>
      </SqCard>

      <SqCard>
        <SqCardText class="rien-card-body">
          <p class="rien-radio">
            <template v-for="(token, index) in tokens" :key="index">
              <span v-if="token.gap === undefined" :class="{ 'is-reading': reading === index }">{{ token.before }}{{ token.word }}{{ token.after }}</span>
              <span v-else class="rien-gap-wrap" :class="{ 'is-reading': reading === index }">{{ token.before }}<input
                v-if="!verdicts"
                :ref="(el) => { if (el) gapInputs[token.gap!] = el as HTMLInputElement }"
                v-model="typed[token.gap]"
                v-plain-input
                v-input-attrs="{ enterkeyhint: token.gap === answers.length - 1 ? 'done' : 'next' }"
                class="rien-gap"
                :class="{ 'is-filled': typed[token.gap]?.trim() }"
                :style="{ '--len': Math.max(3, token.word.length) }"
                :placeholder="String(token.gap + 1)"
                :aria-label="`Missing word ${token.gap + 1}`"
                @keydown.enter.prevent="nextGap(token.gap!)"
              ><span
                v-else
                class="rien-gap-result"
                :class="`is-${verdicts[token.gap]!.result}`"
              ><s v-if="verdicts[token.gap]!.result !== 'correct' && typed[token.gap]?.trim()">{{ typed[token.gap]!.trim() }}</s>{{ token.word }}</span>{{ token.after }}</span>
              <!-- An explicit space: the template compiler drops trailing spaces inside tags. -->
              {{ ' ' }}
            </template>
          </p>
        </SqCardText>
        <ActionBar>
          <SqBtn v-if="!verdicts" color="primary" size="large" :disabled="!allTyped" @click="check">Check</SqBtn>
          <SqBtn v-if="!verdicts" variant="tonal" size="large" @click="check">Show answers</SqBtn>
          <SqBtn v-else color="primary" size="large" @click="finish">Done</SqBtn>
        </ActionBar>
      </SqCard>

      <SqCard v-if="verdicts && right === answers.length" title="Every word caught" variant="tonal">
        <SqCardActions>
          <SqBtn to="/" color="primary">Back to today</SqBtn>
        </SqCardActions>
      </SqCard>
    </template>
  </section>
</template>
