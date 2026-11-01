<script setup lang="ts">
import { BOOK_LABELS } from '#shared/schemas/db'
import { builderCards } from '#shared/utils/builder'
import { fixItCards } from '#shared/utils/fixit'
import { ACE_LEVELS_FOR_BOOK, SNOOZE_DAYS, suggestLevel, type LevelSuggestion } from '#shared/utils/levelUp'
import { addDays } from '#shared/utils/streak'

// On Today: "Ready for File 11?" once the skill model expects her to know
// most of her File and she has passed its File Boss. She decides; "Not yet"
// hides it for a week.
const db = useDb()
const now = useClock()
const settings = useLiveQuery(() => db.getSettings(), null)
const bosses = useLiveQuery(() => db.bossResults(), [])
const suggestion = ref<LevelSuggestion | null>(null)

async function check() {
  const s = settings.value
  if (!s) return
  const [learner, packs] = await Promise.all([useLearner().catch(() => undefined), usePacks()])
  if (!learner) return
  const mine = packs.filter(p => p.book === s.book && p.file === s.file)
  const snooze = s.levelSnooze
  suggestion.value = suggestLevel({
    place: { book: s.book, file: s.file },
    items: [...fixItCards(mine), ...builderCards(mine)],
    model: learner.model,
    bosses: bosses.value.filter(b => b.book === s.book && b.file === s.file),
    snoozedUntil: snooze && snooze.book === s.book && snooze.file === s.file ? snooze.until : undefined,
    now: now.value,
  })
}
watch([settings, bosses], () => void check(), { immediate: true })

const title = computed(() => {
  const s = suggestion.value
  if (!s) return ''
  return s.newBook ? `Ready for ${BOOK_LABELS[s.to.book]}?` : `Ready for File ${s.to.file}?`
})

async function moveUp() {
  const s = suggestion.value
  if (!s) return
  await db.saveSettings({ book: s.to.book, file: s.to.file })
  // The model starts each book at its level: rebuild it for the new place.
  resetLearner()
  suggestion.value = null
  haptic('success')
}

async function notYet() {
  const s = settings.value
  if (!s) return
  await db.saveSettings({ levelSnooze: { book: s.book, file: s.file, until: addDays(now.value, SNOOZE_DAYS) } })
  suggestion.value = null
}
</script>

<template>
  <SqCard v-if="suggestion" variant="tonal" class="rien-level-up rien-pop">
    <SqCardText class="rien-stack rien-card-body">
      <div class="rien-activity-head">
        <span class="rien-level-up-icon"><RienIcon name="goal" :size="26" weight="duotone" /></span>
        <div>
          <strong>{{ title }}</strong>
          <p v-if="suggestion.newBook" class="rien-muted">That's ACE {{ ACE_LEVELS_FOR_BOOK[suggestion.to.book] }}.</p>
        </div>
      </div>
      <p>
        Rien expects you know about <b>{{ Math.round(suggestion.mastery * 100) }}%</b> of File {{ settings?.file }}'s sentences,
        and you scored <b>{{ suggestion.boss.score }} / {{ suggestion.boss.total }}</b> in its File Boss.
        Check with your teacher too: your class decides when you move.
      </p>
    </SqCardText>
    <SqCardActions>
      <SqBtn variant="text" @click="notYet">Not yet</SqBtn>
      <SqBtn color="primary" @click="moveUp">Move up</SqBtn>
    </SqCardActions>
  </SqCard>
</template>
