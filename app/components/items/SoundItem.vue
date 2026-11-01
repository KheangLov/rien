<script setup lang="ts">
import type { GrammarRow } from '#shared/schemas/db'
import { SOUND_FOCUS_TIPS } from '#shared/schemas/pack'
import { shuffle } from '#shared/utils/rounds'
import { gradeSound, type SoundCard } from '#shared/utils/sounds'

// One sound pair: she hears one of two words and picks which one it was.
const props = defineProps<{ card: SoundCard, previous?: GrammarRow }>()
const emit = defineEmits<{
  answered: [answer: { row: GrammarRow, slipped: boolean }]
  next: []
}>()

const db = useDb()
const { supported: canSpeak, speak } = useSpeech()

const played = Math.random() < 0.5 ? props.card.a : props.card.b
// Show the two words in random order so position gives nothing away.
const options = shuffle([props.card.a, props.card.b])
const listened = ref(false)

// The part of each word that differs (want|s, ba|g / ba|ck), to see the sound.
const split = computed(() => {
  const [a, b] = [props.card.a, props.card.b]
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [a, b].map(w => ({ same: w.slice(0, i), diff: w.slice(i) }))
})
const picked = ref<string | null>(null)

function play() {
  speak(played)
  listened.value = true
}

async function choose(option: string) {
  if (picked.value) return
  picked.value = option
  const { row, mistake } = gradeSound(props.card, props.previous, played, option, new Date())
  haptic(mistake ? 'error' : 'success')
  await db.saveGrammarAnswer(row, mistake)
  emit('answered', { row, slipped: Boolean(mistake) })
}
</script>

<template>
  <SqCard class="rien-rise">
    <SqCardText class="rien-stack rien-card-body">
      <SqAlert
        v-if="!canSpeak"
        type="warning"
        variant="tonal"
        text="This phone cannot read words aloud here, so this game cannot run."
      />
      <template v-else>
        <p class="rien-muted">{{ picked ? 'Compare the two words.' : 'Listen. Which word do you hear?' }}</p>

        <SqBtn v-if="!picked" color="primary" size="large" @click="play">
          {{ listened ? 'Play again' : 'Play' }}
        </SqBtn>

        <div class="rien-pair">
          <SqBtn
            v-for="option in options"
            :key="option"
            size="large"
            :variant="picked === option ? undefined : 'tonal'"
            :color="picked && option === played ? 'success' : picked === option ? 'error' : undefined"
            :disabled="!listened || Boolean(picked)"
            @click="choose(option)"
          >
            {{ option }}
          </SqBtn>
        </div>

        <template v-if="picked">
          <p class="rien-ending rien-pop" aria-label="The sound that differs">
            <span v-for="w in split" :key="w.same + w.diff">{{ w.same }}<mark v-if="w.diff">{{ w.diff }}</mark></span>
          </p>
          <SqAlert
            :class="picked === played ? 'rien-pop' : 'rien-shake'"
            :type="picked === played ? 'success' : 'error'"
            variant="tonal"
            :title="picked === played ? `Yes: ${played}` : `It was “${played}”`"
            :text="SOUND_FOCUS_TIPS[card.focus]"
          />
          <ActionBar>
            <SqBtn color="primary" size="large" @click="emit('next')">Next</SqBtn>
            <SqBtn variant="tonal" size="large" @click="speak([card.a, card.b])">Hear both</SqBtn>
          </ActionBar>
        </template>
      </template>
    </SqCardText>
  </SqCard>
</template>
