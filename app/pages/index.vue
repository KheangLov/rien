<script setup lang="ts">
import { partLabel } from '#shared/schemas/db'
import type { ActivityId } from '#shared/utils/learning'
import { dateKey, summarizeStreak, weekStart } from '#shared/utils/streak'
import LevelUpCard from '~/components/learn/LevelUpCard.vue'

const db = useDb()
const now = useClock()
const todayKey = computed(() => dateKey(now.value))

const queue = useLiveQuery(() => loadWordQueue(now.value), [], now)
const total = useLiveQuery(() => db.countCards(), 0)
const studyDays = useLiveQuery(() => db.studyDays(), [] as string[])
const doneToday = useLiveQuery(() => db.gamesOn(todayKey.value), [] as string[], todayKey)
const settings = useLiveQuery(() => db.getSettings(), null)
const bosses = useLiveQuery(() => db.bossResults(), [])
const talks = useLiveQuery(() => db.talkResults(), [])
const tank = useLiveQuery(() => loadTank(now.value), null, now)
// Slips from the last 30 days, for My slips.
const slipCount = useLiveQuery(async () => (await db.mistakesSince(addDays(now.value, -WEAK_SPOT_DAYS))).length, 0, now)
const tankLine = computed(() => {
  const t = tank.value
  if (!t) return ''
  const fish = t.skills.filter(f => f.stage !== 'egg').length + t.awards.filter(a => a.unlocked).length
  const hungry = t.skills.filter(f => f.stage !== 'egg' && ['hungry', 'sick', 'dead'].includes(f.health)).length
  if (fish === 0) return 'Finish a round to hatch your first fish'
  return `${fish} fish${hungry ? ` · ${hungry} need feeding` : ' · all happy'}`
})

const plan = ref<ActivityId[]>([])
const planReady = ref(false)
watch(todayKey, async () => {
  plan.value = await loadSessionPlan(now.value)
  planReady.value = true
}, { immediate: true })

const streak = computed(() => summarizeStreak(studyDays.value, now.value))
const weeklyGoal = computed(() => settings.value?.weeklyGoal ?? 5)
// Skipped steps finish the session too (kept on this phone for the day).
const skipped = computed(() => (doneToday.value, loadSkipped(now.value)))
const planDone = computed(() => plan.value.filter(id => doneToday.value.includes(id) || skipped.value.includes(id)))
const sessionComplete = computed(() => plan.value.length > 0 && planDone.value.length === plan.value.length)
const sessionStarted = computed(() => planDone.value.length > 0)
// The step the session opens on next (the first one not done or skipped).
const nextStep = computed(() => plan.value.find(id => !planDone.value.includes(id)))

// "Practise more" once the session is done: scroll to the Practice list and
// put focus there, so a screen reader lands in the same place.
function showPractice() {
  const heading = document.getElementById('practice')
  if (!heading) return
  heading.scrollIntoView({ behavior: document.documentElement.classList.contains('rien-motion') ? 'smooth' : 'auto', block: 'start' })
  heading.focus({ preventScroll: true })
}

const today = computed(() =>
  now.value.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))

