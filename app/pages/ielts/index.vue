<script setup lang="ts">
import type { AcademicWord } from '#shared/schemas/pack'
import { normalizeAnswer } from '#shared/utils/answer'
import { bandFor } from '#shared/utils/ielts'
import { DuplicateWordError } from '~/data/repository'
import type { Learner } from '~/composables/useLearner'
import LearningArtwork from '~/components/learn/LearningArtwork.vue'

// IELTS practice: the four skills in the exam's own formats, the Academic
// Word List, and an estimated band from the skill model.
const db = useDb()
const settings = useLiveQuery(() => db.getSettings(), null)
const cards = useLiveQuery(() => db.allCards(), [])
const academic = ref<AcademicWord[]>([])
const learner = shallowRef<Learner>()
const adding = ref(false)
const added = ref<number | null>(null)

onMounted(async () => {
  academic.value = (await loadIelts()).academicWords
  learner.value = await useLearner().catch(() => undefined)
})

const saved = computed(() => new Set(cards.value.map(c => c.answerKey)))
const savedAcademic = computed(() => academic.value.filter(w => saved.value.has(normalizeAnswer(w.word))).length)

const band = computed(() => {
  const l = learner.value
  if (!l || l.answers < MODEL_MIN_ANSWERS) return undefined
  const level = workingLevelOf(l)
  return { level, band: bandFor(level) }
})

const SKILLS = [
  { to: '/ielts/speaking', icon: 'say-it', title: 'Speaking', sub: 'Parts 1, 2 and 3, with feedback on what you said' },
  { to: '/ielts/writing', icon: 'fix-it', title: 'Writing', sub: 'Task 1 charts and Task 2 essays, timed, with a checklist' },
  { to: '/ielts/reading', icon: 'words', title: 'Reading', sub: 'True, False or Not Given' },
  { to: '/ielts/listening', icon: 'gap-radio', title: 'Listening', sub: 'Fill in a form: names, numbers and dates' },
] as const

// Ten at a time, so the daily new-word limit spreads them over a few days.
async function addAcademic() {
  const s = settings.value
  if (!s || adding.value) return
  adding.value = true
  let count = 0
  try {
    for (const w of academic.value.filter(w => !saved.value.has(normalizeAnswer(w.word))).slice(0, 10)) {
      try {
        await db.addWord({ answer: w.word, meaning: w.meaning, example: w.example, book: s.book, file: s.file })
        count++
      }
      catch (error) {
        if (!(error instanceof DuplicateWordError)) throw error
      }
    }
    added.value = count
    haptic('success')
  }
  finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="IELTS" back="/" />

    <SqCard variant="tonal">
      <SqCardText class="rien-stack rien-card-body">
        <LearningArtwork scene="ielts" class="rien-ielts-art" />
        <template v-if="band">
          <p class="rien-muted">Estimated band, from your answers in Rien</p>
          <p class="rien-big">{{ band.band }}</p>
          <p class="rien-muted">
            You are working at about {{ band.level }}. This is a guide from grammar, words and listening only, not a test score:
            only an IELTS examiner can give you a band.
          </p>
        </template>
        <p v-else class="rien-muted">
          Answer a few more questions in Rien's games and your estimated IELTS band will show here.
        </p>
        <p class="rien-muted">At ACE, IELTS preparation (Ready for IELTS) is GEP 11 and 12. Practising the formats early helps.</p>
      </SqCardText>
    </SqCard>

    <h2 class="rien-section-title">Practise a skill</h2>
    <ul class="rien-skill-grid">
      <li v-for="skill in SKILLS" :key="skill.to">
        <Squircle class="rien-skill-tile rien-glass-surface" :radius="22">
          <NuxtLink :to="skill.to" class="rien-skill-link">
            <span class="rien-list-icon"><RienIcon :name="skill.icon" weight="duotone" :size="26" /></span>
            <span class="rien-skill-title">{{ skill.title }} <RienIcon name="next" :size="14" weight="bold" /></span>
            <span class="rien-skill-sub">{{ skill.sub }}</span>
          </NuxtLink>
        </Squircle>
      </li>
    </ul>

    <SqCard title="Academic words" :subtitle="`${savedAcademic} of ${academic.length} in your words`">
      <SqCardText class="rien-stack rien-card-body">
        <p class="rien-muted">
          The first part of the Academic Word List: words that come up again and again in IELTS reading and writing,
          such as <i>analyse</i>, <i>benefit</i> and <i>significant</i>. Added words come back in Word Recall.
        </p>
        <p v-if="added !== null" class="rien-muted">{{ added ? `Added ${added} words.` : 'All of them are already in your words.' }}</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn color="primary" :disabled="adding || savedAcademic >= academic.length" @click="addAcademic">
          {{ savedAcademic >= academic.length ? 'All added' : 'Add 10 to my words' }}
        </SqBtn>
      </SqCardActions>
    </SqCard>
  </div>
</template>
