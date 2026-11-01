<script setup lang="ts">
import type { IeltsReading } from '#shared/schemas/pack'

// IELTS Reading's hardest question type: True, False or Not Given. True = the
// text says so; False = the text says the opposite; Not Given = the text does
// not say. Each answer goes into the skill model (one in three by luck).
type Answer = 'true' | 'false' | 'not-given'
const LABELS: Record<Answer, string> = { 'true': 'True', 'false': 'False', 'not-given': 'Not given' }

const db = useDb()
const recorder = useActivityRecorder()
const texts = ref<IeltsReading[]>([])
const index = ref(0)
const picks = ref<Record<string, Answer>>({})
const checked = ref(false)
const startedAt = ref(performance.now())

onMounted(async () => { texts.value = (await loadIelts()).reading })

const text = computed(() => texts.value[index.value % Math.max(1, texts.value.length)])
const allPicked = computed(() => Boolean(text.value) && text.value!.statements.every(s => picks.value[s.id]))
const right = computed(() => text.value?.statements.filter(s => picks.value[s.id] === s.answer).length ?? 0)

async function check() {
  const t = text.value
  if (!t || !allPicked.value) return
  checked.value = true
  const ms = (performance.now() - startedAt.value) / t.statements.length
  await db.saveAttempts(t.statements.map(s => attemptFor(
    { itemId: `ielts:${t.id}:${s.id}`, skill: 'reading', level: 'B2' },
    'ielts-reading',
    picks.value[s.id] === s.answer ? 1 : 0,
    ms,
  )))
  void recorder.record('ielts-reading', { clean: right.value, total: t.statements.length })
  haptic(right.value === t.statements.length ? 'success' : 'warning')
}

function another() {
  index.value++
  picks.value = {}
  checked.value = false
  startedAt.value = performance.now()
  window.scrollTo({ top: 0 })
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Reading" back="/ielts" />

    <SqCard variant="tonal">
      <SqCardText class="rien-card-body">
        <p class="rien-muted">
          <b>True</b>: the text says this. <b>False</b>: the text says the opposite.
          <b>Not given</b>: the text does not say. Use only the text, not what you know.
        </p>
      </SqCardText>
    </SqCard>

    <template v-if="text">
      <SqCard :title="text.title">
        <SqCardText>
          <p class="rien-ielts-reading">{{ text.text }}</p>
        </SqCardText>
      </SqCard>

      <ol class="rien-tfng">
        <li v-for="s in text.statements" :key="s.id" :class="checked && (picks[s.id] === s.answer ? 'is-right' : 'is-wrong')">
          <p>{{ s.text }}</p>
          <div class="rien-tfng-choices" role="radiogroup" :aria-label="s.text">
            <button
              v-for="(label, value) in LABELS"
              :key="value"
              type="button"
              role="radio"
              :aria-checked="picks[s.id] === value"
              :class="{ 'is-on': picks[s.id] === value, 'is-answer': checked && s.answer === value }"
              :disabled="checked"
              @click="picks[s.id] = value"
            >
              {{ label }}
            </button>
          </div>
          <p v-if="checked" class="rien-muted">{{ LABELS[s.answer] }}: {{ s.why }}</p>
        </li>
      </ol>

      <SqCard v-if="checked" variant="tonal" class="rien-pop">
        <SqCardText><p class="rien-big">{{ right }} / {{ text.statements.length }}</p></SqCardText>
      </SqCard>

      <ActionBar>
        <SqBtn v-if="!checked" color="primary" size="large" :disabled="!allPicked" @click="check">Check</SqBtn>
        <SqBtn v-else color="primary" size="large" @click="another">Another text</SqBtn>
      </ActionBar>
    </template>
  </div>
</template>
