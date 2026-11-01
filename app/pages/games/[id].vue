<script setup lang="ts">
import { GAME_COMPONENTS } from '~/components/games/registry'
import type { GameId } from '~/utils/activities'

const route = useRoute()
const id = computed(() => String(route.params.id) as GameId)
const game = computed(() => (id.value in GAME_COMPONENTS
  ? { ...ACTIVITIES[id.value], component: GAME_COMPONENTS[id.value] }
  : undefined))

if (!game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Game not found', fatal: true })
}

useHead({ title: () => `${game.value?.title} · Rien` })

const recorder = useActivityRecorder()
</script>

<template>
  <div v-if="game" class="rien-page rien-game">
    <div class="rien-game-bar">
      <NuxtLink to="/" class="rien-icon-btn" aria-label="Close">
        <RienIcon name="close" weight="bold" />
      </NuxtLink>
      <h1 class="rien-subbar-title">{{ game.title }}</h1>
      <span />
    </div>
    <!-- A new key ("Play a new round") starts the game afresh. -->
    <component :is="game.component" :key="String(route.query.round ?? '')" @done="recorder.record(id, $event)" />
  </div>
</template>
