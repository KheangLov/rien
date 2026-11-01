<script setup lang="ts">
import {
  PhBookOpenText, PhCamera, PhCards, PhCaretLeft, PhCaretRight, PhChartBar, PhChatsCircle, PhCheck,
  PhFire, PhFish, PhHouse, PhImage, PhLightbulb, PhMagnifyingGlass, PhMicrophone, PhPencilSimpleLine,
  PhPlay, PhPlus, PhPuzzlePiece, PhRadio, PhSparkle, PhSpeakerHigh, PhTrophy, PhUserCircle, PhWaveform, PhX,
} from '@phosphor-icons/vue'
import type { Component } from 'vue'

// Phosphor icons: soft, rounded shapes that match the squircle UI, bundled so
// they work offline. Weights follow iOS: fill for the selected tab, duotone
// in coloured tiles, bold for small marks, regular elsewhere.
const ICONS = {
  'today': PhHouse,
  'words': PhBookOpenText,
  'progress': PhChartBar,
  'me': PhUserCircle,
  'close': PhX,
  'back': PhCaretLeft,
  'next': PhCaretRight,
  'plus': PhPlus,
  'check': PhCheck,
  'search': PhMagnifyingGlass,
  'play': PhPlay,
  'flame': PhFire,
  'fish': PhFish,
  'sparkles': PhSparkle,
  'image': PhImage,
  'camera': PhCamera,
  'volume': PhSpeakerHigh,
  'lightbulb': PhLightbulb,
  'word-recall': PhCards,
  'fix-it': PhPencilSimpleLine,
  'sound-hunter': PhWaveform,
  'sentence-builder': PhPuzzlePiece,
  'gap-radio': PhRadio,
  'say-it': PhMicrophone,
  'file-boss': PhTrophy,
  'couple-talk': PhChatsCircle,
} as const satisfies Record<string, Component>

export type IconName = keyof typeof ICONS
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'

withDefaults(defineProps<{ name: IconName, size?: number, weight?: IconWeight }>(), {
  size: 24,
  weight: 'regular',
})
</script>

<template>
  <component
    :is="ICONS[name]"
    :size="size"
    :weight="weight"
    class="rien-icon"
    aria-hidden="true"
  />
</template>
