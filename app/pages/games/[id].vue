<script setup lang="ts">
import type { Component } from 'vue'
import WordRecall from '~/components/games/WordRecall.vue'

const GAMES: Record<string, { title: string, component: Component }> = {
  'word-recall': { title: 'Word Recall', component: WordRecall },
}

const route = useRoute()
const game = computed(() => GAMES[String(route.params.id)])

if (!game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Game not found', fatal: true })
}

useHead({ title: () => `${game.value?.title} · Rien` })
</script>

<template>
  <div v-if="game" class="rien-page">
    <div class="rien-row">
      <SqBtn to="/" variant="text">← Today</SqBtn>
      <SqSpacer />
      <strong>{{ game.title }}</strong>
    </div>
    <component :is="game.component" />
  </div>
</template>
