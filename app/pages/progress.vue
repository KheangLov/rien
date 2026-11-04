<script setup lang="ts">
import { BOOK_LABELS } from '#shared/schemas/db'
import { minutesByDay, minutesThisWeek, weakSpots } from '#shared/utils/progress'
import { skillLabel, type Level } from '#shared/utils/skills'
import { addDays } from '#shared/utils/streak'
import type { Learner } from '~/composables/useLearner'

const db = useDb()
const now = useClock()

const total = useLiveQuery(() => db.countCards(), 0)
const learned = useLiveQuery(() => db.countLearned(), 0)
const sessions = useLiveQuery(() => db.sessions(), [])
const bosses = useLiveQuery(() => db.bossResults(), [])
const counts = useLiveQuery(() => db.mistakeCounts(addDays(now.value, -WEAK_SPOT_DAYS)), {}, now)

const studied = computed(() => sessions.value.filter(s => s.games.length > 0))
const week = computed(() => minutesThisWeek(sessions.value, now.value))
const daily = computed(() => minutesByDay(sessions.value, now.value, 14))
const dailyTotal = computed(() => daily.value.values.reduce((a, b) => a + b, 0))
const spots = computed(() => weakSpots(counts.value))
const maxSpot = computed(() => Math.max(1, ...spots.value.map(s => s.count)))

// The skill model's view, once it has enough answers: each skill's chance of a
// right answer on an item at her level, weakest first. It learns in memory as
// she answers; reading counts.value re-runs this after every save.
const learner = shallowRef<Learner>()
onMounted(async () => { learner.value = await useLearner().catch(() => undefined) })
const skills = computed(() => {
  void counts.value
  const l = learner.value
  if (!l || l.answers < MODEL_MIN_ANSWERS) return []
  return weakSkills(l, now.value).slice(0, 6).map(s => ({ ...s, label: skillLabel(s.skill), percent: Math.round(s.p * 100) }))
})
// ACE's General English levels for each CEFR level (English File, then Ready
// for IELTS): an estimate to talk about with her teacher, not a test result.
const ACE_LEVELS: Record<Level, string> = {
  'A1': 'GEP 1–2', 'A2': 'GEP 3–4', 'A2+': 'GEP 5', 'B1': 'GEP 6–7', 'B1+': 'GEP 8', 'B2': 'GEP 9–10', 'B2+': 'GEP 11', 'C1': 'GEP 12',
}
// The model's self-check: each of her past answers predicted before it learned
// from it. Shown once there are enough answers for the numbers to mean much.
const SELF_CHECK_MIN = 50
const selfCheck = computed(() => {
  const l = learner.value
  if (!l || l.check.n < SELF_CHECK_MIN) return undefined
  const { check } = l
  const percent = (x: number) => Math.round(x * 100)
  return {
    accuracy: percent(check.accuracy),
    n: check.n,
    // How much smaller its prediction error is than a simple running average.
    sharper: Math.max(0, percent(1 - check.logLoss / check.baselineLogLoss)),
    rows: check.bins.filter(b => b.n >= 5).map(b => ({ said: percent(b.said), was: percent(b.was), n: b.n })),
    tuned: l.tuned,
    network: networkLine(l),
  }
})

