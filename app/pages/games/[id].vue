<script setup lang="ts">
import type { Component } from 'vue'
import { dateKey } from '#shared/utils/streak'
import CoupleTalk from '~/components/games/CoupleTalk.vue'
import FileBoss from '~/components/games/FileBoss.vue'
import FixIt from '~/components/games/FixIt.vue'
import SoundHunter from '~/components/games/SoundHunter.vue'
import WordRecall from '~/components/games/WordRecall.vue'

const GAMES: Record<string, { title: string, component: Component }> = {
  'word-recall': { title: 'Word Recall', component: WordRecall },
  'fix-it': { title: 'Fix It', component: FixIt },
  'sound-hunter': { title: 'Final Sound Hunter', component: SoundHunter },
  'file-boss': { title: 'File Boss', component: FileBoss },
  'couple-talk': { title: 'Couple Talk', component: CoupleTalk },
}

const route = useRoute()
const game = computed(() => GAMES[String(route.params.id)])

if (!game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Game not found', fatal: true })
}

useHead({ title: () => `${game.value?.title} · Rien` })

const db = useDb()
const startedAt = Date.now()

// A finished round counts towards today's session and the streak.
async function recordDone() {
  const minutes = Math.min(60, (Date.now() - startedAt) / 60_000)
  await db.recordActivity(dateKey(new Date()), String(route.params.id), minutes)
}
</script>

<template>
  <div v-if="game" class="rien-page">
    <div class="rien-row">
      <SqBtn to="/" variant="text">← Today</SqBtn>
      <SqSpacer />
      <strong>{{ game.title }}</strong>
    </div>
    <component :is="game.component" @done="recordDone" />
  </div>
</template>
