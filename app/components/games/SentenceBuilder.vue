<script setup lang="ts">
import type { GrammarRow } from '#shared/schemas/db'
import { builderTiles, endMark, gradeBuilder, isCorrect, type BuilderCard, type Tile } from '#shared/utils/builder'
import { pickRound, topUpRound } from '#shared/utils/rounds'
import RuleVisual from '~/components/learn/RuleVisual.vue'

const ROUND_SIZE = 6
const MAX_ATTEMPTS = 2

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const loading = ref(true)
const loadError = ref(false)
const round = ref<BuilderCard[]>([])
const states = ref(new Map<string, GrammarRow>())
const position = ref(0)
const pool = ref<Tile[]>([])
const placed = ref<Tile[]>([])
const attempts = ref(0)
const phase = ref<'build' | 'retry' | 'result'>('build')
const solved = ref(false)
const clean = ref(0)

const card = computed(() => round.value[position.value])
const finished = computed(() => !loading.value && round.value.length > 0 && position.value >= round.value.length)
const progress = computed(() =>
  round.value.length ? Math.round((position.value / round.value.length) * 100) : 0)

onMounted(async () => {
  try {
    const practice = await loadPractice()
    states.value = practice.states
    round.value = topUpRound(pickRound(practice.builderCards, practice.states, practice.counts, practice.now, ROUND_SIZE), practice.builderCards, practice.states, ROUND_SIZE)
    startCard()
  }
  catch (error) {
    console.error('[rien] could not start Sentence Builder', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function startCard() {
  if (!card.value) return
  pool.value = builderTiles(card.value)
  placed.value = []
  attempts.value = 0
  solved.value = false
  phase.value = 'build'
}

function place(tile: Tile) {
  if (phase.value === 'result') return
  haptic('tap')
  pool.value = pool.value.filter(t => t.id !== tile.id)
  placed.value = [...placed.value, tile]
}

function unplace(tile: Tile) {
  if (phase.value === 'result') return
  placed.value = placed.value.filter(t => t.id !== tile.id)
  pool.value = [...pool.value, tile]
}

const { combo, best, cheer, hit, miss } = useCombo()

async function check() {
  const current = card.value
  if (!current || pool.value.length > 0) return
  attempts.value++
  const words = placed.value.map(t => t.word)
  solved.value = isCorrect(current, words)
  haptic(solved.value ? (attempts.value === 1 ? 'success' : 'warning') : 'error')
  if (!solved.value && attempts.value < MAX_ATTEMPTS) {
    phase.value = 'retry'
    return
  }
  phase.value = 'result'
  const { row, mistake } = gradeBuilder(current, states.value.get(current.itemId), attempts.value, solved.value, words.join(' '), new Date())
  states.value.set(row.itemId, row)
  if (!mistake) {
    clean.value++
    hit()
  }
  else miss()
  await db.saveGrammarAnswer(row, mistake)
}

function next() {
  position.value++
  if (finished.value) emit('done', { clean: clean.value, total: round.value.length })
  else startCard()
}
</script>

<template>
  <section class="rien-stack">
    <div class="rien-round-top">
      <SqProgressLinear :model-value="progress" color="primary" />
      <ComboChip :combo="combo" :cheer="cheer" />
    </div>

    <SqSkeleton v-if="loading" height="220" />

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
      text="Every sentence is resting. They come back when they are due."
    />

    <template v-else-if="finished">
      <SqCard title="Round done" variant="tonal" class="rien-pop">
        <Confetti />
        <SqCardText>
          <p class="rien-big">{{ clean }} / {{ round.length }}</p>
          <p v-if="best >= 3" class="rien-best-combo"><RienIcon name="flame" :size="18" weight="fill" /> Best streak: {{ best }} in a row</p>
          <p class="rien-muted">built right first time.</p>
        </SqCardText>
        <SqCardActions>
          <SqBtn to="/" color="primary">Back to today</SqBtn>
        </SqCardActions>
      </SqCard>
      <NewContent :kinds="['builder']" />
    </template>

    <SqCard v-else-if="card" :key="`${card.itemId}-${position}`" class="rien-rise">
      <SqCardText class="rien-stack rien-card-body">
        <p class="rien-muted">Tap the words in order. Tap a placed word to send it back.</p>

        <div class="rien-built" :class="{ 'is-empty': placed.length === 0 }" aria-label="Your sentence">
          <button
            v-for="tile in placed"
            :key="tile.id"
            type="button"
            class="rien-token"
            :disabled="phase === 'result'"
            @click="unplace(tile)"
          >
            {{ tile.word }}
          </button>
          <span v-if="placed.length" class="rien-end-mark">{{ endMark(card.text) }}</span>
        </div>

        <div v-if="phase !== 'result'" class="rien-sentence" aria-label="Words to place">
          <button
            v-for="tile in pool"
            :key="tile.id"
            type="button"
            class="rien-token"
            @click="place(tile)"
          >
            {{ tile.word }}
          </button>
        </div>

        <SqAlert v-if="phase === 'retry'" class="rien-shake" type="warning" variant="tonal" text="Not quite. Move some words and try again." />

        <template v-if="phase === 'result'">
          <SqAlert
            :type="solved && attempts === 1 ? 'success' : solved ? 'warning' : 'error'"
            variant="tonal"
            :title="solved ? (attempts === 1 ? 'Correct' : 'Correct on the second try') : 'Here it is'"
            :text="card.tip"
          />
          <p class="rien-sentence-fixed rien-pop">{{ card.text }}</p>
          <RuleVisual v-if="!solved || attempts > 1" type="word-order" />
        </template>

        <ActionBar>
          <SqBtn v-if="phase !== 'result'" color="primary" size="large" :disabled="pool.length > 0" @click="check">Check</SqBtn>
          <SqBtn v-else color="primary" size="large" @click="next">Next</SqBtn>
          <SqBtn v-if="phase === 'result' && canSpeak" variant="tonal" size="large" aria-label="Hear it" @click="speak(card.text)"><RienIcon name="volume" weight="fill" /></SqBtn>
        </ActionBar>
      </SqCardText>
    </SqCard>
  </section>
</template>
