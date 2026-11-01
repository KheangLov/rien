<script setup lang="ts">
// An iOS switch (51 x 31 track), as a real checkbox with role="switch".
defineProps<{ modelValue: boolean, label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
function toggle(event: Event) {
  haptic('tap')
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <input
    type="checkbox"
    role="switch"
    class="ios-switch"
    :checked="modelValue"
    :aria-label="label"
    @click.stop
    @change="toggle"
  >
</template>
