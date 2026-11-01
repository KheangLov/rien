<script setup lang="ts">
// Large title for a tab, or a small bar with a back button for a sub-page.
defineProps<{ title: string, subtitle?: string, back?: string }>()
</script>

<template>
  <header v-if="back" class="rien-subbar">
    <NuxtLink :to="back" class="rien-subbar-back" aria-label="Back">
      <RienIcon name="back" weight="bold" />
    </NuxtLink>
    <h1 class="rien-subbar-title">{{ title }}</h1>
    <div class="rien-subbar-end"><slot name="action" /></div>
  </header>
  <header v-else class="rien-largetitle">
    <div>
      <p v-if="subtitle" class="rien-largetitle-sub">{{ subtitle }}</p>
      <h1>{{ title }}</h1>
    </div>
    <slot name="action" />
  </header>
</template>
