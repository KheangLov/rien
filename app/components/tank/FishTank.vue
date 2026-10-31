<script setup lang="ts">
import type { AchievementFish, SkillFish } from '#shared/utils/tank'
import FishSprite from './FishSprite.vue'

// The aquarium: water, sand, plants and bubbles, with every fish swimming.
// Each fish is a button; hungry and sick fish swim slower, a dead fish floats
// belly-up at the surface, and eggs rest on the sand until they hatch.
const props = defineProps<{ skills: readonly SkillFish[], awards: readonly AchievementFish[], selected?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const WIDTH = { egg: 34, baby: 30, young: 42, adult: 56, giant: 72 } as const

// A stable pseudo-random number per fish, so it keeps its lane between visits.
function seed(id: string) {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

const swimmers = computed(() => {
  const fish = [
    ...props.skills.filter(f => f.stage !== 'egg'),
    ...props.awards.filter(a => a.unlocked),
  ]
  return fish.map((f, i) => {
    const r = seed(f.id)
    const health = f.kind === 'skill' ? f.health : 'happy'
    const width = f.kind === 'skill' ? WIDTH[f.stage] : 40
    const slow = { happy: 1, fine: 1.15, hungry: 1.7, sick: 2.6, dead: 0 }[health]
    return {
      fish: f,
      health,
      width,
      label: f.kind === 'skill' ? `${f.title}, ${f.stage} ${f.species.name}, ${health}` : `${f.title}, ${f.species.name}`,
      style: health === 'dead'
        ? { '--w': `${width}px`, 'left': `${12 + r * 60}%`, 'top': '3%' }
        : {
            '--w': `${width}px`,
            '--dur': `${(16 + r * 12) * slow}s`,
            '--delay': `${-r * 30 - i * 3}s`,
            'top': `${12 + ((i * 37 + r * 50) % 58)}%`,
          },
    }
  })
})

const eggs = computed(() => props.skills.filter(f => f.stage === 'egg'))
const bubbles = Array.from({ length: 8 }, (_, i) => ({ left: `${8 + i * 11}%`, delay: `${-i * 1.7}s`, size: 4 + (i % 3) * 3 }))
</script>

<template>
  <div class="rien-tank" role="group" aria-label="Your fish tank">
    <span
      v-for="(b, i) in bubbles"
      :key="i"
      class="rien-bubble"
      :style="{ left: b.left, animationDelay: b.delay, width: `${b.size}px`, height: `${b.size}px` }"
    />

    <svg class="rien-tank-floor" viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40 Q60 24 120 36 T240 34 T400 30 V80 H0 Z" fill="#e7d4a8" />
      <path d="M0 52 Q80 40 160 50 T320 46 T400 48 V80 H0 Z" fill="#d6bf8a" />
      <circle cx="70" cy="58" r="9" fill="#a8a29e" />
      <circle cx="300" cy="60" r="12" fill="#78716c" />
      <circle cx="318" cy="64" r="7" fill="#a8a29e" />
    </svg>
    <svg class="rien-plant" style="left: 6%" viewBox="0 0 40 120" aria-hidden="true"><path d="M20 120 C5 90 35 70 18 40 C8 22 26 10 22 0" stroke="#15803d" stroke-width="6" fill="none" stroke-linecap="round" /></svg>
    <svg class="rien-plant is-slow" style="left: 78%" viewBox="0 0 40 120" aria-hidden="true"><path d="M20 120 C30 92 6 76 22 48 C30 30 14 18 20 4" stroke="#16a34a" stroke-width="6" fill="none" stroke-linecap="round" /></svg>
    <svg class="rien-plant is-short" style="left: 88%" viewBox="0 0 40 120" aria-hidden="true"><path d="M20 120 C10 100 30 88 20 70" stroke="#22c55e" stroke-width="7" fill="none" stroke-linecap="round" /></svg>

    <button
      v-for="egg in eggs"
      :key="egg.id"
      type="button"
      class="rien-egg"
      :class="{ 'is-selected': selected === egg.id }"
      :style="{ left: `${10 + seed(egg.id) * 75}%` }"
      :aria-label="`${egg.title}, an egg. Play its game to hatch it.`"
      @click="emit('select', egg.id)"
    >
      <FishSprite :species="egg.species" stage="egg" :width="WIDTH.egg" />
    </button>

    <button
      v-for="s in swimmers"
      :key="s.fish.id"
      type="button"
      class="rien-fish"
      :class="[`is-${s.health}`, { 'is-selected': selected === s.fish.id }]"
      :style="s.style"
      :aria-label="s.label"
      @click="emit('select', s.fish.id)"
    >
      <span class="rien-fish-bob">
        <FishSprite
          :species="s.fish.species"
          :stage="s.fish.kind === 'skill' ? s.fish.stage : 'adult'"
          :health="s.health"
          :width="s.width"
        />
      </span>
    </button>
  </div>
</template>