const practice = computed(() => {
  const ids: ActivityId[] = ['word-recall', 'fix-it', 'sound-hunter', 'sentence-builder', 'gap-radio', 'speed-round', 'listen-pick', 'picture-match']
  if (canListen()) ids.push('say-it')
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
          <RienIcon name="flame" :size="28" weight="fill" class="rien-streak-flame" />
          <strong class="rien-stat">{{ streak.current }}</strong>
        </div>
      </template>
    </PageHeader>

    <Squircle tag="section" class="rien-hero" :surface="false" :radius="30" aria-labelledby="session-title">
      <div class="rien-hero-head">
        <div>
          <h2 id="session-title">
            {{ sessionComplete ? 'Session done. Well done!' : sessionStarted ? 'Keep going' : 'Today’s session' }}
          </h2>
          <p>
            <template v-if="!planReady">Picking today’s activities…</template>
            <template v-else-if="sessionComplete">Come back tomorrow, or practise more below.</template>
            <template v-else-if="sessionStarted && nextStep">{{ planDone.length }} of {{ plan.length }} finished. Next: {{ ACTIVITIES[nextStep].title }}.</template>
            <template v-else>{{ plan.length }} short activities, about 12 minutes, picked for you.</template>
          </p>
        </div>
        <span v-if="sessionComplete" class="rien-hero-badge rien-pop" aria-hidden="true">
          <RienIcon name="check" :size="26" weight="bold" />
        </span>
      </div>
      <div
        v-if="plan.length"
        class="rien-hero-progress"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuemax="plan.length"
        :aria-valuenow="planDone.length"
        :aria-label="`${planDone.length} of ${plan.length} activities finished`"
      >
        <span :style="{ width: `${(planDone.length / plan.length) * 100}%` }" />
      </div>
      <div class="rien-hero-steps">
        <span
          v-for="id in plan"
          :key="id"
          class="rien-hero-step"
          :class="{ 'is-done': doneToday.includes(id), 'is-next': !sessionComplete && id === nextStep }"
        >
          <RienIcon :name="doneToday.includes(id) ? 'check' : ACTIVITIES[id].icon" :size="16" :weight="doneToday.includes(id) ? 'bold' : 'duotone'" />
          {{ ACTIVITIES[id].title }}
        </span>
      </div>
      <button
        v-if="planReady && !sessionComplete"
        type="button"
        class="rien-hero-btn"
        @click="navigateTo('/session')"
      >
        <RienIcon :name="sessionStarted ? 'next' : 'play'" :size="20" weight="bold" />
        <span>{{ sessionStarted ? 'Continue session' : 'Start session' }}</span>
      </button>
      <button
        v-else-if="sessionComplete"
        type="button"
        class="rien-hero-btn is-quiet"
        @click="showPractice"
      >
        Practise more
      </button>
    </Squircle>

    <LevelUpCard />
    <InstallCard />
    <BackupCard />
    <NewContent :kinds="['fixIt', 'builder']" />

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

    <h2 id="practice" class="rien-section-title" tabindex="-1">Practice</h2>
    <Squircle class="rien-list" :radius="22"><ul class="rien-list-items">
      <li v-for="item in practice" :key="item.id">
        <NuxtLink :to="item.to" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon :name="item.icon" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">{{ item.title }}</span>
            <span class="rien-list-sub">{{ item.sub }}</span>
          </span>
          <span class="rien-list-end">
            <span v-if="item.done" class="rien-done-dot" aria-label="Done today"><RienIcon name="check" :size="14" weight="bold" /></span>
            <RienIcon name="next" :size="16" weight="bold" />
          </span>
        </NuxtLink>
      </li>
    </ul></Squircle>

    <h2 class="rien-section-title">This week</h2>
    <Squircle class="rien-list" :radius="22"><ul class="rien-list-items">
      <li>
        <NuxtLink to="/tank" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="fish" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">Your fish tank</span>
            <span class="rien-list-sub">{{ tankLine }}</span>
          </span>
          <span class="rien-list-end"><RienIcon name="next" :size="16" weight="bold" /></span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/ielts" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="ielts" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">IELTS practice</span>
            <span class="rien-list-sub">Speaking, writing, reading, listening, academic words</span>
          </span>
          <span class="rien-list-end"><RienIcon name="next" :size="16" weight="bold" /></span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/slips" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="lightbulb" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">My slips</span>
            <span class="rien-list-sub">{{ slipCount ? `${slipCount} to practise from the last 30 days` : 'Nothing missed lately' }}</span>
          </span>
          <span class="rien-list-end"><RienIcon name="next" :size="16" weight="bold" /></span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/games/file-boss" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="file-boss" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">{{ settings ? partLabel(settings.book, settings.file) : '' }} Boss</span>
            <span class="rien-list-sub">{{ lastBoss ? `Best so far ${lastBoss.score} / ${lastBoss.total}` : 'When you finish the File' }}</span>
          </span>
          <span class="rien-list-end"><RienIcon name="next" :size="16" weight="bold" /></span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/games/couple-talk" class="rien-list-row">
          <span class="rien-list-icon"><RienIcon name="couple-talk" weight="duotone" :size="26" /></span>
          <span class="rien-list-text">
            <span class="rien-list-title">Couple Talk</span>
            <span class="rien-list-sub">{{ talkedThisWeek ? 'Done this week' : ACTIVITIES['couple-talk'].blurb }}</span>
          </span>
          <span class="rien-list-end">
            <span v-if="talkedThisWeek" class="rien-done-dot" aria-label="Done this week"><RienIcon name="check" :size="14" weight="bold" /></span>
            <RienIcon name="next" :size="16" weight="bold" />
          </span>
        </NuxtLink>
      </li>
    </ul></Squircle>
  </div>
</template>
