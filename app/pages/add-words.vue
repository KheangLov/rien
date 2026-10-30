<script setup lang="ts">
import { BOOK_LABELS, BOOKS, FILE_NUMBERS, newWordSchema, type Book } from '#shared/schemas/db'
import { DuplicateWordError } from '~/data/repository'
import { vPlainInput } from '~/directives/plainInput'

const db = useDb()

const bookItems = BOOKS.map(value => ({ title: BOOK_LABELS[value], value }))
const fileItems = FILE_NUMBERS.map(value => ({ title: `File ${value}`, value }))

const form = reactive({
  answer: '',
  meaning: '',
  khmer: '',
  example: '',
  book: 'english-file-pre-intermediate-4e' as Book,
  file: 7,
})
const errors = reactive<Record<string, string>>({})
const saving = ref(false)
const saved = ref('')
const answerField = ref<{ focus?: () => void } | null>(null)

const recent = useLiveQuery(() => db.recentCards(20), [])

onMounted(async () => {
  const settings = await db.getSettings()
  form.book = settings.book
  form.file = settings.file
})

function clearErrors() {
  for (const key of Object.keys(errors)) delete errors[key]
}

async function save() {
  clearErrors()
  saved.value = ''
  const parsed = newWordSchema.safeParse(form)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
    return
  }

  saving.value = true
  try {
    const card = await db.addWord(parsed.data)
    // Remember the book and File for the next word and the next class.
    await db.saveSettings({ book: form.book, file: form.file })
    saved.value = `Saved “${card.answer}”`
    Object.assign(form, { answer: '', meaning: '', khmer: '', example: '' })
    answerField.value?.focus?.()
  }
  catch (error) {
    errors.answer = error instanceof DuplicateWordError ? error.message : 'Could not save. Try again.'
  }
  finally {
    saving.value = false
  }
}

async function remove(id: string, answer: string) {
  if (window.confirm(`Delete “${answer}” and its review history?`)) await db.deleteCard(id)
}
</script>

<template>
  <div class="rien-page">
    <div class="rien-row">
      <SqBtn to="/" variant="text">← Today</SqBtn>
    </div>

    <SqCard title="Add a word" subtitle="Right after class, while you remember it">
      <SqCardText>
        <form class="rien-stack" novalidate @submit.prevent="save">
          <SqTextField
            ref="answerField"
            v-model="form.answer"
            v-plain-input
            label="English word or phrase"
            placeholder="borrow"
            :error-messages="errors.answer"
          />
          <SqTextField
            v-model="form.meaning"
            label="Meaning in English"
            placeholder="to take something and give it back later"
            :error-messages="errors.meaning"
          />
          <SqTextField
            v-model="form.khmer"
            class="rien-khmer"
            label="Khmer hint (optional)"
          />
          <SqTextarea
            v-model="form.example"
            label="Example sentence from class (optional)"
            placeholder="Can I borrow your pen?"
            :rows="2"
            auto-grow
          />
          <div class="rien-row">
            <SqSelect v-model="form.book" :items="bookItems" label="Book" style="flex: 2 1 200px" />
            <SqSelect v-model="form.file" :items="fileItems" label="File" style="flex: 1 1 100px" />
          </div>
          <SqBtn type="submit" color="primary" size="large" :loading="saving">Save word</SqBtn>
        </form>
      </SqCardText>
    </SqCard>

    <SqAlert v-if="saved" type="success" variant="tonal" :text="saved" />

    <SqCard v-if="recent.length" title="Recently added" variant="outlined">
      <SqList>
        <SqListItem
          v-for="card in recent"
          :key="card.id"
          :title="card.answer"
          :subtitle="card.meaning || card.khmer || card.example"
        >
          <template #append>
            <SqBtn variant="text" size="small" @click="remove(card.id, card.answer)">
              Delete<span class="rien-sr-only"> {{ card.answer }}</span>
            </SqBtn>
          </template>
        </SqListItem>
      </SqList>
    </SqCard>
  </div>
</template>
