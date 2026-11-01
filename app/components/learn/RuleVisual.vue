<script setup lang="ts">
import type { MistakeType } from '#shared/schemas/db'
import type { TenseTime } from '#shared/schemas/pack'

// A small picture of the rule behind a mistake, shown with the answer.
// Pictures make a rule easier to remember than words alone.
// `when` places a tense sentence on the timeline (set on each pack item).
const props = defineProps<{ type: MistakeType, when?: TenseTime }>()

type Point = 'past' | 'now' | 'future'
const POINTS: Point[] = ['past', 'now', 'future']
const POINT_LABELS: Record<Point, string> = { past: 'Past', now: 'Now / always', future: 'Future' }

const TIMELINE: Record<TenseTime, { on: Point[], caption: string }> = {
  'past': { on: ['past'], caption: 'Finished time: past simple (went, saw). After did or didn\'t, the base verb: didn\'t see.' },
  'past-continuous': { on: ['past'], caption: 'In progress at a moment in the past: was or were + -ing.' },
  'past-habit': { on: ['past'], caption: 'A past habit that has stopped: used to + verb. After did: use to.' },
  'earlier-past': { on: ['past'], caption: 'Earlier than another past moment: had + past participle (had cooked).' },
  'past-to-now': { on: ['past', 'now'], caption: 'From the past up to now: have or has + past participle (have eaten, has lived).' },
  'now': { on: ['now'], caption: 'Happening now: am, is or are + -ing.' },
  'always': { on: ['now'], caption: 'Habits and facts: present simple (he goes, rice is grown).' },
  'future': { on: ['future'], caption: 'Plans and predictions: going to, will, or am, is or are + -ing.' },
  'imagined': { on: ['now'], caption: 'Imagined, not real: if + past simple, would + verb. It is about now, not the past.' },
}

const timeline = computed(() => props.when ? TIMELINE[props.when] : undefined)
</script>

<template>
  <figure class="rien-rule rien-pop" :aria-label="`Rule picture: ${type}`">
    <template v-if="type === 'tense'">
      <div class="rien-timeline" :class="{ 'is-span': when === 'past-to-now' }">
        <span class="rien-timeline-line" />
        <span
          v-for="point in POINTS"
          :key="point"
          class="rien-timeline-point"
          :class="{ 'is-on': timeline?.on.includes(point), 'is-imagined': when === 'imagined' }"
        >
          <i />
          {{ POINT_LABELS[point] }}
        </span>
      </div>
      <figcaption>
        {{ timeline?.caption ?? 'Past: went, saw. Now: am, is or are + -ing. Habits: present simple. Future: going to, will.' }}
      </figcaption>
    </template>

    <template v-else-if="type === 'third-person-s'">
      <div class="rien-rule-row">
        <span class="rien-chip-a">I / you / we / they</span><span class="rien-arrow">→</span><span class="rien-chip-b">like</span>
      </div>
      <div class="rien-rule-row">
        <span class="rien-chip-a">he / she / it</span><span class="rien-arrow">→</span><span class="rien-chip-b">like<b>s</b></span>
      </div>
      <figcaption>He, she and it add -s. After does or doesn't, no -s.</figcaption>
    </template>

    <template v-else-if="type === 'plural-s'">
      <div class="rien-rule-row rien-rule-big">
        <span>🍎 one apple</span><span class="rien-arrow">→</span><span>🍎🍎 two apple<b>s</b></span>
      </div>
      <figcaption>More than one: add -s. Some words change: child → children, person → people.</figcaption>
    </template>

    <template v-else-if="type === 'possessive-s'">
      <div class="rien-rule-row rien-rule-big">
        <span class="rien-chip-a">Dara<b>'s</b></span><span class="rien-arrow">→</span><span>👜 bag</span>
      </div>
      <figcaption>Owner + 's + thing: Dara's bag, my sister's phone.</figcaption>
    </template>

    <template v-else-if="type === 'article'">
      <div class="rien-rule-row">
        <span class="rien-chip-a"><b>a</b> + consonant sound</span><span>a cat, a university</span>
      </div>
      <div class="rien-rule-row">
        <span class="rien-chip-b"><b>an</b> + vowel sound</span><span>an apple, an hour</span>
      </div>
      <div class="rien-rule-row">
        <span class="rien-chip-c"><b>the</b> = the one we both know</span><span>the sun, the best</span>
      </div>
    </template>

    <template v-else-if="type === 'preposition'">
      <div class="rien-boxes">
        <div class="rien-box is-in">
          <b>in</b> May · 2026 · the morning
          <div class="rien-box is-on">
            <b>on</b> Monday · 2 May
            <div class="rien-box is-at"><b>at</b> 7:30 · night</div>
          </div>
        </div>
      </div>
      <figcaption>Big times take in, days take on, clock times take at.</figcaption>
    </template>

    <template v-else-if="type === 'word-order'">
      <div class="rien-blocks">
        <span class="b1">Where</span><span class="b2">do</span><span class="b3">you</span><span class="b4">live?</span>
      </div>
      <figcaption>Question word → do/does/did → person → verb.</figcaption>
    </template>
  </figure>
</template>
