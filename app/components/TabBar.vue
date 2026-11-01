<script setup lang="ts">
import type { IconName } from './RienIcon.vue'

// A floating glass capsule. A glass lens slides to the selected tab.
const tabs: { to: string, label: string, icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/words', label: 'Words', icon: 'words' },
  { to: '/tank', label: 'Tank', icon: 'fish' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/settings', label: 'Me', icon: 'me' },
]

const route = useRoute()
const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
const index = computed(() => Math.max(0, tabs.findIndex(t => active(t.to))))
</script>

<template>
  <nav class="rien-tabbar-wrap" aria-label="Main">
    <Squircle class="rien-tabbar rien-glass-surface" :radius="30">
      <Squircle class="rien-tab-lens" :radius="24" :style="{ '--i': index }" aria-hidden="true" />
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="rien-tab"
        :class="{ 'is-active': active(tab.to) }"
        :aria-current="active(tab.to) ? 'page' : undefined"
        @click="haptic('tap')"
      >
        <RienIcon :name="tab.icon" :size="25" :weight="active(tab.to) ? 'fill' : 'regular'" />
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </Squircle>
  </nav>
</template>
