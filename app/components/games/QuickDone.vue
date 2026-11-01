<script setup lang="ts">
// The end card of a quick game: score, best streak, play again or go back.
defineProps<{ score: number, total: number, best: number, note?: string }>()
const emit = defineEmits<{ again: [] }>()
</script>

<template>
  <SqCard title="Round done" variant="tonal" class="rien-pop">
    <Confetti v-if="total > 0 && score === total" />
    <SqCardText>
      <p class="rien-big">{{ score }} / {{ total }}</p>
      <p v-if="note" class="rien-muted">{{ note }}</p>
      <p v-if="best >= 3" class="rien-best-combo"><RienIcon name="flame" :size="18" weight="fill" /> Best streak: {{ best }} in a row</p>
    </SqCardText>
    <SqCardActions>
      <SqBtn variant="tonal" @click="emit('again')">Play again</SqBtn>
      <SqBtn to="/" color="primary">Back to today</SqBtn>
    </SqCardActions>
  </SqCard>
</template>
