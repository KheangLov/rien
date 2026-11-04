<script setup lang="ts">
// Rien's study guide, a small round fish, in four scenes. The guide's
// drawing follows FishSprite's style (back-to-belly shading, see-through fins,
// a shine and a lit eye) but is its own simple shape, drawn once below and
// placed per scene. Decorative only: the heading next to it says what it means.
// Colours come from her accent (--rien-tint-*, --sq-primary) so every scene
// fits her colour; the fish keeps its warm gold so it reads on any of them.
export type LearningScene = 'journey' | 'ielts' | 'checkpoint' | 'complete'

const props = defineProps<{ scene: LearningScene }>()

const id = useId()

// Where the guide swims in each scene: position, size and tilt (degrees).
const GUIDE: Record<LearningScene, { x: number, y: number, scale: number, tilt: number }> = {
  journey: { x: 78, y: 6, scale: 0.56, tilt: -10 },
  ielts: { x: 196, y: 10, scale: 0.6, tilt: 8 },
  checkpoint: { x: 104, y: 14, scale: 0.78, tilt: -22 },
  complete: { x: 116, y: 30, scale: 0.74, tilt: -4 },
}
const guide = computed(() => {
  const g = GUIDE[props.scene]
  return `translate(${g.x} ${g.y}) rotate(${g.tilt} 60 35) scale(${g.scale})`
})

// Stepping stones on the journey path, from the first lesson to the goal flag.
const STONES = [
  { x: 40, y: 98, label: 'Aa' },
  { x: 108, y: 80, label: '-ed' },
  { x: 176, y: 70, label: '-s' },
  { x: 244, y: 50, label: '?!' },
]

// The four IELTS skills, floating round the open book.
const SKILLS = [
  { x: 52, y: 34, tint: 1 },
  { x: 104, y: 24, tint: 2 },
  { x: 262, y: 70, tint: 3 },
  { x: 40, y: 88, tint: 2 },
]
</script>

