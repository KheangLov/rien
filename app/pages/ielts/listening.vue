<script setup lang="ts">
import type { IeltsListening } from '#shared/schemas/pack'
import { formAnswerRight } from '#shared/utils/ielts'
import { vPlainInput } from '~/directives/plainInput'

// IELTS Listening, Part 1 style: a phone call is read aloud and she fills in a
// form. Spelling counts, as in the exam; capitals and "the" before a date do
// not. In the real test you hear it once.
const db = useDb()
const recorder = useActivityRecorder()
const { supported: canSpeak, speak } = useSpeech()
const talks = ref<IeltsListening[]>([])
const index = ref(0)
const typed = ref<Record<string, string>>({})
const checked = ref(false)
const plays = ref(0)

onMounted(async () => { talks.value = (await loadIelts()).listening })

const talk = computed(() => talks.value[index.value % Math.max(1, talks.value.length)])
const results = computed(() => Object.fromEntries((talk.value?.form ?? []).map(f => [f.id, formAnswerRight(typed.value[f.id] ?? '', f.answer, f.accept)])))
const right = computed(() => Object.values(results.value).filter(Boolean).length)

function play() {
  const t = talk.value
  if (!t || !canSpeak) return
  plays.value++
  speak(t.lines.map(l => l.text), 0.9)
}

async function check() {
  const t = talk.value
  if (!t) return
  checked.value = true
  await db.saveAttempts(t.form.map(f => attemptFor(
    { itemId: `ielts:${t.id}:${f.id}`, skill: 'form-filling', level: 'B1+' },
    'ielts-listening',
    results.value[f.id] ? 1 : 0,
    0,
  )))
  void recorder.record('ielts-listening', { clean: right.value, total: t.form.length })
  haptic(right.value === t.form.length ? 'success' : 'warning')
}

function another() {
  index.value++
  typed.value = {}
  checked.value = false
  plays.value = 0
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Listening" back="/ielts" />

    <SqAlert
      v-if="!canSpeak"
      type="warning"
      variant="tonal"
      title="This phone cannot read aloud here"
      text="Listening needs the phone's voice. Try it in the Rien app or another browser."
    />

    <template v-else-if="talk">
      <SqCard variant="tonal" :title="talk.title">
        <SqCardText class="rien-stack rien-card-body">
          <p>{{ talk.intro }}</p>
          <p class="rien-muted">Read the form first, then listen. In the test you hear it only once{{ plays > 1 ? ` (you have listened ${plays} times)` : '' }}.</p>
        </SqCardText>
        <SqCardActions>
          <SqBtn color="primary" @click="play">
            <RienIcon name="play" :size="18" weight="fill" /> {{ plays ? 'Listen again' : 'Listen' }}
          </SqBtn>
        </SqCardActions>
      </SqCard>

      <SqCard title="Form">
        <SqCardText>
          <div class="rien-ielts-form">
            <label v-for="(field, i) in talk.form" :key="field.id" :class="checked && (results[field.id] ? 'is-right' : 'is-wrong')">
              <span>{{ i + 1 }}. {{ field.label }}</span>
              <input
                v-model="typed[field.id]"
                v-plain-input
                type="text"
                :disabled="checked"
                autocomplete="off"
              >
              <small v-if="checked && !results[field.id]">Answer: {{ field.answer }}</small>
            </label>
          </div>
        </SqCardText>
      </SqCard>

      <SqCard v-if="checked" variant="tonal" class="rien-pop">
        <SqCardText>
          <p class="rien-big">{{ right }} / {{ talk.form.length }}</p>
          <p class="rien-muted">Check spelling, numbers and dates carefully: in IELTS, a small spelling mistake loses the mark.</p>
        </SqCardText>
      </SqCard>

      <ActionBar>
        <SqBtn v-if="!checked" color="primary" size="large" @click="check">Check</SqBtn>
        <SqBtn v-else color="primary" size="large" @click="another">Another call</SqBtn>
      </ActionBar>
    </template>
  </div>
</template>
