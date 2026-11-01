<script setup lang="ts">
// A short burst of confetti when a round is finished (only with motion on).
const COLORS = ['#14b8a6', '#38bdf8', '#f472b6', '#facc15', '#a78bfa', '#fb923c']
const pieces = Array.from({ length: 36 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  background: COLORS[i % COLORS.length],
  '--x': `${((i * 53) % 120) - 60}px`,
  '--r': `${360 + ((i * 97) % 540)}deg`,
  '--d': `${1.3 + ((i * 7) % 10) / 10}s`,
  '--delay': `${((i * 13) % 30) / 100}s`,
}))
const show = ref(false)
onMounted(() => {
  show.value = document.documentElement.classList.contains('rien-motion')
  if (show.value) setTimeout(() => { show.value = false }, 2600)
})
</script>

<template>
  <div v-if="show" class="rien-confetti" aria-hidden="true">
    <i v-for="(p, i) in pieces" :key="i" :style="p" />
  </div>
</template>