<template>
  <svg
    class="rien-art"
    :class="`rien-art-${scene}`"
    viewBox="0 0 320 130"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient :id="`${id}-body`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="60%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#fde68a" />
      </linearGradient>
      <linearGradient :id="`${id}-fin`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#fb7185" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#f97316" stop-opacity="0.9" />
      </linearGradient>
      <radialGradient :id="`${id}-shine`" cx="62%" cy="22%" r="55%">
        <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.6" />
        <stop offset="100%" stop-color="#f8fafc" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="`${id}-water`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0" />
        <stop offset="25%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0.28" />
        <stop offset="75%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0.28" />
        <stop offset="100%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0" />
      </linearGradient>
      <linearGradient :id="`${id}-wave`" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0" />
        <stop offset="20%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0.75" />
        <stop offset="80%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0.75" />
        <stop offset="100%" style="stop-color: var(--rien-tint-2, #38bdf8)" stop-opacity="0" />
      </linearGradient>
      <radialGradient :id="`${id}-glow`" cx="50%" cy="55%" r="50%">
        <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
      </radialGradient>
      <clipPath :id="`${id}-clip`">
        <path d="M30 35C34 14 60 6 86 12C104 16 114 26 114 35C114 45 104 55 86 58C60 64 34 56 30 35Z" />
      </clipPath>
    </defs>

    <!-- Journey: a path of word stones up to a goal flag (Today's session) -->
    <g v-if="scene === 'journey'" class="rien-art-scene">
      <path
        d="M14 108C66 108 84 84 128 80S220 64 300 26"
        fill="none"
        stroke="#f8fafc"
        stroke-opacity="0.5"
        stroke-width="3"
        stroke-linecap="round"
        stroke-dasharray="1 9"
        class="rien-art-trail"
      />
      <g v-for="(stone, i) in STONES" :key="stone.label" class="rien-art-stone" :style="{ '--i': i }">
        <rect :x="stone.x - 18" :y="stone.y - 13" width="36" height="26" rx="9" fill="#f8fafc" fill-opacity="0.16" stroke="#f8fafc" stroke-opacity="0.45" stroke-width="1.5" />
        <text :x="stone.x" :y="stone.y + 5" text-anchor="middle" font-size="13" font-weight="700" fill="#f8fafc" fill-opacity="0.92">{{ stone.label }}</text>
      </g>
      <!-- Goal flag -->
      <g class="rien-art-flag">
        <path d="M298 30V4" stroke="#f8fafc" stroke-width="2.5" stroke-linecap="round" />
        <path d="M299 5C306 2 312 8 318 5V17C312 20 306 14 299 17Z" style="fill: var(--rien-tint-1, #2dd4bf)" />
        <circle cx="298" cy="31" r="4" fill="#f8fafc" fill-opacity="0.7" />
      </g>
      <!-- Bubbles -->
      <circle class="rien-art-bubble" style="--i: 0" cx="160" cy="26" r="4" fill="none" stroke="#f8fafc" stroke-opacity="0.55" stroke-width="1.4" />
      <circle class="rien-art-bubble" style="--i: 1" cx="172" cy="12" r="2.6" fill="none" stroke="#f8fafc" stroke-opacity="0.45" stroke-width="1.2" />
      <circle class="rien-art-bubble" style="--i: 2" cx="40" cy="58" r="3" fill="none" stroke="#f8fafc" stroke-opacity="0.35" stroke-width="1.2" />
    </g>

    <!-- IELTS: an open book with the four skills floating up from it -->
    <g v-else-if="scene === 'ielts'" class="rien-art-scene">
      <ellipse cx="160" cy="120" rx="120" ry="7" style="fill: var(--sq-primary, #0f766e)" fill-opacity="0.12" />
      <g class="rien-art-book">
      <path d="M160 54C130 42 98 42 72 50V118C98 110 130 110 160 120Z" style="fill: var(--sq-surface, #fcfcfd); stroke: var(--sq-primary, #0f766e)" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round" />
      <path d="M160 54C190 42 222 42 248 50V118C222 110 190 110 160 120Z" style="fill: var(--sq-surface, #fcfcfd); stroke: var(--sq-primary, #0f766e)" stroke-opacity="0.55" stroke-width="2" stroke-linejoin="round" />
      <path d="M160 54V120" style="stroke: var(--sq-primary, #0f766e)" stroke-opacity="0.45" stroke-width="2" />
      <g fill="none" style="stroke: var(--sq-primary, #0f766e)" stroke-opacity="0.3" stroke-width="2.4" stroke-linecap="round">
        <path d="M86 64C106 59 128 59 146 64M86 76C106 71 128 71 146 76M86 88C106 83 128 83 146 88M86 100C102 96 118 96 132 99" />
        <path d="M174 64C192 59 214 59 234 64M174 76C192 71 214 71 234 76M174 88C192 83 206 83 216 85" />
      </g>
      <!-- Band target on the right page -->
      <circle cx="222" cy="100" r="10" fill="none" style="stroke: var(--rien-tint-1, #2dd4bf)" stroke-width="2.4" />
      <circle class="rien-art-pulse" cx="222" cy="100" r="4" style="fill: var(--rien-tint-1, #2dd4bf)" />
      </g>
      <!-- Skills: speaking, writing, reading, listening -->
      <g v-for="(skill, i) in SKILLS" :key="i" class="rien-art-skill" :style="{ '--i': i }">
        <g class="rien-art-skill-float">
        <circle :cx="skill.x" :cy="skill.y" r="15" :style="{ fill: `var(--rien-tint-${skill.tint}, #38bdf8)` }" fill-opacity="0.22" />
        <circle :cx="skill.x" :cy="skill.y" r="15" fill="none" :style="{ stroke: `var(--rien-tint-${skill.tint}, #38bdf8)` }" stroke-width="1.6" />
        <g :transform="`translate(${skill.x - 8} ${skill.y - 8})`" fill="none" style="stroke: var(--sq-primary, #0f766e)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path v-if="i === 0" d="M2 3H14V11H7L4 14V11H2Z" />
          <path v-else-if="i === 1" d="M3 13L4 9L12 1L15 4L7 12ZM2 15H14" />
          <path v-else-if="i === 2" d="M3 1H11L14 4V15H3ZM6 7H11M6 10H11" />
          <path v-else d="M2 8V8M5 5V11M8 2V14M11 5V11M14 8V8" />
        </g>
        </g>
      </g>
      <path class="rien-art-twinkle" d="M286 22l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" fill="#fbbf24" />
    </g>

    <!-- Checkpoint: the guide leaps through a ring, a tick above it -->
    <g v-else-if="scene === 'checkpoint'" class="rien-art-scene">
      <g class="rien-art-water">
        <path d="M20 112C60 102 90 122 130 112S210 102 250 112S290 120 300 116C300 124 290 128 260 128H60C30 128 20 124 20 112Z" :fill="`url(#${id}-water)`" />
        <path d="M20 116C60 106 90 126 130 116S210 106 250 116S290 124 300 120" fill="none" :stroke="`url(#${id}-wave)`" stroke-width="2" stroke-linecap="round" />
      </g>
      <ellipse cx="160" cy="64" rx="40" ry="46" fill="none" style="stroke: var(--rien-tint-1, #2dd4bf)" stroke-width="7" stroke-opacity="0.85" />
      <ellipse cx="160" cy="64" rx="40" ry="46" fill="none" stroke="#f8fafc" stroke-width="2" stroke-opacity="0.6" stroke-dasharray="10 12" class="rien-art-ring-dash" />
      <g class="rien-art-badge">
        <circle cx="240" cy="30" r="17" style="fill: var(--sq-success, #16a34a)" />
        <path d="M232 30L238 36L249 24" fill="none" stroke="#f8fafc" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g class="rien-art-splash" fill="none" style="stroke: var(--rien-tint-2, #38bdf8); --i: 0" stroke-width="2" stroke-linecap="round" stroke-opacity="0.8">
        <path d="M96 104C92 96 90 92 84 88M104 102C104 94 106 90 104 84M88 112C80 108 76 108 70 108" />
      </g>
      <circle class="rien-art-splash" cx="78" cy="80" r="3" style="fill: var(--rien-tint-2, #38bdf8); --i: 1" fill-opacity="0.7" />
      <circle class="rien-art-splash" cx="66" cy="96" r="2" style="fill: var(--rien-tint-2, #38bdf8); --i: 2" fill-opacity="0.6" />
    </g>

    <!-- Complete: the guide on a stack of books, a star and light behind -->
    <g v-else class="rien-art-scene">
      <circle class="rien-art-glow" cx="160" cy="60" r="62" :fill="`url(#${id}-glow)`" />
      <g class="rien-art-rays" fill="#fbbf24" fill-opacity="0.32">
        <path d="M160 60L120 0H142Z" />
        <path d="M160 60L178 0H200Z" />
        <path d="M160 60L230 16L240 34Z" />
        <path d="M160 60L80 34L90 16Z" />
      </g>
      <g class="rien-art-books">
      <rect x="104" y="112" width="112" height="14" rx="4" style="fill: var(--sq-primary, #0f766e)" />
      <rect x="114" y="98" width="94" height="14" rx="4" style="fill: var(--rien-tint-1, #2dd4bf)" />
      <rect x="110" y="84" width="100" height="14" rx="4" style="fill: var(--rien-tint-3, #f472b6)" />
      <g stroke="#f8fafc" stroke-opacity="0.6" stroke-width="1.6" stroke-linecap="round">
        <path d="M110 119H210M120 105H200M116 91H204" />
      </g>
      </g>
      <g class="rien-art-badge">
        <path d="M160 2l5.6 11.4 12.6 1.8 -9.1 8.9 2.1 12.5 -11.2 -5.9 -11.2 5.9 2.1 -12.5 -9.1 -8.9 12.6 -1.8Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.6" stroke-linejoin="round" />
      </g>
      <path class="rien-art-twinkle" d="M62 42l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" style="--i: 0; fill: var(--rien-tint-2, #38bdf8)" />
      <path class="rien-art-twinkle" d="M262 70l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" style="--i: 1; fill: var(--rien-tint-3, #f472b6)" />
      <path class="rien-art-twinkle" style="--i: 2" d="M248 26l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4Z" fill="#fbbf24" />
    </g>

    <!-- The guide fish (120 x 70 box, facing right) -->
    <g class="rien-art-guide"><g :transform="guide">
      <path d="M52 13C58 1 78 -1 88 11Z" :fill="`url(#${id}-fin)`" />
      <path d="M58 56C62 66 76 66 80 57Z" :fill="`url(#${id}-fin)`" />
      <path d="M32 35C22 18 8 14 5 24C4 30 9 33 13 35C9 37 4 40 5 46C8 56 22 52 32 35Z" :fill="`url(#${id}-fin)`" />
      <path d="M30 35C34 14 60 6 86 12C104 16 114 26 114 35C114 45 104 55 86 58C60 64 34 56 30 35Z" :fill="`url(#${id}-body)`" stroke="#f8fafc" stroke-opacity="0.75" stroke-width="2" />
      <g :clip-path="`url(#${id}-clip)`">
        <path d="M58 6C54 22 54 48 60 66L68 66C62 48 62 22 66 6Z" fill="#f8fafc" fill-opacity="0.55" />
        <rect x="0" y="0" width="120" height="70" :fill="`url(#${id}-shine)`" />
      </g>
      <path d="M78 42C72 46 68 52 68 57C76 55 81 50 83 45Z" :fill="`url(#${id}-fin)`" />
      <ellipse cx="94" cy="43" rx="4.5" ry="2.6" fill="#fb7185" fill-opacity="0.55" />
      <path d="M101 45q4 3.2 8.5 0" fill="none" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="98" cy="29" r="8" fill="#f8fafc" />
      <circle cx="99.5" cy="29.5" r="5.4" fill="#0f172a" />
      <circle cx="101.6" cy="27" r="1.8" fill="#f8fafc" />
    </g></g>

    <!-- Checkpoint: the ring's near side passes over the guide's tail -->
    <path
      v-if="scene === 'checkpoint'"
      d="M160 18C138 18 120 39 120 64S138 110 160 110"
      fill="none"
      style="stroke: var(--rien-tint-1, #2dd4bf)"
      stroke-width="7"
      stroke-opacity="0.9"
      stroke-linecap="round"
    />
  </svg>
</template>
