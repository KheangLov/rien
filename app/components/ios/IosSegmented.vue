<script setup lang="ts" generic="T extends string">
// An iOS segmented control: a soft track, plain labels, and one raised pill
// that slides to the selected option. No borders on unselected options.
const props = defineProps<{ modelValue: T, options: { value: T, label: string }[], label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const index = computed(() => Math.max(0, props.options.findIndex(o => o.value === props.modelValue)))

function select(value: T) {
  if (value === props.modelValue) return
  haptic('tap')
  emit('update:modelValue', value)
}
</script>

<template>
  <Squircle class="ios-segmented" :radius="12" role="radiogroup" :aria-label="label" :style="{ '--n': options.length, '--i': index }">
    <Squircle class="ios-segmented-thumb" :radius="10" aria-hidden="true" />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="ios-segment"
      :class="{ 'is-active': option.value === modelValue }"
      :aria-checked="option.value === modelValue"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </Squircle>
</template>
