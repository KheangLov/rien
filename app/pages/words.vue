<script setup lang="ts">
import type { CardRow } from '#shared/schemas/db'
import { normalizeAnswer } from '#shared/utils/answer'
import { isTricky, nextReviewLabel } from '#shared/utils/learning'

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

function toggle(id: string) {
  open.value = open.value === id ? null : id
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
          <RienIcon name="plus" />
        </NuxtLink>
      </template>
    </PageHeader>

    <SqTextField v-model="search" label="Search words" clearable />
    <input ref="pictureInput" type="file" accept="image/*" hidden @change="pickPicture">

    <Squircle class="rien-segments" :radius="14" role="tablist" aria-label="Filter words">
      <Squircle
        v-for="option in (['all', 'due', 'tricky'] as const)"
        :key="option"
        tag="button"
        :radius="11"
        type="button"
        role="tab"
        class="rien-segment"
        :class="{ 'is-active': filter === option }"
        :aria-selected="filter === option"
        @click="filter = option"
      >
        {{ option === 'all' ? 'All' : option === 'due' ? 'Due' : 'Tricky' }} {{ counts[option] }}
      </Squircle>
    </Squircle>

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
      <li v-for="card in shown" :key="card.id">
        <button
          type="button"
          class="rien-list-row"
          :aria-expanded="open === card.id"
          @click="toggle(card.id)"
        >
          <span class="rien-list-text">
            <span class="rien-list-title">{{ card.answer }}</span>
            <span class="rien-list-sub">{{ card.meaning || card.khmer || card.example }}</span>
          </span>
          <span class="rien-list-end">
            <SqChip v-if="isTricky(card)" size="small" color="warning" text="Tricky" />
            <span class="rien-due-label">{{ nextReviewLabel(card.due, now) }}</span>
          </span>
        </button>
        <div v-if="open === card.id" class="rien-list-static rien-word-detail rien-rise">
          <Squircle v-if="card.image" :radius="18" :surface="false">
            <img :src="card.image" alt="" class="rien-word-image">
          </Squircle>
          <p v-if="card.example" class="rien-example">{{ card.example }}</p>
          <p v-if="card.khmer" class="rien-khmer">{{ card.khmer }}</p>
          <p class="rien-muted">
            File {{ card.file }} · reviewed {{ card.fsrs.reps }} {{ card.fsrs.reps === 1 ? 'time' : 'times' }}
            · forgotten {{ card.fsrs.lapses }} {{ card.fsrs.lapses === 1 ? 'time' : 'times' }}
          </p>
          <p v-if="isTricky(card)" class="rien-muted">
            Tip: say it aloud in your own sentence, or link it to a picture in your head.
          </p>
          <div class="rien-row">
            <SqBtn v-if="canSpeak" variant="tonal" @click="speak(card.answer)">Hear it</SqBtn>
            <SqBtn variant="tonal" @click="choosePicture(card.id)">{{ card.image ? 'Change picture' : 'Add picture' }}</SqBtn>
            <SqBtn v-if="card.image" variant="text" @click="db.setCardImage(card.id, undefined)">Remove picture</SqBtn>
            <SqBtn variant="text" color="error" @click="remove(card)">Delete</SqBtn>
          </div>
        </div>
      </li>
    </ul></Squircle>
  </div>
</template>
