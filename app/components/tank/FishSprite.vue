<script setup lang="ts">
import type { Health, Species, Stage } from '#shared/utils/tank'

// One fish, facing right, drawn from its species. Health shows as fading
// colour; a dead fish is grey with crossed-out eyes. An egg is a small clutch.
const props = defineProps<{
  species: Species
  stage?: Stage
  health?: Health
  width?: number
  // Grey outline for an achievement not unlocked yet.
  silhouette?: boolean
}>()

const id = useId()
const h = computed(() => Math.min(56, Math.max(22, 70 / props.species.shape)))
const top = computed(() => 30 - h.value / 2)
const dead = computed(() => props.health === 'dead')
const filter = computed(() => ({
  happy: undefined,
  fine: undefined,
  hungry: 'saturate(0.5)',
  sick: 'grayscale(0.85) brightness(0.95)',
  dead: 'grayscale(1)',
})[props.health ?? 'happy'])
const body = computed(() => (props.silhouette ? '#94a3b8' : props.species.body))
const fin = computed(() => (props.silhouette ? '#cbd5e1' : props.species.fin))
</script>

<template>
  <svg
    v-if="stage === 'egg'"
    :width="width ?? 40"
    :height="(width ?? 40) * 0.6"
    viewBox="0 0 100 60"
    aria-hidden="true"
  >
    <g :fill="species.body" opacity="0.85" stroke="#ffffff" stroke-width="3">
      <circle cx="36" cy="38" r="14" />
      <circle cx="62" cy="40" r="13" />
      <circle cx="50" cy="22" r="13" />
    </g>
    <g fill="#ffffff" opacity="0.7">
      <circle cx="32" cy="34" r="3" />
      <circle cx="58" cy="36" r="3" />
      <circle cx="46" cy="18" r="3" />
    </g>
  </svg>
  <svg
    v-else
    :width="width ?? 60"
    :height="(width ?? 60) * 0.6"
    viewBox="0 0 100 60"
    :style="{ filter, opacity: dead ? 0.75 : silhouette ? 0.55 : 1 }"
    aria-hidden="true"
  >
    <defs>
      <clipPath :id="`${id}-body`">
        <ellipse cx="56" cy="30" rx="34" :ry="h / 2" />
      </clipPath>
    </defs>
    <path :d="`M24 30 L4 ${30 - h / 2.1} Q10 30 4 ${30 + h / 2.1} Z`" :fill="fin" />
    <path :d="`M42 ${top + 3} Q56 ${top - 12} 72 ${top + 4} Z`" :fill="fin" />
    <path :d="`M46 ${top + h - 3} Q56 ${top + h + 9} 66 ${top + h - 4} Z`" :fill="fin" />
    <ellipse cx="56" cy="30" rx="34" :ry="h / 2" :fill="body" />
    <g v-if="species.stripe && !silhouette" :clip-path="`url(#${id}-body)`" :fill="species.stripe">
      <rect x="47" y="0" width="6" height="60" />
      <rect x="66" y="0" width="5" height="60" />
    </g>
    <path d="M86 33 q-3 2 -6 1" stroke="#1f2937" stroke-width="1.6" fill="none" stroke-linecap="round" />
    <template v-if="!silhouette">
      <g v-if="dead" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round">
        <path d="M74 23 l6 6 M80 23 l-6 6" />
      </g>
      <g v-else>
        <circle cx="77" cy="26" r="4.2" fill="#ffffff" />
        <circle cx="78" cy="26" r="2.1" fill="#0f172a" />
      </g>
    </template>
  </svg>
</template>
