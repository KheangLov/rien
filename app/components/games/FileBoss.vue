<script setup lang="ts">
import { BOOK_LABELS, partLabel, type GrammarRow, type Settings } from '#shared/schemas/db'
import { buildBossQuiz, type BossQuestion } from '#shared/utils/boss'
import FixItItem from '~/components/items/FixItItem.vue'
import SoundItem from '~/components/items/SoundItem.vue'
import WordItem from '~/components/items/WordItem.vue'

// 80% or more counts as a strong File.
const STRONG_SHARE = 0.8

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()

const loading = ref(true)
const loadError = ref(false)
const settings = ref<Settings | null>(null)
const quiz = ref<BossQuestion[]>([])
const wordCount = ref(0)
const states = ref(new Map<string, GrammarRow>())
const position = ref(0)
const score = ref(0)
const missedKinds = ref(new Set<BossQuestion['kind']>())

const question = computed(() => quiz.value[position.value])
const finished = computed(() => !loading.value && quiz.value.length > 0 && position.value >= quiz.value.length)
const progress = computed(() =>
  quiz.value.length ? Math.round((position.value / quiz.value.length) * 100) : 0)
const strong = computed(() => score.value >= Math.ceil(quiz.value.length * STRONG_SHARE))
const reviewList = computed(() => {
  const names = { word: 'your File words', fix: 'grammar', sound: 'sounds' } as const
  return [...missedKinds.value].map(kind => names[kind]).join(', ')
})

onMounted(async () => {
  try {
    const practice = await loadPractice()
    settings.value = practice.settings
    states.value = practice.states
    const [words, mistakes] = await Promise.all([
      db.cardsInFile(practice.settings.book, practice.settings.file),
      db.mistakesSince(practice.since),
    ])
    wordCount.value = words.length
    quiz.value = buildBossQuiz({
      words,
      fixCards: practice.fixCards,
      soundCards: practice.soundCards,
      missedItemIds: new Set(mistakes.map(m => m.itemId)),
    })
  }
  catch (error) {
    console.error('[rien] could not start File Boss', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function onWord({ result }: { result: string }) {
  if (result === 'wrong') missedKinds.value.add('word')
  else score.value++
}

function onPractice({ row, slipped }: { row: GrammarRow, slipped: boolean }) {
  states.value.set(row.itemId, row)
  if (slipped) missedKinds.value.add(question.value!.kind)
  else score.value++
}

async function next() {
  position.value++
  if (!finished.value || !settings.value) return
  await db.saveBossResult({
    book: settings.value.book,
    file: settings.value.file,
    at: new Date(),
    score: score.value,
    total: quiz.value.length,
  })
  emit('done', { clean: score.value, total: quiz.value.length })
}
</script>

<template>
  <section class="rien-stack">
    <SqProgressLinear :model-value="progress" color="primary" />

    <SqSkeleton v-if="loading" height="200" />

    <SqAlert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      title="Could not build the quiz"
      text="Open Rien once while online so it can save its content for offline use."
    />

    <template v-else-if="!finished && position === 0 && settings">
      <p class="rien-muted">
        {{ partLabel(settings.book, settings.file) }}, {{ BOOK_LABELS[settings.book] }}.
        {{ quiz.length }} questions mixing
        <template v-if="wordCount">your {{ wordCount }} {{ wordCount === 1 ? 'word' : 'words' }} from this File,</template>
        grammar and sounds, with your recent mistakes first.
      </p>
      <SqAlert
        v-if="wordCount === 0"
        type="info"
        variant="tonal"
        :text="`No words saved for File ${settings.file} yet, so this quiz uses sentences and sounds only.`"
      />
    </template>

    <SqCard v-if="finished" :title="strong ? 'File beaten' : 'Good try'" variant="tonal" class="rien-pop">
      <Confetti v-if="strong" />
      <SqCardText>
        <p class="rien-big">{{ score }} / {{ quiz.length }}</p>
        <p class="rien-muted">
          {{ strong ? 'A strong File. Move on with confidence.' : `Worth another look before moving on: ${reviewList}.` }}
        </p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
        <SqBtn to="/progress" variant="tonal">See progress</SqBtn>
      </SqCardActions>
    </SqCard>

    <template v-else-if="question && settings">
      <WordItem
        v-if="question.kind === 'word'"
        :key="`w-${position}`"
        :card="question.card"
        :khmer-hints="settings.khmerHints"
        @answered="onWord"
        @next="next"
      />
      <FixItItem
        v-else-if="question.kind === 'fix'"
        :key="`f-${position}`"
        :card="question.card"
        :previous="states.get(question.card.itemId)"
        @answered="onPractice"
        @next="next"
      />
      <SoundItem
        v-else
        :key="`s-${position}`"
        :card="question.card"
        :previous="states.get(question.card.itemId)"
        @answered="onPractice"
        @next="next"
      />
    </template>
  </section>
</template>
