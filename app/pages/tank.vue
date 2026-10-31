<script setup lang="ts">
import type { AchievementFish, Health, SkillFish, Stage } from '#shared/utils/tank'
import FishSprite from '~/components/tank/FishSprite.vue'
import FishTank from '~/components/tank/FishTank.vue'
import type { GameId } from '~/utils/activities'

const now = useClock()
const tank = useLiveQuery(() => loadTank(now.value), { skills: [] as SkillFish[], awards: [] as AchievementFish[] }, now)
const selected = ref<string | null>(null)

const STAGE_NAMES: Record<Stage, string> = { egg: 'Egg', baby: 'Baby', young: 'Young', adult: 'Adult', giant: 'Giant' }
const HEALTH_NAMES: Record<Health, string> = { happy: 'Happy', fine: 'Fine', hungry: 'Hungry', sick: 'Sick', dead: 'Died' }

const unlocked = computed(() => tank.value.awards.filter(a => a.unlocked))
const fishCount = computed(() => tank.value.skills.filter(f => f.stage !== 'egg').length + unlocked.value.length)
const needCare = computed(() => tank.value.skills.filter(f => f.stage !== 'egg' && ['hungry', 'sick', 'dead'].includes(f.health)))

const chosen = computed(() =>
  tank.value.skills.find(f => f.id === selected.value) ?? tank.value.awards.find(a => a.id === selected.value))

function gameTitle(game: string) {
  return ACTIVITIES[game as GameId]?.title ?? game
}

function care(fish: SkillFish): string {
  const game = gameTitle(fish.game)
  if (fish.stage === 'egg') return `Play ${game} to hatch it.`
  if (fish.health === 'dead') return `It died after three weeks without ${game}. One round brings it back.`
  if (fish.health === 'sick') return `Very hungry. Play ${game} soon.`
  if (fish.health === 'hungry') return `Hungry. A round of ${game} will feed it.`
  return fish.toNext === null
    ? `Fully grown. Keep playing ${game} to keep it happy.`
    : `${fish.toNext} more ${fish.toNext === 1 ? 'round' : 'rounds'} of ${game} to grow.`
}

function select(id: string) {
  selected.value = selected.value === id ? null : id
  haptic('tap')
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Tank" :subtitle="`${fishCount} ${fishCount === 1 ? 'fish' : 'fish'} · ${unlocked.length} of ${tank.awards.length} awards`" />

    <FishTank :skills="tank.skills" :awards="tank.awards" :selected="selected" @select="select" />

    <SqCard v-if="chosen" variant="outlined">
      <SqCardText class="rien-stack rien-card-body">
        <div class="rien-fish-card">
          <FishSprite
            :species="chosen.species"
            :stage="chosen.kind === 'skill' ? chosen.stage : 'adult'"
            :health="chosen.kind === 'skill' ? chosen.health : 'happy'"
            :width="96"
          />
          <div>
            <strong class="rien-cue">{{ chosen.title }}</strong>
            <p class="rien-muted">
              {{ chosen.species.name }}<template v-if="chosen.kind === 'skill'"> · {{ STAGE_NAMES[chosen.stage] }} · {{ HEALTH_NAMES[chosen.health] }}</template>
            </p>
          </div>
        </div>
        <p v-if="chosen.kind === 'skill'">
          Grows with {{ gameTitle(chosen.game) }}: {{ chosen.rounds }} {{ chosen.rounds === 1 ? 'round' : 'rounds' }} so far. {{ care(chosen) }}
        </p>
        <p v-else>Award: {{ chosen.goal }}.</p>
      </SqCardText>
      <SqCardActions v-if="chosen.kind === 'skill'">
        <SqBtn :to="`/games/${chosen.game}`" color="primary">
          {{ chosen.stage === 'egg' ? 'Hatch it' : chosen.health === 'dead' ? 'Bring it back' : 'Feed it' }}: {{ gameTitle(chosen.game) }}
        </SqBtn>
      </SqCardActions>
    </SqCard>

    <p v-else class="rien-muted">
      Each study fish grows when you play its game. Leave a game for three weeks and its fish dies; one round brings it back. Awards add new fish. Tap a fish to see it.
    </p>

    <h2 class="rien-section-title">Study fish</h2>
    <ul class="rien-list">
      <li v-for="fish in tank.skills" :key="fish.id">
        <NuxtLink :to="`/games/${fish.game}`" class="rien-list-row">
          <span class="rien-fish-thumb">
            <FishSprite :species="fish.species" :stage="fish.stage" :health="fish.health" :width="48" />
          </span>
          <span class="rien-list-text">
            <span class="rien-list-title">{{ fish.title }} · {{ STAGE_NAMES[fish.stage] }}</span>
            <span class="rien-list-sub">{{ care(fish) }}</span>
          </span>
          <span class="rien-list-end">
            <SqChip
              v-if="fish.stage !== 'egg' && fish.health !== 'happy'"
              size="small"
              :color="fish.health === 'fine' ? undefined : fish.health === 'hungry' ? 'warning' : 'error'"
              :text="HEALTH_NAMES[fish.health]"
            />
            <RienIcon name="next" :size="18" />
          </span>
        </NuxtLink>
      </li>
    </ul>

    <h2 class="rien-section-title">Awards</h2>
    <ul class="rien-awards">
      <li v-for="award in tank.awards" :key="award.id">
        <button
          type="button"
          class="rien-award"
          :class="{ 'is-locked': !award.unlocked }"
          :aria-label="award.unlocked ? `${award.title}: ${award.goal}. Unlocked.` : `Locked: ${award.goal}. ${award.have} of ${award.need}.`"
          @click="award.unlocked && select(award.id)"
        >
          <FishSprite :species="award.species" stage="adult" :silhouette="!award.unlocked" :width="56" />
          <strong>{{ award.unlocked ? award.title : '???' }}</strong>
          <span>{{ award.goal }}</span>
          <span v-if="!award.unlocked" class="rien-award-bar" aria-hidden="true">
            <span :style="{ width: `${(award.have / award.need) * 100}%` }" />
          </span>
          <span v-if="!award.unlocked" class="rien-award-count">{{ award.have }} / {{ award.need }}</span>
        </button>
      </li>
    </ul>

    <p v-if="needCare.length" class="rien-muted">
      {{ needCare.length }} {{ needCare.length === 1 ? 'fish needs' : 'fish need' }} feeding.
    </p>
  </div>
</template>
