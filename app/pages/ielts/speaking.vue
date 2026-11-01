<script setup lang="ts">
import type { IeltsSpeaking } from '#shared/schemas/pack'
import { speakingFeedback, type SpeakingFeedback } from '#shared/utils/ielts'
import { shuffle } from '#shared/utils/rounds'

// IELTS Speaking, as in the exam: Part 1 short questions on a familiar topic;
// Part 2 a cue card, one minute to prepare and up to two minutes to talk;
// Part 3 a discussion on the same theme. The phone writes down what she says,
// then Rien gives feedback: length, pace, filler words, linking words.
const { supported: canSpeak, speak } = useSpeech()
const listener = useLongListen()
const recorder = useActivityRecorder()

const cards = ref<IeltsSpeaking[]>([])
const card = ref<IeltsSpeaking | null>(null)
type Phase = 'choose' | 'prep' | 'ask' | 'answering' | 'feedback' | 'done'
const phase = ref<Phase>('choose')
// Which part is being answered: 1, 2 (the long turn) or 3 (the discussion).
const part = ref<1 | 2 | 3>(1)
const question = ref(0)
const notes = ref('')
const heard = ref('')
const feedback = ref<SpeakingFeedback | null>(null)

const prep = useCountdown(60_000)
const talk = useCountdown(120_000)

onMounted(async () => { cards.value = (await loadIelts()).speaking })

function begin(which: 1 | 2) {
  const pool = cards.value.filter(c => c.part === which && c.id !== card.value?.id)
  card.value = shuffle(pool)[0] ?? null
  if (!card.value) return
  part.value = which
  question.value = 0
  notes.value = ''
  feedback.value = null
  if (which === 2) {
    prep.reset()
    prep.start()
    phase.value = 'prep'
  }
  else phase.value = 'ask'
}

const currentQuestion = computed(() => (card.value && part.value !== 2 ? card.value.questions[question.value] : undefined))

function hear() {
  const text = part.value === 2 ? card.value?.cue : currentQuestion.value
  if (text && canSpeak) speak(text)
}

async function answer() {
  feedback.value = null
  heard.value = ''
  phase.value = 'answering'
  if (part.value === 2) {
    prep.pause()
    talk.reset()
    talk.start()
  }
  if (listener.supported) void listener.start()
}

// The two minutes are up: stop as the examiner would.
watch(talk.finished, (over) => { if (over && phase.value === 'answering' && part.value === 2) void done() })
watch(prep.finished, (over) => { if (over && phase.value === 'prep') void answer() })

async function done() {
  const seconds = listener.supported ? await listener.finish() : talk.elapsedMs.value / 1000
  if (part.value === 2) talk.pause()
  heard.value = listener.transcript.value
  feedback.value = listener.supported ? speakingFeedback(heard.value, seconds, part.value) : null
  phase.value = 'feedback'
  haptic('success')
}

