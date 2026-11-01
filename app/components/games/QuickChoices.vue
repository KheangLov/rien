<script setup lang="ts">
// Four big choices for Listen & Pick and Picture Match. After a tap, the right
// one turns green and a wrong pick red, then the game moves on.
const props = defineProps<{ options: string[], answer: string, picked: string | null }>()
const emit = defineEmits<{ pick: [option: string] }>()

function state(option: string) {
  if (props.picked === null) return ''
  if (option === props.answer) return 'is-right'
  return option === props.picked ? 'is-wrong' : 'is-faded'
}
</script>

<template>
  <div class="rien-quick-choices">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      class="rien-quick-choice"
      :class="state(option)"
      :disabled="picked !== null"
      @click="emit('pick', option)"
    >
      {{ option }}
    </button>
  </div>
</template>
