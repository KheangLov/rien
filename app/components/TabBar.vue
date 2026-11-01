<script setup lang="ts">
import type { IconName } from './RienIcon.vue'

// A floating glass capsule, like the iOS 26 tab bar: a tinted lens sits behind
// the selected tab and slides (stretching as it moves) when the tab changes.
// Press and drag along the bar to move the lens with your finger; the tab under
// it opens when you let go.
const tabs: { to: string, label: string, icon: IconName }[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/words', label: 'Words', icon: 'words' },
  { to: '/tank', label: 'Tank', icon: 'fish' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/settings', label: 'Me', icon: 'me' },
]
const PAD = 6

const route = useRoute()
const router = useRouter()
const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
const index = computed(() => Math.max(0, tabs.findIndex(t => active(t.to))))

// Restart the stretch animation on every change (two names, so it replays).
const moves = ref(0)
watch(index, () => { moves.value++ })

// Dragging the lens.
const bar = ref<{ $el: HTMLElement } | null>(null)
const dragX = ref<number | null>(null)
const hover = ref<number | null>(null)
let start: { x: number, id: number } | null = null
let dragged = false
// A drag may end with a click on the tab under the finger (it already navigated).
let swallowUntil = 0

function slot(clientX: number) {
  const rect = bar.value!.$el.getBoundingClientRect()
  const width = (rect.width - PAD * 2) / tabs.length
  const x = Math.min(Math.max(clientX - rect.left - PAD, width / 2), rect.width - PAD * 2 - width / 2)
  return { x: x - width / 2 + PAD, i: Math.min(tabs.length - 1, Math.max(0, Math.floor((x) / width))) }
}

function down(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  start = { x: e.clientX, id: e.pointerId }
  dragged = false
}

function move(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return
  if (!dragged && Math.abs(e.clientX - start.x) < 8) return
  if (!dragged) {
    dragged = true
    try { bar.value?.$el.setPointerCapture(e.pointerId) }
    catch { /* a pointer the browser no longer tracks */ }
  }
  const { x, i } = slot(e.clientX)
  dragX.value = x
  if (hover.value !== i) {
    if (hover.value !== null) haptic('tap')
    hover.value = i
  }
}

function up(e: PointerEvent) {
  if (!start || e.pointerId !== start.id) return
  start = null
  if (!dragged) return
  dragged = false
  swallowUntil = performance.now() + 400
  const { i } = slot(e.clientX)
  dragX.value = null
  hover.value = null
  if (i !== index.value) {
    haptic('tap')
    void router.push(tabs[i]!.to)
  }
}

function cancel() {
  start = null
  dragged = false
  dragX.value = null
  hover.value = null
}

function swallowClick(e: MouseEvent) {
  if (performance.now() < swallowUntil) {
    e.preventDefault()
    e.stopPropagation()
  }
}

const shown = computed(() => hover.value ?? index.value)
const lensStyle = computed(() => dragX.value === null
  ? { '--i': index.value }
  : { '--i': index.value, left: `${dragX.value}px` })
</script>

<template>
  <nav class="rien-tabbar-wrap" aria-label="Main">
    <Squircle
      ref="bar"
      class="rien-tabbar rien-glass-surface"
      :radius="30"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="cancel"
      @click.capture="swallowClick"
    >
      <Squircle
        class="rien-tab-lens"
        :class="[dragX !== null ? 'is-dragging' : moves % 2 ? 'is-moving-a' : moves ? 'is-moving-b' : '']"
        :radius="24"
        :style="lensStyle"
        aria-hidden="true"
      />
      <NuxtLink
        v-for="(tab, i) in tabs"
        :key="tab.to"
        :to="tab.to"
        class="rien-tab"
        :class="{ 'is-active': shown === i }"
        :aria-current="active(tab.to) ? 'page' : undefined"
        draggable="false"
        @click="haptic('tap')"
      >
        <RienIcon :name="tab.icon" :size="25" :weight="shown === i ? 'fill' : 'regular'" />
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </Squircle>
  </nav>
</template>
