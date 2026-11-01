<script setup lang="ts">
import type { IconName } from '~/components/RienIcon.vue'

// One row: optional icon tile, a label (and subtitle), and on the right either
// a value, a control in the "end" slot, or a chevron for navigation.
const props = defineProps<{
  label: string
  subtitle?: string
  value?: string
  icon?: IconName
  to?: string
  chevron?: boolean
  tint?: 'primary' | 'danger'
}>()
const emit = defineEmits<{ click: [] }>()
const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'button'))
</script>

<template>
  <li>
    <component
      :is="tag"
      :to="to"
      :type="to ? undefined : 'button'"
      class="rien-list-row"
      :class="tint ? `is-${tint}` : undefined"
      @click="emit('click')"
    >
      <span v-if="icon" class="rien-list-icon"><RienIcon :name="icon" weight="duotone" :size="22" /></span>
      <span class="rien-list-text">
        <span class="rien-list-title">{{ label }}</span>
        <span v-if="subtitle" class="rien-list-sub">{{ subtitle }}</span>
      </span>
      <span class="rien-list-end">
        <span v-if="value" class="ios-row-value">{{ value }}</span>
        <slot name="end" />
        <RienIcon v-if="chevron || to" name="next" :size="16" weight="bold" class="ios-chevron" />
      </span>
    </component>
  </li>
</template>
