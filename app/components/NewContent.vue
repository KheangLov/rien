<script setup lang="ts">
import { FEW_NEW, newItems, nextLevel, type ContentKind } from '#shared/utils/freshness'

// When she has met nearly everything of these kinds at her File, says so and
// offers the next File that brings new ones, in one tap (shared/utils/freshness.ts).
// Shown at the end of a round and on Today.
const props = defineProps<{ kinds: ContentKind[] }>()

const LABELS: Record<ContentKind, string> = {
  fixIt: 'Fix It sentences',
  builder: 'Sentence Builder sentences',
  radio: 'Gap Radio stories',
  soundPairs: 'sound pairs',
}

const db = useDb()
const route = useRoute()
const state = ref<{ file: number, left: number, next?: { file: number, count: number } } | null>(null)
const moved = ref<number | null>(null)

const what = computed(() => props.kinds.length > 1 ? 'questions' : LABELS[props.kinds[0]!])

onMounted(async () => {
  try {
    const [packs, settings, rows] = await Promise.all([usePacks(), db.getSettings(), db.grammarStates()])
    const seen = new Set(rows.map(row => row.itemId))
    const left = newItems(packs, settings, seen, props.kinds)
    if (left >= FEW_NEW) return
    state.value = { file: settings.file, left, next: nextLevel(packs, settings, seen, props.kinds) }
  }
  catch (error) {
    console.error('[rien] could not check for new content', error)
  }
})

async function moveUp() {
  const next = state.value?.next
  if (!next) return
  await db.saveSettings({ file: next.file })
  moved.value = next.file
  haptic('success')
}

// On a game's own page, a fresh round with the new File's items.
function playNow() {
  void navigateTo({ path: route.path, query: { round: Date.now() } })
}
</script>

<template>
  <SqCard v-if="state && (state.next || state.left === 0)" variant="outlined" class="rien-new-content">
    <SqCardText class="rien-install">
      <span class="rien-new-icon"><RienIcon :name="moved ? 'check' : 'sparkles'" :size="26" weight="duotone" /></span>
      <div>
        <template v-if="moved">
          <strong>Now on File {{ moved }}</strong>
          <p class="rien-muted">Your next rounds bring its new {{ what }}.</p>
        </template>
        <template v-else-if="state.next">
          <strong>Ready for something new?</strong>
          <p class="rien-muted">
            {{ state.left === 0 ? `You have met every one of the ${what} up to File ${state.file}.` : `Only ${state.left} new ${what} left up to File ${state.file}.` }}
            File {{ state.next.file }} adds {{ state.next.count }}. Is the class there yet?
          </p>
        </template>
        <template v-else>
          <strong>You have met them all</strong>
          <p class="rien-muted">Every one of the {{ what }} so far. They keep coming back, mixed up, to practise; new ones arrive with Rien's updates.</p>
        </template>
      </div>
    </SqCardText>
    <SqCardActions v-if="state.next && !moved">
      <SqBtn color="primary" @click="moveUp">Move to File {{ state.next.file }}</SqBtn>
    </SqCardActions>
    <SqCardActions v-else-if="moved && route.path.startsWith('/games/')">
      <SqBtn color="primary" @click="playNow">Play a new round</SqBtn>
    </SqCardActions>
  </SqCard>
</template>
