<script setup lang="ts">
import { MISTAKE_LABELS, type MistakeType } from '#shared/schemas/db'
import { builderCards } from '#shared/utils/builder'
import { fixItCards, packsFor } from '#shared/utils/fixit'
import { radioCards } from '#shared/utils/radio'
import { describeSlip, slipSummary, type Slip } from '#shared/utils/slips'
import { soundCards } from '#shared/utils/sounds'
import { addDays } from '#shared/utils/streak'
import { talkCards } from '#shared/utils/talks'
import FixIt from '~/components/games/FixIt.vue'
import type { GameId } from '~/utils/activities'

// My slips: her mistakes from the last 30 days, from every activity, each
// shown as what she said and the right way. "Practise my slips" plays a Fix It
// round made from them; slips that Fix It cannot train (sounds, listening, word
// order) point to the activity that does.
useHead({ title: 'My slips · Rien' })

// Most slips listed at once (the summary counts them all).
const SHOWN = 40
const PRACTICE_FOR: Partial<Record<MistakeType, GameId>> = {
  'final-sound': 'sound-hunter',
  'sound': 'sound-hunter',
  'listening': 'gap-radio',
  'word-order': 'sentence-builder',
}

const db = useDb()
const recorder = useActivityRecorder()
const loading = ref(true)
const slips = ref<Slip[]>([])
const practising = ref(false)
// A new round each time "Practise" is tapped.
const round = ref(0)

const summary = computed(() => slipSummary(slips.value))
const grammarSlips = computed(() => summary.value.some(s => !PRACTICE_FOR[s.type]))
const otherPractice = computed(() => [...new Set(summary.value.flatMap(s => PRACTICE_FOR[s.type] ?? []))])

onMounted(async () => {
  try {
    const now = new Date()
    const [packs, settings, mistakes, cards] = await Promise.all([
      usePacks(),
      db.getSettings(),
      db.mistakesSince(addDays(now, -WEAK_SPOT_DAYS)),
      db.allCards(),
    ])
    const active = packsFor(packs, settings)
    const byItem = <T extends { itemId: string }>(list: T[]) => new Map(list.map(item => [item.itemId, item]))
    const lookup = {
      fix: byItem(fixItCards(active)),
      builder: byItem(builderCards(active)),
      sound: byItem(soundCards(active)),
      radio: byItem(radioCards(active)),
      words: new Map(cards.map(card => [card.id, card])),
      talks: new Map(talkCards(packs).map(talk => [talk.talkId, talk.topic])),
    }
    slips.value = mistakes
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map(m => describeSlip(m, lookup))
  }
  catch (error) {
    console.error('[rien] could not load slips', error)
  }
  finally {
    loading.value = false
  }
})

function practise() {
  round.value++
  practising.value = true
  recorder.restart()
}

const when = (at: Date) => {
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000)
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
}
</script>

<template>
  <div class="rien-page rien-game">
    <div class="rien-game-bar">
      <NuxtLink to="/" class="rien-icon-btn" aria-label="Close">
        <RienIcon name="close" weight="bold" />
      </NuxtLink>
      <h1 class="rien-subbar-title">My slips</h1>
      <span />
    </div>

    <SqSkeleton v-if="loading" height="240" />

    <FixIt v-else-if="practising" :key="round" slips @done="recorder.record('fix-it', $event)" />

    <SqEmptyState
      v-else-if="slips.length === 0"
      title="No slips lately"
      text="Nothing missed in the last 30 days. Keep going, and slips you make will show up here to practise."
    />

    <template v-else>
      <SqCard class="rien-slips-head">
        <SqCardText class="rien-stack rien-card-body">
          <p class="rien-slips-total"><b>{{ slips.length }}</b> {{ slips.length === 1 ? 'slip' : 'slips' }} in the last 30 days</p>
          <div class="rien-slips-kinds">
            <span v-for="kind in summary" :key="kind.type" class="rien-slips-kind">
              {{ MISTAKE_LABELS[kind.type] }} <b>{{ kind.count }}</b>
            </span>
          </div>
          <SqBtn v-if="grammarSlips" color="primary" size="large" block @click="practise">
            <RienIcon name="fix-it" :size="20" weight="bold" /> Practise my slips
          </SqBtn>
          <div v-if="otherPractice.length" class="rien-row">
            <SqBtn v-for="game in otherPractice" :key="game" variant="tonal" :to="`/games/${game}`">
              <RienIcon :name="ACTIVITIES[game].icon" :size="18" weight="bold" /> {{ ACTIVITIES[game].title }}
            </SqBtn>
          </div>
        </SqCardText>
      </SqCard>

      <h2 class="rien-section-title">Recent</h2>
      <ul class="rien-slips">
        <li v-for="(slip, i) in slips.slice(0, SHOWN)" :key="i" class="rien-slip">
          <div class="rien-slip-meta">
            <span class="rien-slips-kind">{{ MISTAKE_LABELS[slip.type] }}</span>
            <span class="rien-muted">{{ slip.source }} · {{ when(slip.at) }}</span>
          </div>
          <p v-if="slip.said && slip.right" class="rien-slip-pair">
            <s>{{ slip.said }}</s>
            <span><RienIcon name="check" :size="16" weight="bold" /> {{ slip.right }}</span>
          </p>
          <p v-else-if="slip.right" class="rien-slip-pair"><span><RienIcon name="check" :size="16" weight="bold" /> {{ slip.right }}</span></p>
          <p v-if="slip.note" class="rien-slip-note">{{ slip.note }}</p>
        </li>
      </ul>
    </template>
  </div>
</template>
