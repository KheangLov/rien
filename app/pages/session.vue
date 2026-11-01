<script setup lang="ts">
import type { ActivityId } from '#shared/utils/learning'
import { dateKey } from '#shared/utils/streak'
import { GAME_COMPONENTS } from '~/components/games/registry'

useHead({ title: 'Today’s session · Rien' })

const db = useDb()
const recorder = useActivityRecorder()

const plan = ref<ActivityId[]>([])
const index = ref(0)
const phase = ref<'loading' | 'playing' | 'between' | 'finished'>('loading')
const streakToday = ref(false)

const current = computed(() => plan.value[index.value])
const nextUp = computed(() => plan.value[index.value + 1])

onMounted(async () => {
  plan.value = await loadSessionPlan()
  const done = [...await db.gamesOn(dateKey(new Date())), ...loadSkipped()]
  // Pick up where she left off.
  const firstOpen = plan.value.findIndex(id => !done.includes(id))
  if (firstOpen === -1) {
    phase.value = 'finished'
    return
  }
  index.value = firstOpen
  phase.value = 'playing'
  recorder.restart()
})

async function onDone(score?: { clean: number, total: number }) {
  const finished = current.value
  if (!finished) return
  // A failed save must not leave her stuck on a finished activity.
  try {
    await recorder.record(finished, score)
  }
  catch (error) {
    console.error('[rien] could not record the activity', error)
  }
  haptic('success')
  const done = [...await db.gamesOn(dateKey(new Date())), ...loadSkipped()]
  const following = plan.value.findIndex((id, i) => i > index.value && !done.includes(id))
  if (following === -1) {
    streakToday.value = true
    phase.value = 'finished'
  }
  else {
    index.value = following - 1
    phase.value = 'between'
  }
}

// For a step with nothing to do (no words due any more) or one she wants to leave.
function skip() {
  if (current.value) skipStep(current.value)
  if (index.value + 1 >= plan.value.length) {
    phase.value = 'finished'
    return
  }
  phase.value = 'between'
}

function continueSession() {
  index.value++
  phase.value = 'playing'
  recorder.restart()
}
</script>

<template>
  <div class="rien-page rien-game">
    <div class="rien-game-bar">
      <NuxtLink to="/" class="rien-icon-btn" aria-label="Close session">
        <RienIcon name="close" weight="bold" />
      </NuxtLink>
      <div class="rien-session-steps" aria-label="Session progress">
        <span
          v-for="(id, i) in plan"
          :key="id"
          class="rien-session-step"
          :class="{ 'is-done': i < index || phase === 'finished' || (i === index && phase === 'between'), 'is-current': i === index && phase === 'playing' }"
        />
      </div>
      <button v-if="phase === 'playing'" type="button" class="rien-icon-btn rien-skip" @click="skip">Skip</button>
      <span v-else />
    </div>

    <SqSkeleton v-if="phase === 'loading'" height="240" />

    <template v-else-if="phase === 'playing' && current">
      <p class="rien-muted rien-session-label">
        {{ index + 1 }} of {{ plan.length }} · {{ ACTIVITIES[current].title }}
      </p>
      <component :is="GAME_COMPONENTS[current]" :key="current" @done="onDone" />
    </template>

    <template v-else-if="phase === 'between' && nextUp">
      <div class="rien-celebrate">
        <span class="rien-celebrate-icon"><RienIcon name="check" :size="44" weight="bold" /></span>
        <h2>Nice work!</h2>
        <p class="rien-muted">Next up: {{ ACTIVITIES[nextUp].title }}. {{ ACTIVITIES[nextUp].blurb }}.</p>
      </div>
      <ActionBar>
        <SqBtn color="primary" size="large" @click="continueSession">Continue</SqBtn>
      </ActionBar>
    </template>

    <template v-else-if="phase === 'finished'">
      <Confetti />
      <div class="rien-celebrate">
        <span class="rien-celebrate-icon is-big"><RienIcon name="flame" :size="52" weight="fill" /></span>
        <h2>Session complete</h2>
        <p class="rien-muted">
          {{ streakToday ? 'Today counts towards your streak.' : 'You have already finished today’s session.' }}
          Words you missed will come back just before you forget them.
        </p>
      </div>
      <ActionBar>
        <SqBtn color="primary" size="large" @click="navigateTo('/')">Back to Today</SqBtn>
      </ActionBar>
    </template>
  </div>
</template>
