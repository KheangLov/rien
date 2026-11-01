<script setup lang="ts">
import { BOOK_LABELS } from '#shared/schemas/db'
import { minutesByDay, minutesThisWeek, weakSpots } from '#shared/utils/progress'
import { addDays } from '#shared/utils/streak'

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
  <div class="rien-page">
    <PageHeader title="Progress" />

    <div class="rien-stats">
      <SqCard v-for="stat in stats" :key="stat.label" variant="tonal">
        <SqCardText class="rien-card-body">
          <p class="rien-stat">{{ stat.value }}</p>
          <p class="rien-muted">{{ stat.label }}</p>
        </SqCardText>
      </SqCard>
    </div>

    <SqCard title="Weak spots" subtitle="Slips in the last 30 days, most first">
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
