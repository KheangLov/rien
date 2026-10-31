<script setup lang="ts">
import type { ActivityId } from '#shared/utils/learning'
import { dateKey, summarizeStreak, weekStart } from '#shared/utils/streak'

const db = useDb()
const now = useClock()
const todayKey = computed(() => dateKey(now.value))
const native = isNativeApp()

const queue = useLiveQuery(() => loadWordQueue(now.value), [], now)
const total = useLiveQuery(() => db.countCards(), 0)
const studyDays = useLiveQuery(() => db.studyDays(), [] as string[])
const doneToday = useLiveQuery(() => db.gamesOn(todayKey.value), [] as string[], todayKey)
const settings = useLiveQuery(() => db.getSettings(), null)
const bosses = useLiveQuery(() => db.bossResults(), [])
const talks = useLiveQuery(() => db.talkResults(), [])

const plan = ref<ActivityId[]>([])
watch(todayKey, async () => { plan.value = await loadSessionPlan(now.value) }, { immediate: true })

const streak = computed(() => summarizeStreak(studyDays.value, now.value))
const weeklyGoal = computed(() => settings.value?.weeklyGoal ?? 5)
// Skipped steps finish the session too (kept on this phone for the day).
const skipped = computed(() => (doneToday.value, loadSkipped(now.value)))
const planDone = computed(() => plan.value.filter(id => doneToday.value.includes(id) || skipped.value.includes(id)))
const sessionComplete = computed(() => plan.value.length > 0 && planDone.value.length === plan.value.length)
const sessionStarted = computed(() => planDone.value.length > 0)

const today = computed(() =>
  now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))

const practice = computed(() => {
  const ids: ActivityId[] = ['word-recall', 'fix-it', 'sound-hunter', 'sentence-builder', 'gap-radio']
  if (native) ids.push('say-it')
  return ids.map(id => ({
    id,
    ...ACTIVITIES[id],
    sub: id === 'word-recall'
      ? (total.value === 0 ? 'Add words from class first' : queue.value.length ? `${queue.value.length} to review` : 'Nothing due right now')
      : ACTIVITIES[id].blurb,
    done: doneToday.value.includes(id),
    to: id === 'word-recall' && total.value === 0 ? '/add-words' : `/games/${id}`,
  }))
})

const lastBoss = computed(() => {
  const s = settings.value
  return s ? bosses.value.find(b => b.book === s.book && b.file === s.file) : undefined
})
const talkedThisWeek = computed(() => {
  const monday = weekStart(now.value).getTime()
  return talks.value.some(t => t.at.getTime() >= monday)
})
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Today" :subtitle="today">
      <template #action>
        <div class="rien-streak-row" :aria-label="`${streak.current} day streak`">
          <RienIcon name="flame" :size="26" class="rien-streak-flame" />
          <strong class="rien-stat">{{ streak.current }}</strong>
        </div>
      </template>
    </PageHeader>

    <section class="rien-hero" aria-labelledby="session-title">
      <div>
        <h2 id="session-title">
          {{ sessionComplete ? 'Session done. Well done!' : sessionStarted ? 'Keep going' : 'Today’s session' }}
        </h2>
        <p>
          {{ sessionComplete
            ? 'Come back tomorrow, or practise more below.'
            : `${plan.length} short activities, about 12 minutes, picked for you.` }}
        </p>
      </div>
      <div class="rien-hero-steps">
        <span
          v-for="id in plan"
          :key="id"
          class="rien-hero-step"
          :class="{ 'is-done': doneToday.includes(id) }"
        >
          <RienIcon :name="doneToday.includes(id) ? 'check' : ACTIVITIES[id].icon" :size="16" />
          {{ ACTIVITIES[id].title }}
        </span>
      </div>
      <button
        v-if="!sessionComplete"
        type="button"
        class="rien-hero-btn"
        @click="navigateTo('/session')"
      >
        {{ sessionStarted ? 'Continue session' : 'Start session' }}
      </button>
    </section>

    <SqCard variant="outlined">
      <SqCardText class="rien-stack rien-card-body">
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
          {{ streak.weekCount }} of {{ weeklyGoal }} days this week<template v-if="streak.weekCount >= weeklyGoal"> · goal reached</template>.
          {{ streak.current === 0 ? 'Finish one activity to start a streak.' : streak.restUsedThisWeek ? 'Rest day used this week.' : 'One missed day a week won’t break your streak.' }}
        </p>
      </SqCardText>
    </SqCard>

    <h2 class="rien-section-title">Practice</h2>
    <ul class="rien-list">
      <li v-for="item in practice" :key="item.id">
        <NuxtLink :to="item.to" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon :name="item.icon" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">{{ item.title }}</span>
            <span class="rien-list-sub">{{ item.sub }}</span>
          </span>
          <span class="rien-list-end">
            <span v-if="item.done" class="rien-done-dot" aria-label="Done today"><RienIcon name="check" :size="14" /></span>
            <RienIcon name="next" :size="18" />
          </span>
        </NuxtLink>
      </li>
    </ul>

    <h2 class="rien-section-title">This week</h2>
    <ul class="rien-list">
      <li>
        <NuxtLink to="/games/file-boss" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="file-boss" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">File {{ settings?.file ?? '' }} Boss</span>
            <span class="rien-list-sub">{{ lastBoss ? `Best so far ${lastBoss.score} / ${lastBoss.total}` : 'When you finish the File' }}</span>
          </span>
          <span class="rien-list-end"><RienIcon name="next" :size="18" /></span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/games/couple-talk" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="couple-talk" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">Couple Talk</span>
            <span class="rien-list-sub">{{ talkedThisWeek ? 'Done this week' : ACTIVITIES['couple-talk'].blurb }}</span>
          </span>
          <span class="rien-list-end">
            <span v-if="talkedThisWeek" class="rien-done-dot" aria-label="Done this week"><RienIcon name="check" :size="14" /></span>
            <RienIcon name="next" :size="18" />
          </span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
