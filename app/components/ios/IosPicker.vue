<script setup lang="ts" generic="T extends string | number">
// A settings row whose value opens the phone's own picker (the iOS wheel):
// a native <select> lies invisibly over the whole row.
const props = defineProps<{ label: string, modelValue: T, options: { value: T, title: string }[], icon?: import('~/components/RienIcon.vue').IconName }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const current = computed(() => props.options.find(o => o.value === props.modelValue)?.title ?? '')

function change(event: Event) {
  const index = (event.target as HTMLSelectElement).selectedIndex
  const option = props.options[index]
  if (option) emit('update:modelValue', option.value)
}
</script>

<template>
  <li class="ios-picker">
    <div class="rien-list-row">
      <span v-if="icon" class="rien-list-icon"><RienIcon :name="icon" weight="duotone" :size="22" /></span>
      <span class="rien-list-text"><span class="rien-list-title">{{ label }}</span></span>
      <span class="rien-list-end">
        <span class="ios-row-value">{{ current }}</span>
        <RienIcon name="next" :size="16" weight="bold" class="ios-chevron ios-chevron-updown" />
      </span>
      <select class="ios-picker-select" :aria-label="label" @change="change">
        <option v-for="o in options" :key="String(o.value)" :selected="o.value === modelValue">{{ o.title }}</option>
      </select>
    </div>
  </li>
</template>
