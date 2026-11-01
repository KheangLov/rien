<script setup lang="ts">
import type { IeltsWriting } from '#shared/schemas/pack'
import { countWords, writingFeedback, type WritingFeedback } from '#shared/utils/ielts'

// IELTS Writing: Task 1 describes a chart (150 words, 20 minutes); Task 2 is an
// essay (250 words, 40 minutes). A timer and live word count as in the exam,
// then a checklist from what examiners look for. Rien cannot give a band for
// writing: that needs a teacher, so the text can be sent to hers.
const prompts = ref<IeltsWriting[]>([])
const academicWords = ref<string[]>([])
const chosen = ref<IeltsWriting | null>(null)
const text = ref('')
const feedback = ref<WritingFeedback | null>(null)
const recorder = useActivityRecorder()
const shared = ref('')

const timer20 = useCountdown(20 * 60_000)
const timer40 = useCountdown(40 * 60_000)
const timer = computed(() => (chosen.value?.task === 1 ? timer20 : timer40))
const words = computed(() => countWords(text.value))
const minimum = computed(() => (chosen.value?.task === 1 ? 150 : 250))

onMounted(async () => {
  const ielts = await loadIelts()
  prompts.value = ielts.writing
  academicWords.value = ielts.academicWords.map(w => w.word)
})

// Drafts are saved in the database (one per question, and in backups) a
// moment after she stops typing. Drafts from before were kept in the
// browser's storage; they move over the first time she opens the question.
const db = useDb()
const legacyKey = (id: string) => `rien-ielts-writing-${id}`
let saveTimer: ReturnType<typeof setTimeout> | undefined
async function choose(prompt: IeltsWriting) {
  chosen.value = prompt
  feedback.value = null
  shared.value = ''
  let draft = (await db.writing(prompt.id))?.text
  if (draft === undefined) {
    try {
      draft = localStorage.getItem(legacyKey(prompt.id)) ?? undefined
      if (draft) {
        await db.saveWriting({ promptId: prompt.id, text: draft, updatedAt: new Date() })
        localStorage.removeItem(legacyKey(prompt.id))
      }
    }
    catch {}
  }
  text.value = draft ?? ''
  timer20.reset()
  timer40.reset()
  timer.value.start()
}
function saveNow() {
  clearTimeout(saveTimer)
  const prompt = chosen.value
  if (prompt) void db.saveWriting({ promptId: prompt.id, text: text.value, updatedAt: new Date() }).catch(() => {})
}
watch(text, () => {
  if (!chosen.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 900)
})
onBeforeUnmount(saveNow)

function check() {
  if (!chosen.value) return
  saveNow()
  timer.value.pause()
  feedback.value = writingFeedback(text.value, chosen.value.task, academicWords.value)
  void recorder.record('ielts-writing')
  haptic('success')
}

async function send() {
  if (!chosen.value) return
  const body = `IELTS Writing Task ${chosen.value.task}\n\n${chosen.value.prompt}\n\n${text.value}\n\n(${words.value} words)`
  try {
    if (navigator.share) await navigator.share({ title: `My IELTS Task ${chosen.value.task}`, text: body })
    else {
      await navigator.clipboard.writeText(body)
      shared.value = 'Copied. Paste it into a message to your teacher.'
    }
  }
  catch {}
}

const series = computed(() => chosen.value?.chart?.series.map(s => ({ name: s.name, data: s.data })) ?? [])
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Writing" back="/ielts" />

    <template v-if="!chosen">
      <p class="rien-muted">Task 1: describe a chart in at least 150 words (20 minutes). Task 2: an essay of at least 250 words (40 minutes).</p>
      <Squircle class="rien-list" :radius="22"><ul class="rien-list-items">
        <li v-for="prompt in prompts" :key="prompt.id">
          <button type="button" class="rien-list-row" @click="choose(prompt)">
            <span class="rien-list-text">
              <span class="rien-list-title">Task {{ prompt.task }}{{ prompt.chart ? `: ${prompt.chart.title}` : '' }}</span>
              <span class="rien-list-sub rien-clamp-2">{{ prompt.prompt }}</span>
            </span>
            <span class="rien-list-end"><RienIcon name="next" :size="16" weight="bold" /></span>
          </button>
        </li>
      </ul></Squircle>
    </template>

    <template v-else>
      <SqCard>
        <SqCardText class="rien-stack rien-card-body">
          <p>{{ chosen.prompt }}</p>
        </SqCardText>
      </SqCard>
      <SqBarChart
        v-if="chosen.chart"
        :title="chosen.chart.title"
        :subtitle="chosen.chart.unit"
        :labels="chosen.chart.labels"
        :series="series"
        :height="220"
      />

      <div class="rien-ielts-writebar">
        <span role="timer" :class="{ 'is-over': timer.finished.value }">{{ timer.finished.value ? 'Time is up' : timer.label.value }}</span>
        <span :class="{ 'is-ok': words >= minimum }">{{ words }} / {{ minimum }} words</span>
      </div>
      <SqTextarea v-model="text" label="Your answer" :rows="14" auto-grow hide-details class="rien-ielts-essay" />
      <p class="rien-muted">Leave an empty line between paragraphs. Your draft is saved as you write, and in your backups.</p>

      <SqCard v-if="feedback" title="Checklist" variant="tonal">
        <SqCardText>
          <ul class="rien-ielts-checks">
            <li v-for="item in feedback.checks" :key="item.label" :class="{ 'is-ok': item.ok }">
              <RienIcon :name="item.ok ? 'check' : 'close'" :size="18" weight="bold" />
              <div>
                <strong>{{ item.label }}</strong>
                <p class="rien-muted">{{ item.detail }}</p>
              </div>
            </li>
          </ul>
          <p class="rien-muted">
            Academic words used: {{ feedback.academic.length ? feedback.academic.join(', ') : 'none yet. Try words like significant, indicate or benefit.' }}
          </p>
          <p class="rien-muted">This checks the parts a phone can check. For your band, ask your teacher to read it.</p>
          <p v-if="shared" class="rien-muted">{{ shared }}</p>
        </SqCardText>
        <SqCardActions>
          <SqBtn variant="tonal" @click="send">Send to my teacher</SqBtn>
        </SqCardActions>
      </SqCard>

      <ActionBar>
        <SqBtn variant="tonal" size="large" @click="saveNow(); chosen = null">Other questions</SqBtn>
        <SqBtn color="primary" size="large" :disabled="words < 20" @click="check">Check</SqBtn>
      </ActionBar>
    </template>
  </div>
</template>
