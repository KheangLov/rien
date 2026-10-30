<script setup lang="ts">
const db = useDb()
const now = useClock()

const due = useLiveQuery(() => db.countDue(now.value), 0, now)
const total = useLiveQuery(() => db.countCards(), 0)

const today = computed(() =>
  now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
</script>

<template>
  <div class="rien-page">
    <header class="rien-header">
      <h1 class="rien-title">Rien · <span class="rien-khmer">រៀន</span></h1>
      <p class="rien-muted">{{ today }}</p>
    </header>

    <SqEmptyState
      v-if="total === 0"
      title="Start with today's class"
      text="Add the new words from your lesson. Rien will bring each one back just before you forget it."
    >
      <SqBtn to="/add-words" color="primary" size="large">Add words</SqBtn>
    </SqEmptyState>

    <SqCard v-else variant="tonal">
      <SqCardText>
        <p class="rien-big">{{ due }}</p>
        <p class="rien-muted">{{ due === 1 ? 'word' : 'words' }} to review · {{ total }} saved</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn
          to="/games/word-recall"
          color="primary"
          size="large"
          :disabled="due === 0"
        >
          {{ due === 0 ? 'All done for now' : 'Start Word Recall' }}
        </SqBtn>
      </SqCardActions>
    </SqCard>

    <div class="rien-row">
      <SqBtn v-if="total > 0" to="/add-words" variant="tonal">Add words</SqBtn>
      <SqBtn to="/settings" variant="text">Settings</SqBtn>
    </div>
  </div>
</template>
