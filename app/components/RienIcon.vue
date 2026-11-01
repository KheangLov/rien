<script setup lang="ts">
import {
  AudioLines, BookOpen, Camera, ChartColumn, Check, ChevronLeft, ChevronRight, CircleUser, Fish,
  Flame, House, Image, Layers, Lightbulb, MessagesSquare, Mic, PenLine, Play, Plus, Puzzle, Radio,
  Search, Sparkles, Trophy, Volume2, X,
} from '@lucide/vue'
import type { Component } from 'vue'

// Lucide line icons (bundled, so they work offline), under the names the app uses.
const ICONS = {
  'today': House,
  'words': BookOpen,
  'progress': ChartColumn,
  'me': CircleUser,
  'close': X,
  'back': ChevronLeft,
  'next': ChevronRight,
  'plus': Plus,
  'check': Check,
  'search': Search,
  'play': Play,
  'flame': Flame,
  'fish': Fish,
  'sparkles': Sparkles,
  'image': Image,
  'camera': Camera,
  'volume': Volume2,
  'lightbulb': Lightbulb,
  'word-recall': Layers,
  'fix-it': PenLine,
  'sound-hunter': AudioLines,
  'sentence-builder': Puzzle,
  'gap-radio': Radio,
  'say-it': Mic,
  'file-boss': Trophy,
  'couple-talk': MessagesSquare,
} as const satisfies Record<string, Component>

export type IconName = keyof typeof ICONS

defineProps<{ name: IconName, size?: number }>()
</script>

<template>
  <component
    :is="ICONS[name]"
    :size="size ?? 24"
    :stroke-width="2"
    class="rien-icon"
    aria-hidden="true"
  />
</template>
