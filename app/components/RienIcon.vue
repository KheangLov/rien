<script setup lang="ts">
// Solar icons (480 Design, CC BY 4.0) drawn by Squirkle's SqIcon from the
// bundled subset registered in plugins/icons.client.ts. Weights follow iOS:
// fill (Solar bold) for the selected tab, duotone (bold-duotone) in tiles,
// regular and bold (linear) elsewhere.
const ICONS = {
  'today': 'home-2',
  'words': 'notebook',
  'progress': 'chart-2',
  'me': 'user-rounded',
  'close': 'rien-close',
  'back': 'alt-arrow-left',
  'next': 'alt-arrow-right',
  'plus': 'rien-plus',
  'check': 'rien-check',
  'search': 'magnifer',
  'play': 'play',
  'flame': 'fire',
  'fish': 'rien-fish',
  'sparkles': 'stars',
  'image': 'gallery',
  'camera': 'camera',
  'volume': 'volume-loud',
  'lightbulb': 'lightbulb',
  'word-recall': 'layers',
  'fix-it': 'pen-new-square',
  'sound-hunter': 'soundwave',
  'sentence-builder': 'widget-add',
  'gap-radio': 'radio',
  'say-it': 'microphone-2',
  'file-boss': 'cup-star',
  'couple-talk': 'chat-square-dots',
  'bell': 'bell-bing',
  'moon': 'moon',
  'download': 'download-minimalistic',
  'upload': 'upload-minimalistic',
  'phone': 'smartphone',
  'translate': 'translation',
  'calendar': 'calendar',
  'goal': 'cup-first',
  'ielts': 'square-academic-cap',
  'install': 'home-add',
  'share': 'square-arrow-up',
  'menu': 'menu-dots-vertical',
  'stop': 'stop',
  'slower': 'playback-speed',
  'speed-round': 'stopwatch',
  'listen-pick': 'headphones-round-sound',
  'picture-match': 'gallery',
} as const

export type IconName = keyof typeof ICONS
export type IconWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'

const VARIANT: Record<IconWeight, string> = {
  thin: 'linear', light: 'linear', regular: 'linear', bold: 'linear', fill: 'bold', duotone: 'bold-duotone',
}

const props = withDefaults(defineProps<{ name: IconName, size?: number, weight?: IconWeight }>(), {
  size: 24,
  weight: 'regular',
})
const icon = computed(() => `solar:${ICONS[props.name]}-${VARIANT[props.weight]}`)
</script>

<template>
  <SqIcon :icon="icon" :size="size" class="rien-icon" aria-hidden="true" />
</template>
