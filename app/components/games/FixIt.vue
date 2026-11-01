<script setup lang="ts">
import { MISTAKE_LABELS, type GrammarRow, type MistakeType } from '#shared/schemas/db'
import type { FixItCard } from '#shared/utils/fixit'
import { pickRound } from '#shared/utils/rounds'
import FixItItem from '~/components/items/FixItItem.vue'

const ROUND_SIZE = 8

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const loading = ref(true)
const loadError = ref(false)
const round = ref<FixItCard[]>([])
const states = ref(new Map<string, GrammarRow>())
const position = ref(0)
const clean = ref(0)
const missedTypes = ref<MistakeType[]>([])

const card = computed(() => round.value[position.value])
const finished = computed(() => !loading.value && round.value.length > 0 && position.value >= round.value.length)
const progress = computed(() =>
  round.value.length ? Math.round((position.value / round.value.length) * 100) : 0)
const practiceLabels = computed(() => [...new Set(missedTypes.value)].map(type => MISTAKE_LABELS[type]))

onMounted(async () => {
  try {
    const practice = await loadPractice()
    states.value = practice.states
    round.value = pickRound(practice.fixCards, practice.states, practice.counts, practice.now, ROUND_SIZE)
  }
  catch (error) {
    console.error('[rien] could not start Fix It', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

function onAnswered({ row, slipped }: { row: GrammarRow, slipped: boolean }) {
  states.value.set(row.itemId, row)
  if (slipped) missedTypes.value.push(row.type)
  else clean.value++
}

function next() {
  position.value++
  if (finished.value) emit('done', { clean: clean.value, total: round.value.length })
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
      title="Could not load the sentences"
      text="Open Rien once while online so it can save them for offline use."
    />

    <SqEmptyState
      v-else-if="round.length === 0"
      title="All caught up"
      text="You have practised every sentence for now. They come back when they are due."
    />

    <SqCard v-else-if="finished" title="Round done" variant="tonal" class="rien-pop">
      <Confetti />
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

    <FixItItem
      v-else-if="card"
      :key="`${card.itemId}-${position}`"
      :card="card"
      :previous="states.get(card.itemId)"
      @answered="onAnswered"
      @next="next"
    />
  </section>
</template>
