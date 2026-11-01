<script setup lang="ts">
// The streak of right answers in this round, next to the progress bar. It pops
// on every new answer in a row and gets hotter at 3, 5 and 8.
defineProps<{ combo: number, cheer?: string }>()
</script>

<template>
  <Transition name="rien-combo">
    <span
      v-if="combo >= 2"
      :key="combo"
      class="rien-combo"
      :class="{ 'is-hot': combo >= 5, 'is-blazing': combo >= 8 }"
      role="status"
      :aria-label="`${combo} right in a row`"
    >
      <RienIcon name="flame" :size="18" weight="fill" />
      <b>{{ combo }}</b>
      <span>{{ cheer ?? 'in a row' }}</span>
    </span>
  </Transition>
</template>
