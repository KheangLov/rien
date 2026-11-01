<script setup lang="ts">
import type { GrammarRow } from '#shared/schemas/db'
import { SOUND_FOCUS_LABELS, type SoundFocus } from '#shared/schemas/pack'
import { pickRound, topUpRound } from '#shared/utils/rounds'
import type { SoundCard } from '#shared/utils/sounds'
import SoundItem from '~/components/items/SoundItem.vue'

const ROUND_SIZE = 10

const emit = defineEmits<{ done: [summary: { clean: number, total: number }] }>()

const loading = ref(true)
const loadError = ref(false)
const round = ref<SoundCard[]>([])
const states = ref(new Map<string, GrammarRow>())
const position = ref(0)
const clean = ref(0)
const missedFocus = ref<SoundFocus[]>([])

const card = computed(() => round.value[position.value])
const finished = computed(() => !loading.value && round.value.length > 0 && position.value >= round.value.length)
const progress = computed(() =>
  round.value.length ? Math.round((position.value / round.value.length) * 100) : 0)
const practiceLabels = computed(() => [...new Set(missedFocus.value)].map(focus => SOUND_FOCUS_LABELS[focus]))

onMounted(async () => {
  try {
    const practice = await loadPractice()
    states.value = practice.states
    round.value = topUpRound(pickRound(practice.soundCards, practice.states, practice.counts, practice.now, ROUND_SIZE, Math.random, practice.rankFor('sound')), practice.soundCards, practice.states, ROUND_SIZE)
  }
  catch (error) {
    console.error('[rien] could not start Final Sound Hunter', error)
    loadError.value = true
  }
  finally {
    loading.value = false
  }
})

const { combo, best, cheer, hit, miss } = useCombo()

function onAnswered({ row, slipped }: { row: GrammarRow, slipped: boolean }) {
  if (slipped) miss()
  else hit()
  states.value.set(row.itemId, row)
  if (slipped) missedFocus.value.push(card.value!.focus)
  else clean.value++
}

function next() {
  position.value++
  if (finished.value) emit('done', { clean: clean.value, total: round.value.length })
}
</script>

<template>
  <section class="rien-stack">
    <div class="rien-round-top">
      <SqProgressLinear :model-value="progress" color="primary" />
      <ComboChip :combo="combo" :cheer="cheer" />
    </div>

    <SqSkeleton v-if="loading" height="200" />

    <SqAlert
      v-else-if="loadError"
      type="error"
      variant="tonal"
      title="Could not load the sound pairs"
      text="Open Rien once while online so it can save them for offline use."
    />

    <SqEmptyState
      v-else-if="round.length === 0"
      title="All caught up"
      text="Every sound pair is resting. They come back when they are due."
    />

    <template v-else-if="finished">
      <SqCard title="Round done" variant="tonal" class="rien-pop">
        <Confetti />
        <SqCardText>
          <p class="rien-big">{{ clean }} / {{ round.length }}</p>
          <p v-if="best >= 3" class="rien-best-combo"><RienIcon name="flame" :size="18" weight="fill" /> Best streak: {{ best }} in a row</p>
          <p class="rien-muted">heard right.</p>
          <p v-if="practiceLabels.length" class="rien-muted">
            To practise: {{ practiceLabels.join(', ') }}.
          </p>
        </SqCardText>
        <SqCardActions>
          <SqBtn to="/" color="primary">Back to today</SqBtn>
        </SqCardActions>
      </SqCard>
      <NewContent :kinds="['soundPairs']" />
    </template>

    <SoundItem
      v-else-if="card"
      :key="`${card.itemId}-${position}`"
      :card="card"
      :previous="states.get(card.itemId)"
      @answered="onAnswered"
      @next="next"
    />
  </section>
</template>
