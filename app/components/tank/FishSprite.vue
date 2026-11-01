<script setup lang="ts">
import type { BodyForm, Health, Species, Stage, TailForm } from '#shared/utils/tank'

// One fish, facing right, drawn from its species: body shape, tail, shading
// from back to belly, a scale texture, see-through fins with rays, gill and
// lateral lines, a lit eye and the species' markings. With motion on, the
// tail sways and the side fin flutters (slower when the fish is unwell).
// Health fades the colour; a dead fish is grey with crossed-out eyes.
const props = defineProps<{
  species: Species
  stage?: Stage
  health?: Health
  width?: number
  // Grey outline for an award not unlocked yet.
  silhouette?: boolean
}>()

const id = useId()

// Body outlines in a 120 x 70 box; the tail joins at about (32, 35).
const BODY: Record<BodyForm, string> = {
  torpedo: 'M32 35C42 20 66 14 92 19C106 22 114 29 115 35C114 41 106 48 92 51C66 56 42 50 32 35Z',
  deep: 'M33 35C38 16 64 7 90 15C106 21 113 29 114 35C113 42 106 50 90 55C64 63 38 54 33 35Z',
  disc: 'M36 35C36 12 62 3 86 8C104 13 113 26 113 35C113 46 104 58 86 62C62 67 36 58 36 35Z',
  tall: 'M38 35C46 22 62 13 82 14C99 16 110 27 112 35C110 43 99 54 82 56C62 57 46 48 38 35Z',
  long: 'M28 35C42 25 70 22 96 25C108 27 116 31 117 35C116 39 108 43 96 45C70 48 42 45 28 35Z',
}

const TAIL: Record<TailForm, string> = {
  forked: 'M36 35L10 13C14 21 19 29 20 35C19 41 14 49 10 57Z',
  round: 'M36 35C24 20 10 19 7 30C5 36 6 40 7 41C10 51 24 50 36 35Z',
  fan: 'M36 35C20 10 2 8 2 24C2 30 8 33 12 35C8 37 2 40 2 46C2 62 20 60 36 35Z',
  flowing: 'M36 35C24 6 -4 4 2 30C4 40 -2 56 8 64C22 70 30 50 36 35Z',
  lyre: 'M38 35L6 4C14 18 18 27 18 35C18 43 14 52 6 66Z',
}

// Dorsal (top), anal (bottom) and side fins per body shape.
const FINS: Record<BodyForm, { dorsal: string, anal: string, pectoral: string }> = {
  torpedo: { dorsal: 'M54 19C62 7 78 6 86 16Z', anal: 'M58 50C64 60 76 60 80 50Z', pectoral: 'M86 40C80 44 74 50 72 54C80 52 86 47 89 42Z' },
  deep: { dorsal: 'M50 16C58 0 82 0 90 15Z', anal: 'M56 56C62 68 78 66 82 55Z', pectoral: 'M86 42C80 47 74 53 72 58C80 56 87 50 90 44Z' },
  disc: { dorsal: 'M44 14C54 -2 84 -2 96 10Z', anal: 'M46 57C56 72 84 72 94 60Z', pectoral: 'M88 40C82 46 76 52 74 57C82 55 88 49 91 43Z' },
  tall: { dorsal: 'M52 18C56 0 66 -14 74 -18C76 -2 80 8 82 14Z', anal: 'M52 52C56 70 66 84 74 88C76 72 80 62 82 56Z', pectoral: 'M86 40C80 44 76 49 74 53C81 51 86 47 89 42Z' },
  long: { dorsal: 'M60 24C68 14 82 14 88 24Z', anal: 'M60 46C66 54 78 54 84 46Z', pectoral: 'M92 39C86 43 82 47 80 51C87 49 92 45 95 41Z' },
}

const EYE: Record<BodyForm, [number, number]> = {
  torpedo: [100, 31], deep: [100, 30], disc: [100, 29], tall: [98, 30], long: [104, 33],
}

// Drawing area per body shape: the angelfish's tall fins need more height.
const VIEW: Record<BodyForm, [number, number, number, number]> = {
  torpedo: [-4, -6, 124, 76], deep: [-4, -6, 124, 80], disc: [-4, -8, 124, 86], tall: [-4, -22, 124, 114], long: [-4, -2, 124, 70],
}

