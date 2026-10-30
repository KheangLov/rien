<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import type { Verdict } from '#shared/utils/answer'
import WordItem from '~/components/items/WordItem.vue'

// A missed card comes back at most this many more times in one round.
const MAX_RETRIES = 2

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const db = useDb()

const loading = ref(true)
const khmerHints = ref(true)
const queue = ref<CardRow[]>([])
const retries = new Map<string, number>()
const position = ref(0)
const right = ref(0)
const missed = ref(new Set<string>())

const card = computed(() => queue.value[position.value])
const finished = computed(() => !loading.value && position.value >= queue.value.length)
const progress = computed(() =>
  queue.value.length ? Math.round((position.value / queue.value.length) * 100) : 0)

onMounted(async () => {
  const settings = await db.getSettings()
  khmerHints.value = settings.khmerHints
  queue.value = await db.dueCards(new Date(), settings.dailyGoal)
  loading.value = false
})

function onAnswered({ card: graded, result }: { card: CardRow, result: Verdict['result'] }) {
  // Keep the updated schedule for a retry later in this round.
  queue.value[position.value] = graded
  if (result === 'wrong') {
    missed.value.add(graded.id)
    const used = retries.get(graded.id) ?? 0
    if (used < MAX_RETRIES) {
      retries.set(graded.id, used + 1)
      queue.value.push(graded)
    }
  }
  else if (!missed.value.has(graded.id)) {
    right.value++
  }
}

function next() {
  position.value++
  if (finished.value) emit('done', { clean: right.value, total: right.value + missed.value.size })
}
</script>

<template>
  <section class="rien-stack">
    <SqProgressLinear :model-value="progress" color="primary" />

    <SqSkeleton v-if="loading" height="200" />

    <SqEmptyState
      v-else-if="queue.length === 0"
      title="Nothing to review"
      text="Every word is resting. Add new ones after your next class."
    >
      <SqBtn to="/add-words" color="primary">Add words</SqBtn>
    </SqEmptyState>

    <SqCard v-else-if="finished" title="Round done" variant="tonal">
      <SqCardText>
        <p class="rien-big">{{ right }} / {{ right + missed.size }}</p>
        <p class="rien-muted">
          right first time.
          <template v-if="missed.size">
            The {{ missed.size === 1 ? 'word you missed comes' : `${missed.size} words you missed come` }} back soon.
          </template>
        </p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/" color="primary">Back to today</SqBtn>
        <SqBtn to="/add-words" variant="tonal">Add words</SqBtn>
      </SqCardActions>
    </SqCard>

    <WordItem
      v-else-if="card"
      :key="`${card.id}-${position}`"
      :card="card"
      :khmer-hints="khmerHints"
      @answered="onAnswered"
      @next="next"
    />
  </section>
</template>
