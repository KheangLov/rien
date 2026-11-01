<script setup lang="ts">
import { MISTAKE_LABELS, type MistakeType } from '#shared/schemas/db'
import { packsFor } from '#shared/utils/fixit'
import { shuffle } from '#shared/utils/rounds'
import { addDays } from '#shared/utils/streak'
import { orderTalks, talkCards, type TalkCard } from '#shared/utils/talks'

// Couple Talk: ten minutes of English together, guided. One question at a
// time, taking turns, read aloud on request, with ways to start an answer and
// to keep it going. Her words from class are a bingo card to tick off as she
// uses them, and her partner can note a slip with one tap; slips are saved as
// her mistakes, so practice targets them afterwards. The end card lists them
// to go over together, kindly.
const TALK_MINUTES = 10
const WORDS_TO_USE = 4
// Ways to keep a conversation going, after any answer.
const FOLLOW_UPS = ['Why?', 'How did you feel?', 'What happened next?', 'Can you tell me more?', 'Really? When?']
// The slips a partner can note while listening.
const SLIP_TYPES: MistakeType[] = ['tense', 'third-person-s', 'final-sound', 'plural-s', 'article', 'preposition', 'word-order', 'other']

// No score: a conversation has no right answers (a 1 of 1 used to count as a
// perfect round and unlock the Perfect fish).
const emit = defineEmits<{ done: [] }>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()
const countdown = useCountdown(TALK_MINUTES * 60_000)

const loading = ref(true)
const loadError = ref(false)
const topics = ref<TalkCard[]>([])
const topicIndex = ref(0)
const words = ref<string[]>([])
const used = ref(new Set<string>())
const phase = ref<'prompt' | 'talking' | 'done'>('prompt')
const question = ref(0)
const minutes = ref(0)
const slips = ref<{ type: MistakeType, note: string }[]>([])
const slipOpen = ref(false)
const slipType = ref<MistakeType | null>(null)
const slipNote = ref('')

const talk = computed(() => topics.value[topicIndex.value % Math.max(1, topics.value.length)])
const questions = computed(() => talk.value?.questions ?? [])
const lastQuestion = computed(() => question.value >= questions.value.length - 1)
// Turns alternate: she answers the first question, her partner the next.
const herTurn = computed(() => question.value % 2 === 0)
const allWordsUsed = computed(() => words.value.length > 0 && used.value.size === words.value.length)

