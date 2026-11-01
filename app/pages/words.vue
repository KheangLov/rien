<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import { normalizeAnswer } from '#shared/utils/answer'
import { isTricky, nextReviewLabel } from '#shared/utils/learning'
import { vInputAttrs } from '~/directives/inputAttrs'
import { vPlainInput } from '~/directives/plainInput'

const db = useDb()
const now = useClock()
const { supported: canSpeak, speak } = useSpeech()

const cards = useLiveQuery(() => db.allCards(), [] as CardRow[])
const search = ref('')
const filter = ref<'all' | 'due' | 'tricky'>('all')
const open = ref<string | null>(null)

const counts = computed(() => ({
  all: cards.value.length,
  due: cards.value.filter(c => c.due <= now.value).length,
  tricky: cards.value.filter(isTricky).length,
}))

const shown = computed(() => {
  const q = normalizeAnswer(search.value)
  return cards.value
    .filter(c => filter.value === 'all' || (filter.value === 'due' ? c.due <= now.value : isTricky(c)))
    .filter(c => !q || normalizeAnswer(`${c.answer} ${c.meaning} ${c.khmer}`).includes(q))
})

// Rows are drawn PAGE at a time, more as she scrolls near the end: with a
// year of words (1500) drawing them all at once held the screen for a fifth of
// a second on a phone-speed CPU.
const PAGE = 60
const limit = ref(PAGE)
watch([search, filter], () => { limit.value = PAGE })
const visible = computed(() => shown.value.slice(0, limit.value))
const more = ref<HTMLElement | null>(null)
let watcher: IntersectionObserver | undefined
onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    limit.value = Number.POSITIVE_INFINITY
    return
  }
  watcher = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting) && limit.value < shown.value.length) limit.value += PAGE
  }, { rootMargin: '800px 0px' })
})
watch(more, (el, old) => {
  if (old) watcher?.unobserve(old)
  if (el) watcher?.observe(el)
})
onBeforeUnmount(() => watcher?.disconnect())

const pictureFor = ref<string | null>(null)
const pictureInput = ref<HTMLInputElement | null>(null)

function choosePicture(id: string) {
  pictureFor.value = id
  pictureInput.value?.click()
}

async function pickPicture(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !pictureFor.value) return
  try {
    await db.setCardImage(pictureFor.value, await shrinkImage(file))
    haptic('success')
  }
  catch {
    window.alert('That picture could not be opened. Try another one.')
  }
}

// The word shown in the sheet (kept fresh as reviews or pictures change).
const openCard = computed(() => cards.value.find(c => c.id === open.value))

function show(id: string) {
  open.value = id
  haptic('tap')
}

async function remove(card: CardRow) {
  if (!window.confirm(`Delete “${card.answer}” and its review history?`)) return
  await db.deleteCard(card.id)
  open.value = null
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Words" :subtitle="`${counts.all} saved`">
      <template #action>
        <NuxtLink to="/add-words" class="rien-add-btn" aria-label="Add a word">
          <RienIcon name="plus" weight="bold" />
        </NuxtLink>
      </template>
    </PageHeader>

    <!-- A native-style search bar: Squirkle's filled field with the Solar magnifier. -->
    <SqTextField
      v-model="search"
      v-plain-input
      v-input-attrs="{ 'aria-label': 'Search words', 'enterkeyhint': 'search', 'type': 'search' }"
      class="rien-search"
      variant="filled"
      prepend-inner-icon="search"
      placeholder="Search"
      hide-details
      clearable
    />
    <input ref="pictureInput" type="file" accept="image/*" hidden @change="pickPicture">

    <IosSegmented
      v-model="filter"
      label="Filter words"
      :options="[
        { value: 'all', label: `All ${counts.all}` },
        { value: 'due', label: `Due ${counts.due}` },
        { value: 'tricky', label: `Tricky ${counts.tricky}` },
      ]"
    />

    <SqEmptyState
      v-if="counts.all === 0"
      title="No words yet"
      text="After each class, add the new words. Rien brings each one back just before you would forget it."
    >
      <SqBtn to="/add-words" color="primary">Add your first word</SqBtn>
    </SqEmptyState>

    <p v-else-if="shown.length === 0" class="rien-muted">
      {{ filter === 'tricky' ? 'No tricky words. Words you forget three times show up here.' : 'No words match.' }}
    </p>

    <Squircle v-else class="rien-list" :radius="22"><ul class="rien-list-items">
      <li v-for="card in visible" :key="card.id">
        <button type="button" class="rien-list-row" @click="show(card.id)">
          <Squircle v-if="card.image" :radius="10" :surface="false" class="rien-word-thumb">
            <img :src="card.image" alt="">
          </Squircle>
          <span class="rien-list-text">
            <span class="rien-list-title">{{ card.answer }}</span>
            <span class="rien-list-sub">{{ card.meaning || card.khmer || card.example }}</span>
          </span>
          <span class="rien-list-end">
            <SqChip v-if="isTricky(card)" size="small" color="warning" text="Tricky" />
            <span class="rien-due-label">{{ nextReviewLabel(card.due, now) }}</span>
            <RienIcon name="next" :size="16" weight="bold" class="ios-chevron" />
          </span>
        </button>
      </li>
    </ul></Squircle>
    <div v-if="limit < shown.length" ref="more" class="rien-list-more" aria-hidden="true" />

    <IosSheet :open="Boolean(openCard)" :title="openCard?.answer" @close="open = null">
      <template v-if="openCard">
        <Squircle v-if="openCard.image" :radius="20" :surface="false">
          <img :src="openCard.image" alt="" class="rien-word-image">
        </Squircle>
        <p v-if="openCard.meaning" class="rien-cue">{{ openCard.meaning }}</p>
        <p v-if="openCard.example" class="rien-example">{{ openCard.example }}</p>
        <p v-if="openCard.khmer" class="rien-khmer rien-cue">{{ openCard.khmer }}</p>
        <p class="rien-muted">
          File {{ openCard.file }} · {{ nextReviewLabel(openCard.due, now) }} · reviewed {{ openCard.fsrs.reps }}
          {{ openCard.fsrs.reps === 1 ? 'time' : 'times' }} · forgotten {{ openCard.fsrs.lapses }}
          {{ openCard.fsrs.lapses === 1 ? 'time' : 'times' }}
        </p>
        <p v-if="isTricky(openCard)" class="rien-muted">
          Tip: say it aloud in your own sentence, or link it to a picture in your head.
        </p>
        <IosGroup>
          <IosRow v-if="canSpeak" label="Hear it" icon="volume" tint="primary" @click="speak(openCard.answer)" />
          <IosRow :label="openCard.image ? 'Change picture' : 'Add a picture'" icon="camera" tint="primary" @click="choosePicture(openCard.id)" />
          <IosRow v-if="openCard.image" label="Remove picture" icon="image" tint="primary" @click="db.setCardImage(openCard.id, undefined)" />
          <IosRow label="Delete word" icon="close" tint="danger" @click="remove(openCard)" />
        </IosGroup>
      </template>
    </IosSheet>
  </div>
</template>
