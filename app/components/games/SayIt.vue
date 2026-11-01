<script setup lang="ts">
import { correctedText } from '#shared/utils/fixit'
import { shuffle } from '#shared/utils/rounds'
import { compareBest, type SpokenWord } from '#shared/utils/spoken'

const ROUND_SIZE = 5
// Sentences from her own words' examples in each round, the rest from Fix It.
const OWN_SENTENCES = 2
const MAX_TRIES = 3

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const { speak } = useSpeech()
const speech = useListen()

interface Sentence { id: string, text: string }
type Rating = 'clear' | 'unsure' | 'missed'

const loading = ref(true)
const blocked = ref<'unsupported' | 'permission' | 'error' | null>(null)
const sentences = ref<Sentence[]>([])
const position = ref(0)
const phase = ref<'ready' | 'listening' | 'heard'>('ready')
const partial = ref('')
const heard = ref('')
const recording = ref<string | undefined>()
const words = ref<SpokenWord[]>([])
const tries = ref(0)
const clean = ref(0)
const listenError = ref('')

const sentence = computed(() => sentences.value[position.value])
const finished = computed(() => !loading.value && sentences.value.length > 0 && position.value >= sentences.value.length)
const progress = computed(() =>
  sentences.value.length ? Math.round((position.value / sentences.value.length) * 100) : 0)