function next() {
  if (!card.value) return
  if (part.value === 2) {
    // After the long turn comes the discussion.
    part.value = 3
    question.value = 0
    phase.value = 'ask'
    return
  }
  if (question.value + 1 < card.value.questions.length) {
    question.value++
    phase.value = 'ask'
    return
  }
  phase.value = 'done'
  void recorder.record('ielts-speaking')
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Speaking" back="/ielts" />

    <SqAlert
      v-if="!listener.supported"
      type="info"
      variant="tonal"
      title="Practise aloud with the timer"
      text="This browser cannot write down what you say, so there is no feedback on your words here. In the Rien app, or in Chrome, you get feedback too."
    />

    <template v-if="phase === 'choose' || phase === 'done'">
      <SqCard v-if="phase === 'done'" title="Well done" variant="tonal" class="rien-pop">
        <SqCardText>
          <p class="rien-muted">Speaking a little every day is the fastest way to a higher speaking band. Try another topic, or come back tomorrow.</p>
        </SqCardText>
      </SqCard>
      <SqCard>
        <SqCardText class="rien-stack rien-card-body">
          <strong>Part 1</strong>
          <p class="rien-muted">Four short questions about everyday life. Answer each in two or three sentences, with a reason.</p>
        </SqCardText>
        <SqCardActions><SqBtn color="primary" @click="begin(1)">Start Part 1</SqBtn></SqCardActions>
      </SqCard>
      <SqCard>
        <SqCardText class="rien-stack rien-card-body">
          <strong>Parts 2 and 3</strong>
          <p class="rien-muted">A topic card: one minute to make notes, then talk for up to two minutes. Then three discussion questions.</p>
        </SqCardText>
        <SqCardActions><SqBtn color="primary" @click="begin(2)">Start Part 2</SqBtn></SqCardActions>
      </SqCard>
    </template>

    <template v-else-if="card">
      <p class="rien-muted rien-ielts-step">
        {{ part === 1 ? `Part 1 · ${card.topic} · question ${question + 1} of ${card.questions.length}` : part === 2 ? 'Part 2 · the long turn' : `Part 3 · discussion · question ${question + 1} of ${card.questions.length}` }}
      </p>

      <!-- Part 2: the cue card and the minute to prepare. -->
      <SqCard v-if="part === 2" class="rien-cue-card">
        <SqCardText class="rien-stack rien-card-body">
          <strong class="rien-cue-title">{{ card.cue }}</strong>
          <p class="rien-muted">You should say:</p>
          <ul class="rien-cue-points">
            <li v-for="point in card.points" :key="point">{{ point }}</li>
          </ul>
        </SqCardText>
      </SqCard>
      <template v-if="phase === 'prep'">
        <p class="rien-ielts-timer" role="timer">Prepare: {{ prep.label.value }}</p>
        <SqTextarea v-model="notes" label="Notes (only for you)" :rows="4" hide-details />
        <ActionBar>
          <SqBtn color="primary" size="large" @click="answer">I'm ready, start talking</SqBtn>
        </ActionBar>
      </template>

      <SqCard v-else-if="part !== 2" class="rien-ielts-question">
        <SqCardText class="rien-stack rien-card-body">
          <p class="rien-talk-question">{{ currentQuestion }}</p>
          <SqBtn v-if="canSpeak" variant="text" size="small" @click="hear">
            <RienIcon name="volume" :size="18" weight="fill" /> Hear the question
          </SqBtn>
        </SqCardText>
      </SqCard>

      <template v-if="phase === 'ask'">
        <ActionBar>
          <SqBtn color="primary" size="large" @click="answer">
            <RienIcon name="say-it" :size="20" weight="bold" /> Answer
          </SqBtn>
        </ActionBar>
      </template>

      <template v-else-if="phase === 'answering'">
        <p v-if="part === 2" class="rien-ielts-timer" role="timer">Talking: {{ talk.label.value }}</p>
        <p v-if="notes && part === 2" class="rien-muted rien-ielts-notes">{{ notes }}</p>
        <p class="rien-ielts-live" aria-live="polite">{{ listener.transcript.value || (listener.supported ? 'Listening… start speaking.' : 'Speak now.') }}</p>
        <p v-if="listener.error.value" class="rien-ielts-error">{{ listener.error.value }}</p>
        <ActionBar>
          <SqBtn color="primary" size="large" @click="done">Done</SqBtn>
        </ActionBar>
      </template>

      <template v-else-if="phase === 'feedback'">
        <SqCard variant="tonal" title="What you said">
          <SqCardText class="rien-stack rien-card-body">
            <p class="rien-ielts-transcript">{{ heard || 'Nothing was heard. Check the microphone and try again.' }}</p>
            <div v-if="feedback" class="rien-talk-stats rien-ielts-stats">
              <div><b>{{ feedback.words }}</b><span>words</span></div>
              <div><b>{{ feedback.wordsPerMinute }}</b><span>words a minute</span></div>
              <div><b>{{ feedback.fillers }}</b><span>um / er</span></div>
              <div><b>{{ feedback.linking.length }}</b><span>linking words</span></div>
            </div>
            <p v-if="feedback?.linking.length" class="rien-muted">Linking words: {{ feedback.linking.join(', ') }}</p>
            <ul v-if="feedback" class="rien-ielts-tips">
              <li v-for="tip in feedback.tips" :key="tip">{{ tip }}</li>
            </ul>
          </SqCardText>
        </SqCard>
        <ActionBar>
          <SqBtn variant="tonal" size="large" @click="answer">Try again</SqBtn>
          <SqBtn color="primary" size="large" @click="next">Next</SqBtn>
        </ActionBar>
      </template>
    </template>
  </div>
</template>
