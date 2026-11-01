<script setup lang="ts">
import type { MistakeType } from '#shared/schemas/db'

// A small picture of the rule behind a mistake, shown with the answer.
// Pictures make a rule easier to remember than words alone.
const props = defineProps<{ type: MistakeType, sentence?: string }>()

const s = computed(() => (props.sentence ?? '').toLowerCase())
// Where the sentence sits in time, from its time words.
const when = computed(() => {
  if (/\b(tomorrow|next|going to|will|plan|soon)\b/.test(s.value)) return 'future'
  if (/\b(yesterday|ago|last|was|were|did|born|when i arrived|in \d{4}|had)\b/.test(s.value)) return 'past'
  return 'now'
})
</script>

<template>
  <figure class="rien-rule rien-pop" :aria-label="`Rule picture: ${type}`">
    <template v-if="type === 'tense'">
      <div class="rien-timeline">
        <span class="rien-timeline-line" />
        <span
          v-for="point in (['past', 'now', 'future'] as const)"
          :key="point"
          class="rien-timeline-point"
          :class="{ 'is-on': when === point }"
        >
          <i />
          {{ point === 'past' ? 'Past' : point === 'now' ? 'Now / always' : 'Future' }}
        </span>
      </div>
      <figcaption>
        {{ when === 'past' ? 'Finished time: past simple (went, saw) or was + -ing.'
          : when === 'future' ? 'Plans and predictions: going to, will, or am/is/are + -ing.'
            : 'Habits: present simple. Happening now: am/is/are + -ing.' }}
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