onMounted(async () => {
  try {
    const now = new Date()
    const [packs, settings, history, counts] = await Promise.all([
      usePacks(),
      db.getSettings(),
      db.talkResults(),
      db.mistakeCounts(addDays(now, -WEAK_SPOT_DAYS)),
    ])
    topics.value = orderTalks(talkCards(packsFor(packs, settings)), history, counts)
    const fileWords = await db.cardsInFile(settings.book, settings.file)
    const pool = fileWords.length >= WORDS_TO_USE ? fileWords : await db.recentCards(30)
    words.value = shuffle(pool).slice(0, WORDS_TO_USE).map(card => card.answer)
  }
  catch (error) {
    console.error('[rien] could not start Couple Talk', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function anotherTopic() {
  topicIndex.value++
  haptic('tap')
}

function begin() {
  phase.value = 'talking'
  question.value = 0
  countdown.start()
  haptic('tap')
}

function nextQuestion() {
  if (lastQuestion.value) return
  question.value++
  haptic('tap')
}

function toggleWord(word: string) {
  const next = new Set(used.value)
  if (next.has(word)) next.delete(word)
  else next.add(word)
  used.value = next
  haptic(next.size === words.value.length && next.has(word) ? 'success' : 'tap')
}

function openSlip() {
  slipType.value = null
  slipNote.value = ''
  slipOpen.value = true
}

async function saveSlip() {
  const current = talk.value
  if (!current || !slipType.value) return
  const note = slipNote.value.trim()
  slips.value.push({ type: slipType.value, note })
  slipOpen.value = false
  haptic('success')
  // Saved as her mistake, so Fix It, Sound Hunter and her session plan bring this kind of slip up more.
  await db.saveMistake({
    type: slipType.value,
    itemId: current.talkId,
    at: new Date(),
    detail: (note ? `Couple Talk: ${note}` : `Couple Talk: ${current.topic}`).slice(0, 200),
  })
}

async function finish() {
  const current = talk.value
  if (!current) return
  countdown.pause()
  minutes.value = Math.max(1, Math.round(countdown.elapsedMs.value / 60_000))
  await db.saveTalk({ talkId: current.talkId, at: new Date(), minutes: countdown.elapsedMs.value / 60_000 })
  phase.value = 'done'
  haptic('success')
  emit('done')
}
</script>

<template>
  <section class="rien-stack">
    <SqSkeleton v-if="loading" height="240" />

    <SqAlert
      v-else-if="loadError || !talk"
      type="error"
      variant="tonal"
      title="Could not load the topics"
      text="Open Rien once while online so it can save them for offline use."
    />

    <!-- The end: what they did, and the slips to go over together. -->
    <template v-else-if="phase === 'done'">
      <SqCard title="Nice talk!" variant="tonal" class="rien-pop">
        <Confetti v-if="allWordsUsed" />
        <SqCardText class="rien-stack">
          <div class="rien-talk-stats">
            <div><b>{{ minutes }}</b><span>{{ minutes === 1 ? 'minute' : 'minutes' }}</span></div>
            <div><b>{{ question + 1 }}</b><span>{{ question === 0 ? 'question' : 'questions' }}</span></div>
            <div v-if="words.length"><b>{{ used.size }}/{{ words.length }}</b><span>words used</span></div>
          </div>
          <div v-if="slips.length" class="rien-stack rien-gap-sm">
            <strong>To go over together</strong>
            <ul class="rien-talk-slips">
              <li v-for="(slip, i) in slips" :key="i">
                <SqChip size="small" :text="MISTAKE_LABELS[slip.type]" />
                <span>{{ slip.note || 'Talk about it now, kindly.' }}</span>
              </li>
            </ul>
            <p class="rien-muted">These come up more in her practice from now on.</p>
          </div>
          <p v-else class="rien-muted">No slips noted. Any word you needed but didn't know? Add it while you remember.</p>
        </SqCardText>
        <SqCardActions>
          <SqBtn to="/add-words" variant="tonal">Add words</SqBtn>
          <SqBtn to="/" color="primary">Back to today</SqBtn>
        </SqCardActions>
      </SqCard>
    </template>

    <!-- Before: choose a topic, see the rules. -->
    <template v-else-if="phase === 'prompt'">
      <SqCard class="rien-talk-topic">
        <SqCardText class="rien-stack rien-card-body">
          <div class="rien-activity-head">
            <span class="rien-talk-icon"><RienIcon name="couple-talk" :size="26" weight="duotone" /></span>
            <div>
              <strong class="rien-talk-title">{{ talk.topic }}</strong>
              <p class="rien-muted">{{ questions.length }} questions · {{ MISTAKE_LABELS[talk.focus] }}</p>
            </div>
          </div>
          <p class="rien-talk-tip">{{ talk.tip }}</p>
          <SqBtn variant="text" size="small" @click="anotherTopic">
            <RienIcon name="next" :size="18" weight="bold" /> Another topic
          </SqBtn>
        </SqCardText>
      </SqCard>
      <SqCard variant="outlined">
        <SqCardText>
          <ul class="rien-rules">
            <li>English only for {{ TALK_MINUTES }} minutes. No Khmer, no phones (except this one).</li>
            <li>Take turns: Rien shows whose turn it is to answer.</li>
            <li>Don't stop to correct. Tap <b>Note a slip</b> instead, and go over them at the end.</li>
          </ul>
        </SqCardText>
      </SqCard>
      <ActionBar>
        <SqBtn color="primary" size="large" @click="begin">Start talking</SqBtn>
      </ActionBar>
    </template>

    <!-- During: one question at a time. -->
    <template v-else>
      <div class="rien-talk-bar">
        <button
          type="button"
          class="rien-talk-timer"
          :class="{ 'is-paused': !countdown.running.value && !countdown.finished.value, 'is-over': countdown.finished.value }"
          :aria-label="countdown.running.value ? 'Pause the timer' : 'Start the timer'"
          @click="countdown.running.value ? countdown.pause() : countdown.start()"
        >
          <RienIcon :name="countdown.finished.value ? 'check' : countdown.running.value ? 'stop' : 'play'" :size="16" weight="fill" />
          <span role="timer">{{ countdown.finished.value ? 'Time!' : countdown.label.value }}</span>
        </button>
        <div class="rien-talk-dots" aria-hidden="true">
          <i v-for="(_, i) in questions" :key="i" :class="{ 'is-done': i < question, 'is-now': i === question }" />
        </div>
        <span class="rien-muted">{{ question + 1 }}/{{ questions.length }}</span>
      </div>

      <Transition name="rien-talk-card" mode="out-in">
        <SqCard :key="`${topicIndex}-${question}`" class="rien-talk-card">
          <SqCardText class="rien-stack rien-card-body">
            <span class="rien-talk-turn" :class="{ 'is-her': herTurn }">
              {{ herTurn ? 'You answer' : 'Your partner answers' }}
            </span>
            <p class="rien-talk-question">{{ questions[question] }}</p>
            <SqBtn v-if="canSpeak" variant="text" size="small" class="rien-talk-hear" @click="speak(questions[question] ?? '')">
              <RienIcon name="volume" :size="18" weight="fill" /> Hear the question
            </SqBtn>

            <div v-if="talk.starters.length" class="rien-stack rien-gap-sm">
              <span class="rien-talk-label">Start with</span>
              <div class="rien-row">
                <button v-for="starter in talk.starters" :key="starter" type="button" class="rien-talk-chip" @click="canSpeak && speak(starter.replace('…', ''))">
                  {{ starter }}
                </button>
              </div>
            </div>

            <div class="rien-stack rien-gap-sm">
              <span class="rien-talk-label">Then ask</span>
              <div class="rien-row">
                <span v-for="follow in FOLLOW_UPS" :key="follow" class="rien-talk-chip is-soft">{{ follow }}</span>
              </div>
            </div>
          </SqCardText>
        </SqCard>
      </Transition>

      <SqCard v-if="words.length" variant="tonal">
        <SqCardText class="rien-stack rien-gap-sm">
          <span class="rien-talk-label">Word bingo: tap each word when you use it</span>
          <div class="rien-talk-bingo">
            <button
              v-for="word in words"
              :key="word"
              type="button"
              class="rien-talk-word"
              :class="{ 'is-used': used.has(word) }"
              :aria-pressed="used.has(word)"
              @click="toggleWord(word)"
            >
              <RienIcon v-if="used.has(word)" name="check" :size="16" weight="bold" />
              {{ word }}
            </button>
          </div>
          <p v-if="allWordsUsed" class="rien-best-combo"><RienIcon name="goal" :size="18" weight="fill" /> Bingo! Every word used.</p>
        </SqCardText>
      </SqCard>

      <p v-if="slips.length" class="rien-muted rien-talk-slipcount">
        {{ slips.length }} {{ slips.length === 1 ? 'slip' : 'slips' }} noted for later
      </p>

      <ActionBar>
        <SqBtn v-if="!lastQuestion" color="primary" size="large" @click="nextQuestion">Next question</SqBtn>
        <SqBtn v-else color="primary" size="large" @click="finish">We're done</SqBtn>
        <SqBtn variant="tonal" size="large" @click="openSlip">Note a slip</SqBtn>
      </ActionBar>
      <SqBtn v-if="!lastQuestion" variant="text" class="rien-talk-finish" @click="finish">Finish early</SqBtn>

      <IosSheet :open="slipOpen" title="Note a slip" @close="slipOpen = false">
        <p class="rien-muted">What kind of slip? It is saved for practice, and listed at the end to go over together.</p>
        <div class="rien-talk-sliptypes">
          <button
            v-for="type in SLIP_TYPES"
            :key="type"
            type="button"
            class="rien-talk-sliptype"
            :class="{ 'is-on': slipType === type }"
            @click="slipType = type"
          >
            {{ MISTAKE_LABELS[type] }}
          </button>
        </div>
        <SqTextField
          v-model="slipNote"
          label="The right way to say it (optional)"
          placeholder="e.g. She goes, not she go"
          hide-details
          class="rien-talk-note"
        />
        <SqBtn color="primary" size="large" block :disabled="!slipType" @click="saveSlip">Save slip</SqBtn>
      </IosSheet>
    </template>
  </section>
</template>
