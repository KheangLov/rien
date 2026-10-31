<script setup lang="ts">
// Hand-drawn 24px line icons, so nothing loads from the network.
const PATHS = {
  'today': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  'words': 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11',
  'progress': 'M4 20V11M10 20V5M16 20v-6M2 20h20',
  'me': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  'close': 'M6 6l12 12M18 6 6 18',
  'back': 'm15 5-7 7 7 7',
  'next': 'm9 5 7 7-7 7',
  'plus': 'M12 5v14M5 12h14',
  'check': 'm5 12 5 5L20 7',
  'search': 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  'play': 'M8 5v14l11-7z',
  'flame': 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2-5 .4 1.6 1.4 2.6 2.6 3C11 8 12 5.5 12 3z',
  'word-recall': 'M4 7h11v13H4zM8 4h12v12',
  'fix-it': 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  'sound-hunter': 'M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11',
  'sentence-builder': 'M3 6h7v5H3zM14 6h7v5h-7zM8 14h8v5H8z',
  'gap-radio': 'M4 9h16v11H4zM7 9l10-5M8 14.5h3M15.5 16.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  'say-it': 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  'file-boss': 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 21h6M10 17h4v4h-4z',
  'couple-talk': 'M4 5h16v11H10l-6 4z',
} as const

export type IconName = keyof typeof PATHS

defineProps<{ name: IconName, size?: number }>()
</script>

<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="rien-icon"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>
