<script setup lang="ts">
// A sheet that slides up from the bottom with a grab handle, over a dimmed
// backdrop, like an iOS sheet. Closes on the backdrop, Escape, or a downward
// drag of the handle area. Teleported to <body> so nothing captures it.
const props = defineProps<{ open: boolean, title?: string }>()
const emit = defineEmits<{ close: [] }>()

const drag = ref(0)
let startY: number | null = null

function down(e: PointerEvent) {
  startY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (startY !== null) drag.value = Math.max(0, e.clientY - startY)
}
function up() {
  if (drag.value > 90) emit('close')
  drag.value = 0
  startY = null
}
function key(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
// Anything the sheet was reading aloud stops when it closes.
watch(() => props.open, (open) => { if (!open) stopAllSound() })
onMounted(() => window.addEventListener('keydown', key))
onBeforeUnmount(() => window.removeEventListener('keydown', key))
</script>

<template>
  <Teleport to="body">
    <Transition name="ios-backdrop">
      <div v-if="open" class="ios-backdrop" @click="emit('close')" />
    </Transition>
    <Transition name="ios-sheet">
      <Squircle
        v-if="open"
        class="ios-sheet rien-glass-surface"
        :radius="30"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :style="drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined"
      >
        <div class="ios-sheet-grab" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up">
          <span class="ios-sheet-handle" />
        </div>
        <div class="ios-sheet-head">
          <h2 v-if="title">{{ title }}</h2>
          <button type="button" class="ios-sheet-close" aria-label="Close" @click="emit('close')">
            <RienIcon name="close" :size="28" weight="fill" />
          </button>
        </div>
        <div class="ios-sheet-body">
          <slot />
        </div>
      </Squircle>
    </Transition>
  </Teleport>
</template>
