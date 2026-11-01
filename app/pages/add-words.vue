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
  image: undefined as string | undefined,
  book: 'english-file-pre-intermediate-4e' as Book,
  file: 9,
})
const pictureInput = ref<HTMLInputElement | null>(null)

// A photo or picture for the word (camera or library on iPhone), kept small.
async function pickPicture(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    form.image = await shrinkImage(file)
    haptic('tap')
  }
  catch {
    errors.image = 'That picture could not be opened. Try another one.'
  }
}
const errors = reactive<Record<string, string>>({})
const saving = ref(false)
const saved = ref('')
const answerField = ref<{ focus?: () => void } | null>(null)


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
    const card = await withTankNews(() => db.addWord(parsed.data))
    // Remember the book and File for the next word and the next class.
    await db.saveSettings({ book: form.book, file: form.file })
    saved.value = `Saved “${card.answer}”`
    Object.assign(form, { answer: '', meaning: '', khmer: '', example: '', image: undefined })
    answerField.value?.focus?.()
  }
  catch (error) {
    errors.answer = error instanceof DuplicateWordError ? error.message : 'Could not save. Try again.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="rien-page">
    <PageHeader title="Add a word" back="/words" />

    <SqCard subtitle="Right after class, while you remember it">
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
          <div class="rien-picture-picker">
            <Squircle v-if="form.image" :radius="16" :surface="false" class="rien-picture-thumb">
              <img :src="form.image" alt="Picture for this word" class="rien-picture-thumb">
            </Squircle>
            <SqBtn variant="tonal" @click="pictureInput?.click()">
              <RienIcon name="camera" :size="20" weight="duotone" />&nbsp;{{ form.image ? 'Change picture' : 'Add a picture' }}
            </SqBtn>
            <SqBtn v-if="form.image" variant="text" @click="form.image = undefined">Remove</SqBtn>
            <input ref="pictureInput" type="file" accept="image/*" hidden @change="pickPicture">
          </div>
          <p v-if="errors.image" class="rien-muted">{{ errors.image }}</p>
          <p v-else class="rien-muted">A picture of the meaning helps the word stick.</p>
          <div class="rien-row">
            <SqSelect v-model="form.book" :items="bookItems" label="Book" style="flex: 2 1 200px" />
            <SqSelect v-model="form.file" :items="fileItems" label="File" style="flex: 1 1 100px" />
          </div>
          <SqBtn type="submit" color="primary" size="large" :loading="saving">Save word</SqBtn>
        </form>
      </SqCardText>
    </SqCard>

    <SqAlert v-if="saved" type="success" variant="tonal" :text="saved" />

  </div>
</template>