const view = computed(() => VIEW[props.species.form])
const height = computed(() => (props.width ?? 60) * (view.value[3] / view.value[2]))

const shape = computed(() => ({
  body: BODY[props.species.form],
  tail: TAIL[props.species.tail],
  fins: FINS[props.species.form],
  eye: EYE[props.species.form],
}))
const dead = computed(() => props.health === 'dead')
const filter = computed(() => ({
  happy: undefined,
  fine: undefined,
  hungry: 'saturate(0.55)',
  sick: 'grayscale(0.85) brightness(0.95)',
  dead: 'grayscale(1)',
})[props.health ?? 'happy'])
const tailSpeed = computed(() => ({ happy: '0.55s', fine: '0.7s', hungry: '1.1s', sick: '1.8s', dead: '0s' })[props.health ?? 'happy'])
const paint = (color: string) => (props.silhouette ? '#94a3b8' : color)
const pattern = computed(() => (props.silhouette ? undefined : props.species.pattern))
</script>

<template>
  <!-- A clutch of eggs: see-through, with an embryo in each. -->
  <svg
    v-if="stage === 'egg'"
    :width="width ?? 40"
    :height="(width ?? 40) * 0.6"
    viewBox="0 0 100 60"
    aria-hidden="true"
  >
    <defs>
      <radialGradient :id="`${id}-egg`" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95" />
        <stop offset="55%" :stop-color="species.belly" stop-opacity="0.75" />
        <stop offset="100%" :stop-color="species.back" stop-opacity="0.85" />
      </radialGradient>
    </defs>
    <g v-for="(e, i) in [[34, 40, 14], [62, 42, 13], [48, 22, 12], [74, 24, 9]]" :key="i">
      <circle :cx="e[0]" :cy="e[1]" :r="e[2]" :fill="`url(#${id}-egg)`" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.5" />
      <circle :cx="e[0]! + 2" :cy="e[1]! + 2" :r="e[2]! * 0.28" fill="#1f2937" opacity="0.55" />
      <circle :cx="e[0]! - e[2]! * 0.4" :cy="e[1]! - e[2]! * 0.45" :r="e[2]! * 0.18" fill="#ffffff" opacity="0.9" />
    </g>
  </svg>

  <svg
    v-else
    :width="width ?? 60"
    :height="height"
    :viewBox="view.join(' ')"
    class="rien-fish-svg"
    :class="{ 'is-dead': dead }"
    :style="{ filter, opacity: dead ? 0.8 : silhouette ? 0.5 : 1, '--tail': tailSpeed }"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="`${id}-body`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="paint(species.back)" />
        <stop offset="62%" :stop-color="paint(species.back)" stop-opacity="0.92" />
        <stop offset="100%" :stop-color="paint(species.belly)" />
      </linearGradient>
      <linearGradient :id="`${id}-fin`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" :stop-color="paint(species.fin)" stop-opacity="0.55" />
        <stop offset="100%" :stop-color="paint(species.fin)" stop-opacity="0.9" />
      </linearGradient>
      <radialGradient :id="`${id}-shine`" cx="65%" cy="25%" r="55%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <pattern :id="`${id}-scales`" width="7" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 6C1.5 2.5 5.5 2.5 7 6" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="0.8" />
      </pattern>
      <clipPath :id="`${id}-clip`">
        <path :d="shape.body" />
      </clipPath>
    </defs>

    <!-- Fins behind the body -->
    <path :d="shape.fins.dorsal" :fill="`url(#${id}-fin)`" />
    <g v-if="species.spines && !silhouette" :stroke="paint(species.fin)" stroke-width="1.6" stroke-linecap="round">
      <path d="M54 16L48 -12M62 13L60 -16M70 12L72 -15M78 13L84 -12M86 15L94 -6" />
    </g>
    <path :d="shape.fins.anal" :fill="`url(#${id}-fin)`" />
    <g class="rien-fish-tail">
      <path :d="shape.tail" :fill="paint(species.tailColor ?? species.fin)" fill-opacity="0.88" />
      <path v-if="!silhouette" d="M34 35L12 20M34 35L10 35M34 35L12 50" stroke="#000000" stroke-opacity="0.12" stroke-width="0.8" fill="none" />
    </g>

    <!-- Body with shading, scales, markings and shine -->
    <path :d="shape.body" :fill="`url(#${id}-body)`" />
    <g :clip-path="`url(#${id}-clip)`">
      <rect v-if="!silhouette" x="0" y="0" width="120" height="70" :fill="`url(#${id}-scales)`" />
      <template v-if="pattern?.kind === 'bands'">
        <g v-for="x in [56, 82, 102]" :key="x">
          <rect :x="x - 6" y="0" width="12" height="70" :fill="pattern.edge ?? pattern.color" />
          <rect :x="x - 4" y="0" width="8" height="70" :fill="pattern.color" />
        </g>
      </template>
      <template v-else-if="pattern?.kind === 'lateral'">
        <path d="M30 31C60 27 90 27 118 31L118 36C90 32 60 32 30 36Z" :fill="pattern.color" opacity="0.95" />
        <path v-if="pattern.accent" d="M30 38C50 38 70 40 82 44L82 70L30 70Z" :fill="pattern.accent" opacity="0.9" />
      </template>
      <template v-else-if="pattern?.kind === 'bars'">
        <rect v-for="x in [52, 68, 84]" :key="x" :x="x" y="0" width="5" height="70" :fill="pattern.color" opacity="0.8" />
        <rect x="96" y="0" width="5" height="70" :fill="pattern.color" opacity="0.9" />
      </template>
      <template v-else-if="pattern?.kind === 'spots'">
        <circle
          v-for="(p, i) in [[50, 26], [60, 38], [70, 24], [76, 44], [86, 30], [64, 50], [92, 42], [56, 46]]"
          :key="i"
          :cx="p[0]"
          :cy="p[1]"
          r="2.4"
          :fill="pattern.color"
          opacity="0.85"
        />
      </template>
      <template v-else-if="pattern?.kind === 'patches'">
        <path d="M44 22C52 16 64 18 66 26C68 34 56 38 50 34C44 31 40 26 44 22Z" :fill="pattern.color" />
        <path d="M78 20C88 18 96 24 94 30C92 36 82 34 78 30C75 27 74 22 78 20Z" :fill="pattern.color" />
        <path d="M60 42C66 40 74 44 72 49C70 53 62 52 59 48Z" :fill="pattern.color" opacity="0.9" />
      </template>
      <rect x="0" y="0" width="120" height="70" :fill="`url(#${id}-shine)`" />
    </g>

    <template v-if="!silhouette">
      <!-- Lateral line, gill and mouth -->
      <path d="M40 34C62 30 84 30 104 33" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="0.9" />
      <path :d="`M${shape.eye[0] - 9} ${shape.eye[1] - 9}C${shape.eye[0] - 14} ${shape.eye[1]} ${shape.eye[0] - 14} ${shape.eye[1] + 9} ${shape.eye[0] - 9} ${shape.eye[1] + 16}`" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="1.2" stroke-linecap="round" />
      <path :d="`M${shape.eye[0] + 12} ${shape.eye[1] + 8}q-3 2 -6 1`" fill="none" stroke="#1f2937" stroke-opacity="0.7" stroke-width="1.2" stroke-linecap="round" />

      <!-- Side fin, in front of the body -->
      <path class="rien-fish-pectoral" :d="shape.fins.pectoral" :fill="`url(#${id}-fin)`" />

      <!-- Eye -->
      <g v-if="dead" stroke="#1f2937" stroke-width="2.2" stroke-linecap="round">
        <path :d="`M${shape.eye[0] - 3.5} ${shape.eye[1] - 3.5}l7 7m0 -7l-7 7`" />
      </g>
      <g v-else>
        <circle :cx="shape.eye[0]" :cy="shape.eye[1]" r="5" fill="#ffffff" />
        <circle :cx="shape.eye[0] + 0.8" :cy="shape.eye[1]" r="3.6" fill="#b45309" />
        <circle :cx="shape.eye[0] + 1.2" :cy="shape.eye[1]" r="2.4" fill="#0f172a" />
        <circle :cx="shape.eye[0] + 2.2" :cy="shape.eye[1] - 1.4" r="0.9" fill="#ffffff" />
      </g>
    </template>
  </svg>
</template>
