<script setup lang="ts">
import type { IconName } from './RienIcon.vue'

const tabs: { to: string, label: string, icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/words', label: 'Words', icon: 'words' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/settings', label: 'Me', icon: 'me' },
]

const route = useRoute()
const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

function select() {
  haptic('tap')
}
</script>

<template>
  <nav class="rien-tabbar" aria-label="Main">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="rien-tab"
      :class="{ 'is-active': active(tab.to) }"
      :aria-current="active(tab.to) ? 'page' : undefined"
      @click="select"
    >
      <RienIcon :name="tab.icon" :size="26" />
      <span>{{ tab.label }}</span>
    </NuxtLink>
  </nav>
</template>
