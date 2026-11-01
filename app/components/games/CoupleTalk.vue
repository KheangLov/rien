<script setup lang="ts">
import { MISTAKE_LABELS } from '#shared/schemas/db'
import { packsFor } from '#shared/utils/fixit'
import { shuffle } from '#shared/utils/rounds'
import { addDays } from '#shared/utils/streak'
import { orderTalks, talkCards, type TalkCard } from '#shared/utils/talks'

const TALK_MINUTES = 10
// Words from her list to try to use in the conversation.
const WORDS_TO_USE = 3

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const countdown = useCountdown(TALK_MINUTES * 60_000)

const loading = ref(true)
const loadError = ref(false)
const topics = ref<TalkCard[]>([])
const index = ref(0)
const words = ref<string[]>([])
const phase = ref<'prompt' | 'talking' | 'done'>('prompt')
const minutes = ref(0)

const talk = computed(() => topics.value[index.value % Math.max(1, topics.value.length)])

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
    const pool = fileWords.length >= WORDS_TO_USE ? fileWords : await db.recentCards(20)
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
  index.value++
}

function begin() {
  phase.value = 'talking'
  countdown.start()
}

async function finish() {
  const current = talk.value
  if (!current) return
  countdown.pause()
  minutes.value = Math.round(countdown.elapsedMs.value / 60_000)
  await db.saveTalk({ talkId: current.talkId, at: new Date(), minutes: countdown.elapsedMs.value / 60_000 })
  phase.value = 'done'
  emit('done', { clean: 1, total: 1 })
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

    <SqCard v-else-if="phase === 'done'" title="Nice talk" variant="tonal">
      <SqCardText class="rien-stack">
        <p class="rien-big">{{ minutes }}</p>
        <p class="rien-muted">{{ minutes === 1 ? 'minute' : 'minutes' }} in English. Now is the time for corrections, kindly.</p>
        <p class="rien-muted">Any word you needed but didn't know? Add it while you remember.</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/add-words" color="primary">Add words</SqBtn>
        <SqBtn to="/" variant="tonal">Back to today</SqBtn>
      </SqCardActions>
    </SqCard>

    <template v-else>
      <SqCard v-if="phase === 'talking'" variant="tonal">
        <SqCardText class="rien-stack rien-card-body rien-timer-card">
          <p class="rien-timer" role="timer" aria-live="off">{{ countdown.label.value }}</p>
          <SqAlert
            v-if="countdown.finished.value"
            type="success"
            variant="tonal"
            title="Time!"
            text="Finish your sentence, then tap “We’re done”."
          />
          <p v-else class="rien-muted">English only until the timer ends.</p>
          <div class="rien-row rien-row-center">
            <SqBtn
              v-if="!countdown.finished.value"
              variant="tonal"
              @click="countdown.running.value ? countdown.pause() : countdown.start()"
            >
              {{ countdown.running.value ? 'Pause' : 'Resume' }}
            </SqBtn>
            <SqBtn color="primary" @click="finish">We’re done</SqBtn>
          </div>
        </SqCardText>
      </SqCard>

      <SqCard>
        <SqCardText class="rien-stack rien-card-body">
          <div class="rien-activity-head">
            <strong class="rien-cue">{{ talk.topic }}</strong>
            <SqChip size="small" :text="MISTAKE_LABELS[talk.focus]" />
          </div>
          <ol class="rien-questions">
            <li v-for="question in talk.questions" :key="question">{{ question }}</li>
          </ol>
          <p class="rien-muted">{{ talk.tip }}</p>
          <div v-if="words.length" class="rien-stack rien-gap-sm">
            <p class="rien-muted">Try to use these words from your list:</p>
            <div class="rien-row">
              <SqChip v-for="word in words" :key="word" color="primary" :text="word" />
            </div>
          </div>
        </SqCardText>
      </SqCard>

      <template v-if="phase === 'prompt'">
        <SqCard variant="outlined">
          <SqCardText>
            <ul class="rien-rules">
              <li>English only for {{ TALK_MINUTES }} minutes. No Khmer, no phones.</li>
              <li>Take turns: one answers, the other asks one more question.</li>
              <li>Don’t stop to correct. Save corrections for the end.</li>
            </ul>
          </SqCardText>
        </SqCard>
        <ActionBar>
          <SqBtn color="primary" size="large" @click="begin">Start {{ TALK_MINUTES }} minutes</SqBtn>
          <SqBtn variant="text" @click="anotherTopic">Another topic</SqBtn>
        </ActionBar>
      </template>
    </template>
  </section>
</template>
