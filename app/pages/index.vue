<script setup lang="ts">
import { dateKey, summarizeStreak, weekStart } from '#shared/utils/streak'

const db = useDb()
const now = useClock()
const todayKey = computed(() => dateKey(now.value))

const due = useLiveQuery(() => db.countDue(now.value), 0, now)
const total = useLiveQuery(() => db.countCards(), 0)
const studyDays = useLiveQuery(() => db.studyDays(), [] as string[])
const doneToday = useLiveQuery(() => db.gamesOn(todayKey.value), [] as string[], todayKey)
const settings = useLiveQuery(() => db.getSettings(), null)
const bosses = useLiveQuery(() => db.bossResults(), [])
const talks = useLiveQuery(() => db.talkResults(), [])
const talkedThisWeek = computed(() => {
  const monday = weekStart(now.value).getTime()
  return talks.value.some(t => t.at.getTime() >= monday)
})
const lastBoss = computed(() => {
  const s = settings.value
  return s ? bosses.value.find(b => b.book === s.book && b.file === s.file) : undefined
})

const streak = computed(() => summarizeStreak(studyDays.value, now.value))
const weeklyGoal = computed(() => settings.value?.weeklyGoal ?? 5)

const today = computed(() =>
  now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))

const streakNote = computed(() => {
  const s = streak.value
  if (s.current === 0) return 'Finish one activity to start your streak.'
  if (!s.studiedToday) return 'Finish one activity today to keep it going.'
  if (s.restUsedThisWeek) return 'Rest day used this week.'
  return 'One missed day a week won’t break it.'
})

const activities = computed(() => [
  {
    id: 'word-recall',
    title: 'Word Recall',
    text: total.value === 0
      ? 'Add words from class first.'
      : due.value === 0
        ? 'No words due right now.'
        : `${due.value} ${due.value === 1 ? 'word' : 'words'} to review`,
    ready: due.value > 0,
  },
  {
    id: 'fix-it',
    title: 'Fix It',
    text: 'Eight sentences, one mistake in each',
    ready: true,
  },
  {
    id: 'sound-hunter',
    title: 'Final Sound Hunter',
    text: 'Ten words read aloud. Pick the one you hear.',
    ready: true,
  },
].map(activity => ({ ...activity, done: doneToday.value.includes(activity.id) })))
</script>

<template>
  <div class="rien-page">
    <header class="rien-header">
      <h1 class="rien-title">Rien · <span class="rien-khmer">រៀន</span></h1>
      <p class="rien-muted">{{ today }}</p>
    </header>

    <SqCard variant="tonal">
      <SqCardText class="rien-stack rien-card-body">
        <div>
          <p class="rien-big">{{ streak.current }}</p>
          <p class="rien-muted">{{ streak.current === 1 ? 'day' : 'days' }} in a row. {{ streakNote }}</p>
        </div>
        <div class="rien-week" role="list" aria-label="This week">
          <div
            v-for="day in streak.week"
            :key="day.key"
            role="listitem"
            class="rien-day"
            :class="{ 'is-studied': day.studied, 'is-today': day.today, 'is-future': day.future }"
            :aria-label="`${day.key}${day.studied ? ', studied' : ''}${day.today ? ', today' : ''}`"
          >
            <span class="rien-dot" />
            <span>{{ day.label }}</span>
          </div>
        </div>
        <p class="rien-muted">
          {{ streak.weekCount }} of {{ weeklyGoal }} days this week<template v-if="streak.weekCount >= weeklyGoal"> · goal reached</template>
        </p>
      </SqCardText>
    </SqCard>

    <SqCard v-for="activity in activities" :key="activity.id" variant="outlined">
      <SqCardText class="rien-stack rien-card-body">
        <div class="rien-activity-head">
          <strong>{{ activity.title }}</strong>
          <SqChip v-if="activity.done" color="success" size="small" text="Done today" />
        </div>
        <p class="rien-muted">{{ activity.text }}</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn
          v-if="activity.ready"
          :to="`/games/${activity.id}`"
          :color="activity.done ? undefined : 'primary'"
          :variant="activity.done ? 'tonal' : undefined"
        >
          {{ activity.done ? 'Play again' : 'Start' }}
        </SqBtn>
        <SqBtn v-else-if="activity.id === 'word-recall'" to="/add-words" variant="tonal">Add words</SqBtn>
      </SqCardActions>
    </SqCard>

    <SqCard v-if="settings" variant="tonal">
      <SqCardText class="rien-stack rien-card-body">
        <div class="rien-activity-head">
          <strong>File {{ settings.file }} Boss</strong>
          <SqChip
            v-if="lastBoss"
            :color="lastBoss.score >= lastBoss.total * 0.8 ? 'success' : undefined"
            size="small"
            :text="`Best so far ${lastBoss.score} / ${lastBoss.total}`"
          />
        </div>
        <p class="rien-muted">15 questions from your File {{ settings.file }} words and recent mistakes. Try it when you finish the File.</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/games/file-boss" variant="tonal">Start File Boss</SqBtn>
      </SqCardActions>
    </SqCard>

    <SqCard variant="tonal">
      <SqCardText class="rien-stack rien-card-body">
        <div class="rien-activity-head">
          <strong>Couple Talk</strong>
          <SqChip v-if="talkedThisWeek" color="success" size="small" text="Done this week" />
        </div>
        <p class="rien-muted">Ten minutes of English together this evening: three questions and a timer.</p>
      </SqCardText>
      <SqCardActions>
        <SqBtn to="/games/couple-talk" variant="tonal">Start Couple Talk</SqBtn>
      </SqCardActions>
    </SqCard>

    <div class="rien-row">
      <SqBtn v-if="total > 0" to="/add-words" variant="tonal">Add words</SqBtn>
      <SqBtn to="/progress" variant="text">Progress</SqBtn>
      <SqBtn to="/settings" variant="text">Settings</SqBtn>
    </div>
  </div>
</template>
