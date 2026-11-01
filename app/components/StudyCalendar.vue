<script setup lang="ts">
import { monthCells } from '#shared/utils/progress'
import { dateKey } from '#shared/utils/streak'

// A month of study days, like the iPhone's Fitness calendar: a filled circle on
// each day she studied (stronger for longer), a ring on today. Tap a day to see
// its minutes. Fits any phone width: seven equal columns, no fixed sizes.
const props = defineProps<{ days: { date: string, minutes: number }[], today: Date }>()

const shown = ref({ year: props.today.getFullYear(), month: props.today.getMonth() })
const picked = ref<string | null>(null)

const minutes = computed(() => new Map(props.days.map(d => [d.date, d.minutes])))
const cells = computed(() => monthCells(shown.value.year, shown.value.month))
const todayKey = computed(() => dateKey(props.today))
const title = computed(() =>
  new Date(shown.value.year, shown.value.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))
const isThisMonth = computed(() =>
  shown.value.year === props.today.getFullYear() && shown.value.month === props.today.getMonth())
const studiedThisMonth = computed(() => cells.value.filter(c => c.key && minutes.value.has(c.key)).length)

// Earliest month with a study day (or this month), so she can't page into nothing.
const firstMonth = computed(() => {
  const first = props.days.map(d => d.date).sort()[0]
  return first ? { year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)) - 1 } : { ...shown.value }
})
const canGoBack = computed(() =>
  shown.value.year * 12 + shown.value.month > Math.min(firstMonth.value.year * 12 + firstMonth.value.month,
    props.today.getFullYear() * 12 + props.today.getMonth()))

function move(by: number) {
  const index = shown.value.year * 12 + shown.value.month + by
  shown.value = { year: Math.floor(index / 12), month: index % 12 }
  picked.value = null
  haptic('tap')
}

// Strength of a day's circle: a few minutes is lighter, 15 or more is full.
function strength(key: string): number {
  const m = minutes.value.get(key) ?? 0
  return Math.min(1, 0.6 + (m / 15) * 0.4)
}

const pickedText = computed(() => {
  if (!picked.value) return ''
  const date = new Date(`${picked.value}T12:00:00`)
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const m = Math.round(minutes.value.get(picked.value) ?? 0)
  return minutes.value.has(picked.value) ? `${label}: ${Math.max(1, m)} ${m === 1 ? 'minute' : 'minutes'}` : `${label}: no study`
})

function pick(key: string) {
  picked.value = picked.value === key ? null : key
  haptic('tap')
}
</script>

<template>
  <div class="rien-cal">
    <div class="rien-cal-head">
      <h3 class="rien-cal-title">{{ title }}</h3>
      <button type="button" class="rien-cal-nav" :disabled="!canGoBack" aria-label="Previous month" @click="move(-1)">
        <RienIcon name="back" :size="20" weight="bold" />
      </button>
      <button type="button" class="rien-cal-nav" :disabled="isThisMonth" aria-label="Next month" @click="move(1)">
        <RienIcon name="next" :size="20" weight="bold" />
      </button>
    </div>

    <div class="rien-cal-grid" role="grid" :aria-label="title">
      <span v-for="(d, i) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="`w${i}`" class="rien-cal-weekday" aria-hidden="true">{{ d }}</span>
      <template v-for="(cell, i) in cells" :key="cell.key ?? `b${i}`">
        <span v-if="!cell.key" aria-hidden="true" />
        <button
          v-else
          type="button"
          class="rien-cal-day"
          :class="{
            'is-studied': minutes.has(cell.key),
            'is-today': cell.key === todayKey,
            'is-future': cell.key > todayKey,
            'is-picked': cell.key === picked,
          }"
          :style="minutes.has(cell.key) ? { '--strength': strength(cell.key) } : undefined"
          :disabled="cell.key > todayKey"
          :aria-label="`${cell.day}${minutes.has(cell.key) ? ', studied' : ''}`"
          @click="pick(cell.key)"
        >
          {{ cell.day }}
        </button>
      </template>
    </div>

    <p class="rien-cal-foot rien-muted" aria-live="polite">
      {{ pickedText || `${studiedThisMonth} ${studiedThisMonth === 1 ? 'day' : 'days'} studied. Tap a day to see its minutes.` }}
    </p>
  </div>
</template>