// The neural network (TensorFlow.js) trained on her answers, in a sentence.
function networkLine(l: Learner): string {
  const ml = l.ml
  if (!ml) return `A neural network starts training on your answers once you have ${200} (you have ${l.answers}).`
  const r = ml.report
  const when = new Date(ml.trainedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const on = r.backend === 'webgl' ? 'on your phone\'s graphics chip' : 'on your phone'
  if (!r.trained || !r.test || !r.baseline) return `The neural network is waiting for more answers (${r.reason ?? ''}).`
  const pct = (x: number) => Math.round(x * 100)
  return r.active
    ? `A neural network trained ${on} (${when}) on ${r.trainRows} of your answers called your newest ${r.testRows} right ${pct(r.test.accuracy)}% of the time (the skill model: ${pct(r.baseline.accuracy)}%), so Rien now uses it to choose your practice.`
    : `A neural network trained ${on} (${when}) on ${r.trainRows} of your answers did not beat the skill model on your newest ${r.testRows} (${pct(r.test.accuracy)}% against ${pct(r.baseline.accuracy)}%), so Rien keeps the skill model for now and tries again later.`
}

const working = computed(() => {
  void counts.value
  const l = learner.value
  if (!l || l.answers < MODEL_MIN_ANSWERS) return undefined
  const level = workingLevelOf(l)
  return { level, ace: ACE_LEVELS[level] }
})

// Axis ticks can be fractions such as 0.6000000000000001.
const formatMinutes = (v: number) => `${Number(v.toFixed(1))} min`
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const stats = computed(() => [
  { label: plural(total.value, 'word saved', 'words saved'), value: total.value },
  { label: plural(learned.value, 'word learned', 'words learned'), value: learned.value },
  { label: plural(studied.value.length, 'day studied', 'days studied'), value: studied.value.length },
  { label: plural(week.value, 'minute this week', 'minutes this week'), value: week.value },
])

const formatDate = (date: Date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
</script>

<template>
  <div class="rien-page rien-wide rien-progress-page">
    <PageHeader title="Progress" />

    <div class="rien-stats">
      <SqCard v-for="stat in stats" :key="stat.label" variant="tonal">
        <SqCardText class="rien-card-body">
          <p class="rien-stat">{{ stat.value }}</p>
          <p class="rien-muted">{{ stat.label }}</p>
        </SqCardText>
      </SqCard>
    </div>

    <SqCard
      v-if="skills.length"
      title="Skills"
      :subtitle="working ? `Working at about ${working.level} (ACE ${working.ace}) · weakest first` : 'Weakest first'"
    >
      <SqCardText>
        <ul class="rien-bars">
          <li v-for="skill in skills" :key="skill.skill" class="rien-bar-row">
            <span class="rien-bar-label">{{ skill.label }}</span>
            <span class="rien-bar-track" aria-hidden="true">
              <span class="rien-bar-fill" :class="{ 'is-strong': skill.percent >= 80 }" :style="{ width: `${skill.percent}%` }" />
            </span>
            <span class="rien-bar-value" :aria-label="`${skill.percent}% right`">{{ skill.percent }}%</span>
          </li>
        </ul>
        <p class="rien-muted rien-skill-note">How often you get each one right at your level, from all your answers, recent ones counting most.</p>
      </SqCardText>
    </SqCard>

    <SqCard v-if="selfCheck" title="How well Rien knows you" variant="outlined">
      <SqCardText class="rien-stack rien-gap-sm">
        <p>
          Before learning from each of your last {{ selfCheck.n }} answers, Rien guessed whether you would get it right.
          It was right <b>{{ selfCheck.accuracy }}%</b> of the time<template v-if="selfCheck.sharper > 0">, and its guesses were {{ selfCheck.sharper }}% closer than a simple average</template>.
        </p>
        <ul class="rien-calibration" aria-label="What Rien expected and what happened">
          <li v-for="row in selfCheck.rows" :key="row.said">
            <span>Expected <b>{{ row.said }}%</b> right</span>
            <span>you got <b>{{ row.was }}%</b></span>
            <span class="rien-muted">{{ row.n }} answers</span>
          </li>
        </ul>
        <p class="rien-muted">
          {{ selfCheck.tuned ? 'Its learning speed is fitted to your answers.' : 'It uses its starting settings until you have 300 answers, then fits them to you.' }}
        </p>
        <p class="rien-muted">{{ selfCheck.network }}</p>
      </SqCardText>
    </SqCard>

    <SqCard v-if="!skills.length" title="Weak spots" subtitle="Slips in the last 30 days, most first">
      <SqCardText>
        <p v-if="spots.length === 0" class="rien-muted">No slips yet. Play Fix It or Final Sound Hunter to find them.</p>
        <ul v-else class="rien-bars">
          <li v-for="spot in spots" :key="spot.type" class="rien-bar-row">
            <span class="rien-bar-label">{{ spot.label }}</span>
            <span class="rien-bar-track" aria-hidden="true">
              <span class="rien-bar-fill" :style="{ width: `${(spot.count / maxSpot) * 100}%` }" />
            </span>
            <span class="rien-bar-value">{{ spot.count }}</span>
          </li>
        </ul>
      </SqCardText>
    </SqCard>

    <SqBarChart
      title="Minutes a day"
      :subtitle="`Last 14 days · ${dailyTotal} min in all`"
      :labels="daily.labels"
      :series="[{ name: 'Minutes', data: daily.values }]"
      :format="formatMinutes"
      :height="180"
    />

    <SqCard title="Days studied">
      <SqCardText>
        <StudyCalendar :days="studied" :today="now" />
      </SqCardText>
    </SqCard>

    <SqCard title="File Boss results" variant="outlined">
      <SqCardText>
        <p v-if="bosses.length === 0" class="rien-muted">None yet. Try File Boss when you finish a File.</p>
        <SqList v-else>
          <SqListItem
            v-for="boss in bosses"
            :key="boss.id"
            :title="`File ${boss.file}: ${boss.score} / ${boss.total}`"
            :subtitle="`${BOOK_LABELS[boss.book]} · ${formatDate(boss.at)}`"
          />
        </SqList>
      </SqCardText>
    </SqCard>
  </div>
</template>