const endings = computed(() => words.value.filter(w => w.status === 'ending'))
const missing = computed(() => words.value.filter(w => w.status === 'missing'))
const unclear = computed(() => words.value.filter(w => w.status === 'unclear'))
const plain = (word: string) => word.replace(/[^\p{L}']/gu, '')

onMounted(async () => {
  try {
    if (!speech.supported) {
      blocked.value = 'unsupported'
      return
    }
    const [practice, recent] = await Promise.all([loadPractice(), db.recentCards(50)])
    const own = shuffle(recent.filter(card => card.example))
      .slice(0, OWN_SENTENCES)
      .map(card => ({ id: `word:${card.id}`, text: card.example }))
    const fixes = shuffle(practice.fixCards)
      .slice(0, ROUND_SIZE - own.length)
      .map(card => ({ id: card.itemId, text: correctedText(card) }))
    sentences.value = shuffle([...own, ...fixes])
  }
  catch (error) {
    console.error('[rien] could not start Say It', error)
    blocked.value = 'error'
  }
  finally {
    loading.value = false
  }
})

async function sayIt() {
  const current = sentence.value
  if (!current || phase.value === 'listening') return
  listenError.value = ''
  if (!(await speech.ensurePermission())) {
    blocked.value = 'permission'
    return
  }
  phase.value = 'listening'
  partial.value = ''
  try {
    const { speechOnline } = await db.getSettings()
    const result = await speech.listen((text) => { partial.value = text }, { online: speechOnline })
    const [best = '', ...others] = result.alternatives
    heard.value = best
    recording.value = result.recording
    words.value = compareBest(current.text, result.words ?? best.split(/\s+/).map(text => ({ text })), others)
    haptic(words.value.some(w => w.status === 'ending') ? 'warning' : 'success')
    tries.value++
    phase.value = 'heard'
  }
  catch (error) {
    console.error('[rien] listening failed', error)
    listenError.value = 'The phone did not catch that. Tap Say it and try again.'
    phase.value = tries.value > 0 ? 'heard' : 'ready'
  }
}

async function rate(rating: Rating) {
  const current = sentence.value
  if (!current) return
  // The transcript is only a hint, so her own rating counts as much as what the phone heard.
  if (endings.value.length > 0 || rating === 'missed') {
    await db.saveMistake({
      type: 'final-sound',
      itemId: current.id,
      at: new Date(),
      detail: `said "${heard.value}" for "${current.text}"`.slice(0, 200),
    })
  }
  else if (rating === 'clear') {
    clean.value++
  }
  next()
}

function next() {
  position.value++
  phase.value = 'ready'
  heard.value = ''
  recording.value = undefined
  words.value = []
  tries.value = 0
  listenError.value = ''
  if (finished.value) emit('done', { clean: clean.value, total: sentences.value.length })
}
</script>

<template>
  <section class="rien-stack">
    <SqProgressLinear :model-value="progress" color="primary" />

    <SqSkeleton v-if="loading" height="220" />

    <SqAlert
      v-else-if="blocked === 'unsupported'"
      type="info"
      variant="tonal"
      title="Say It is in the iPhone app"
      text="Web apps on the iPhone Home Screen cannot use speech recognition, so Say It runs in the native Rien app."
    />

    <SqAlert
      v-else-if="blocked === 'permission'"
      type="warning"
      variant="tonal"
      title="Rien needs the microphone"
      text="Allow Microphone and Speech Recognition for Rien in the iPhone Settings app, then come back."
    />

    <SqAlert
      v-else-if="blocked === 'error'"
      type="error"
      variant="tonal"
      title="Could not load the sentences"
      text="Try again in a moment."
    />

    <SqCard v-else-if="finished" title="Round done" variant="tonal">
      <SqCardText>
        <p class="rien-big">{{ clean }} / {{ sentences.length }}</p>
        <p class="rien-muted">said with clear endings.</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
      </SqCardActions>
    </SqCard>

    <SqCard v-else-if="sentence" :key="`${sentence.id}-${position}`">
      <SqCardText class="rien-stack rien-card-body">
        <p class="rien-muted">Read it aloud. Say every ending.</p>

        <p v-if="phase !== 'heard'" class="rien-sentence-fixed">{{ sentence.text }}</p>
        <p v-else class="rien-spoken" aria-live="polite">
          <span
            v-for="(word, index) in words"
            :key="index"
            class="rien-spoken-word"
            :class="`is-${word.status}`"
          >{{ word.word }}</span>
        </p>

        <p v-if="phase === 'listening'" class="rien-muted" aria-live="polite">
          {{ partial || 'Listening…' }}
        </p>

        <template v-if="phase === 'heard'">
          <p class="rien-muted">The phone heard: “{{ heard || '…' }}”</p>
          <SqAlert
            v-if="endings.length"
            type="warning"
            variant="tonal"
            :title="`Check the ending${endings.length > 1 ? 's' : ''}`"
            :text="endings.map(w => `${w.word.replace(/[^\p{L}']/gu, '')}: say the -${w.ending}`).join(' · ')"
          />
          <SqAlert
            v-else-if="unclear.length"
            type="info"
            variant="tonal"
            title="The phone was not sure"
            :text="`Listen to yourself, then to the model, and compare: ${unclear.map(w => plain(w.word)).join(', ')}.`"
          />
          <SqAlert
            v-else-if="missing.length"
            type="info"
            variant="tonal"
            text="Some words were not caught. Phones often mishear, so trust your ears too."
          />
          <SqAlert v-else type="success" variant="tonal" text="Every word heard, endings included." />
        </template>

        <SqAlert v-if="listenError" type="error" variant="tonal" :text="listenError" />

        <ActionBar :fixed="phase !== 'heard'">
          <SqBtn
            :color="phase === 'heard' ? undefined : 'primary'"
            :variant="phase === 'heard' ? 'tonal' : undefined"
            size="large"
            :loading="phase === 'listening'"
            :disabled="phase === 'listening' || tries >= MAX_TRIES"
            @click="sayIt"
          >
            {{ phase === 'heard' ? 'Say it again' : 'Say it' }}
          </SqBtn>
          <SqBtn variant="tonal" :disabled="phase === 'listening'" @click="speak(sentence.text)">Hear it</SqBtn>
          <SqBtn
            v-if="recording && phase === 'heard'"
            variant="tonal"
            @click="speech.playRecording(recording)"
          >
            Hear yourself
          </SqBtn>
        </ActionBar>

        <div v-if="phase === 'heard'" class="rien-stack rien-gap-sm">
          <p class="rien-muted">How did your endings sound to you?</p>
          <div class="rien-rating">
            <SqBtn variant="tonal" @click="rate('clear')">Clear</SqBtn>
            <SqBtn variant="tonal" @click="rate('unsure')">Not sure</SqBtn>
            <SqBtn variant="tonal" @click="rate('missed')">Missed some</SqBtn>
          </div>
        </div>
      </SqCardText>
    </SqCard>
  </section>
</template>
