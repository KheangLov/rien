<script setup lang="ts">
// Rien's logo, drawn inline from shared/utils/logo.ts in her main colour
// (--rien-logo-* from app/utils/accents.ts; teal until they are set).
withDefaults(defineProps<{ size?: number }>(), { size: 52 })
const id = `rien-logo-${useId()}`
const tile = logoSquircle(256, 5, 96)
</script>

<template>
  <svg class="rien-logo" :width="size" :height="size" viewBox="0 0 512 512" aria-hidden="true">
    <defs>
      <linearGradient :id="id" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" class="rien-logo-top" />
        <stop offset="1" class="rien-logo-bottom" />
      </linearGradient>
    </defs>
    <path :fill="`url(#${id})`" :d="tile" />
    <g transform="translate(0 -9)">
      <path fill="#fff" :d="LOGO_WORD" />
      <rect x="136" y="350" width="240" height="18" rx="9" class="rien-logo-bar" />
    </g>
  </svg>
</template>

