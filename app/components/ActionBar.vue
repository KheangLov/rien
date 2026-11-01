<script setup lang="ts">
// The main buttons, pinned to the bottom of the screen. Teleported to <body>:
// a glass blur or a motion transform on any ancestor would otherwise capture
// `position: fixed` and pin the bar to the card instead of the screen.
withDefaults(defineProps<{ fixed?: boolean }>(), { fixed: true })
</script>

<template>
  <Teleport to="body" :disabled="!fixed">
    <div class="rien-row" :class="{ 'rien-actionbar': fixed }">
      <slot />
    </div>
  </Teleport>
</template>
