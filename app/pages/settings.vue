<script setup lang="ts">
import { BOOK_LABELS, BOOKS, FILE_NUMBERS, type Settings } from '#shared/schemas/db'

const db = useDb()
const { $pwa } = useNuxtApp()

const bookItems = BOOKS.map(value => ({ title: BOOK_LABELS[value], value }))
const fileItems = FILE_NUMBERS.map(value => ({ title: `File ${value}`, value }))

const settings = ref<Settings | null>(null)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const online = ref(true)
const standalone = ref(false)

function refreshStatus() {
  online.value = navigator.onLine
  standalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

onMounted(async () => {
  settings.value = await db.getSettings()
  refreshStatus()
  window.addEventListener('online', refreshStatus)
  window.addEventListener('offline', refreshStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', refreshStatus)
  window.removeEventListener('offline', refreshStatus)
})

async function update(patch: Partial<Settings>) {
  settings.value = await db.saveSettings(patch)
}

async function exportBackup() {
  const backup = await db.exportAll()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rien-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  message.value = { type: 'success', text: `Backup saved with ${backup.cards.length} words.` }
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!window.confirm('Replace everything on this phone with this backup?')) return
  try {
    const { cards } = await db.importAll(JSON.parse(await file.text()))
    settings.value = await db.getSettings()
    message.value = { type: 'success', text: `Restored ${cards} words.` }
  }
  catch {
    message.value = { type: 'error', text: 'That file is not a Rien backup. Nothing was changed.' }
  }
}
</script>

<template>
  <div class="rien-page">
    <div class="rien-row">
      <SqBtn to="/" variant="text">← Today</SqBtn>
    </div>

    <SqCard v-if="settings" title="Class">
      <SqCardText class="rien-stack">
        <SqSelect
          :model-value="settings.book"
          :items="bookItems"
          label="Current book"
          @update:model-value="update({ book: $event })"
        />
        <SqSelect
          :model-value="settings.file"
          :items="fileItems"
          label="Current File"
          @update:model-value="update({ file: $event })"
        />
        <SqSwitch
          :model-value="settings.khmerHints"
          label="Show Khmer hints in Word Recall"
          color="primary"
          @update:model-value="update({ khmerHints: $event })"
        />
      </SqCardText>
    </SqCard>

    <SqCard title="Backup" subtitle="Your words live only on this phone">
      <SqCardText>
        Clearing Safari's website data deletes them. Save a backup to Files every week or two.
      </SqCardText>
      <SqCardActions>
        <SqBtn color="primary" @click="exportBackup">Save backup</SqBtn>
        <SqBtn variant="tonal" @click="fileInput?.click()">Restore</SqBtn>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          hidden
          @change="importBackup"
        >
      </SqCardActions>
    </SqCard>

    <SqAlert v-if="message" :type="message.type" variant="tonal" :text="message.text" />

    <SqCard title="This phone" variant="outlined">
      <SqCardText>
        <div class="rien-row">
          <SqChip :color="online ? 'success' : 'warning'" :text="online ? 'Online' : 'Offline'" />
          <SqChip
            :color="standalone ? 'success' : 'info'"
            :text="standalone ? 'Opened from Home Screen' : 'Opened in browser'"
          />
          <SqChip
            :color="$pwa?.offlineReady ? 'success' : 'info'"
            :text="$pwa?.offlineReady ? 'Ready offline' : 'Preparing offline copy'"
          />
        </div>
      </SqCardText>
      <SqCardActions>
        <SqBtn v-if="$pwa?.showInstallPrompt" color="primary" @click="$pwa.install()">Install</SqBtn>
        <SqBtn to="/speech-test" variant="tonal">Speech test</SqBtn>
      </SqCardActions>
    </SqCard>
  </div>
</template>
