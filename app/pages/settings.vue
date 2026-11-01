<script setup lang="ts">
import { BOOK_LABELS, BOOKS, FILE_NUMBERS, type Settings } from '#shared/schemas/db'

const db = useDb()
const { $pwa } = useNuxtApp()
const native = isNativeApp()

const bookItems = BOOKS.map(value => ({ title: BOOK_LABELS[value], value }))
const fileItems = FILE_NUMBERS.map(value => ({ title: `File ${value}`, value }))
const weeklyGoalItems = [3, 4, 5, 6, 7].map(value => ({ title: `${value} days a week`, value }))
const roundSizeItems = [10, 15, 20, 30].map(value => ({ title: `${value} words`, value }))
const newPerDayItems = [5, 10, 15, 20].map(value => ({ title: `${value} new words a day`, value }))
const reminderTimes = Array.from({ length: 34 }, (_, i) => {
  const hour = 6 + Math.floor(i / 2)
  const minute = (i % 2) * 30
  return { title: `${hour}:${String(minute).padStart(2, '0')}`, value: hour * 60 + minute }
})

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

async function updateReminder(patch: Partial<Settings['reminder']>) {
  const reminder = { ...settings.value!.reminder, ...patch }
  const allowed = await applyReminder(reminder)
  if (!allowed && reminder.enabled) {
    message.value = { type: 'error', text: 'Allow notifications for Rien in the iPhone Settings app first.' }
    return
  }
  await update({ reminder })
}

async function exportBackup() {
  const backup = await db.exportAll()
  try {
    await saveBackupFile(`rien-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
    message.value = { type: 'success', text: `Backup saved with ${backup.cards.length} words.` }
  }
  catch (error) {
    // Closing the share sheet without choosing is not a failure worth reporting.
    if (!String(error).includes('cancel')) message.value = { type: 'error', text: 'Could not save the backup.' }
  }
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
    <PageHeader title="Settings" />

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
        <SqSelect
          :model-value="settings.weeklyGoal"
          :items="weeklyGoalItems"
          label="Weekly goal"
          @update:model-value="update({ weeklyGoal: $event })"
        />
        <SqSelect
          :model-value="settings.dailyGoal"
          :items="roundSizeItems"
          label="Words per Word Recall round"
          @update:model-value="update({ dailyGoal: $event })"
        />
        <SqSelect
          :model-value="settings.newPerDay"
          :items="newPerDayItems"
          label="New words"
          hint="Reviews are never limited. Fewer new words keeps daily reviews short."
          persistent-hint
          @update:model-value="update({ newPerDay: $event })"
        />
        <SqSwitch
          :model-value="settings.khmerHints"
          label="Show Khmer hints in Word Recall"
          color="primary"
          @update:model-value="update({ khmerHints: $event })"
        />
      </SqCardText>
    </SqCard>

    <SqCard v-if="settings" title="Look & feel">
      <SqCardText class="rien-stack">
        <div class="rien-stack rien-gap-sm">
          <p class="rien-muted">Appearance</p>
          <Squircle class="rien-segments" :radius="14" role="radiogroup" aria-label="Appearance">
            <Squircle
              v-for="option in (['system', 'light', 'dark'] as const)"
              :key="option"
              tag="button"
              :radius="11"
              type="button"
              role="radio"
              class="rien-segment"
              :class="{ 'is-active': settings.appearance === option }"
              :aria-checked="settings.appearance === option"
              @click="update({ appearance: option })"
            >
              {{ option === 'system' ? 'Automatic' : option === 'light' ? 'Light' : 'Dark' }}
            </Squircle>
          </Squircle>
        </div>
        <SqSwitch
          :model-value="settings.liquidGlass"
          label="Liquid Glass"
          color="primary"
          @update:model-value="update({ liquidGlass: $event })"
        />
        <SqSwitch
          :model-value="settings.motion"
          label="Animation and motion"
          color="primary"
          @update:model-value="update({ motion: $event })"
        />
        <p class="rien-muted">Motion also stays off when Reduce Motion is on in the iPhone's settings.</p>
      </SqCardText>
    </SqCard>

    <SqCard v-if="native && settings" title="Say It">
      <SqCardText class="rien-stack">
        <SqSwitch
          :model-value="settings.speechOnline"
          label="Use Apple’s online speech recognition"
          color="primary"
          @update:model-value="update({ speechOnline: $event })"
        />
        <p class="rien-muted">
          Usually hears endings more accurately when you are online. Your recordings are then
          processed by Apple. Off keeps everything on this phone and works offline.
        </p>
      </SqCardText>
    </SqCard>

    <SqCard v-if="native && settings" title="Daily reminder">
      <SqCardText class="rien-stack">
        <SqSwitch
          :model-value="settings.reminder.enabled"
          label="Remind me to study every day"
          color="primary"
          @update:model-value="updateReminder({ enabled: $event })"
        />
        <SqSelect
          v-if="settings.reminder.enabled"
          :model-value="settings.reminder.hour * 60 + settings.reminder.minute"
          :items="reminderTimes"
          label="Time"
          @update:model-value="updateReminder({ hour: Math.floor($event / 60), minute: $event % 60 })"
        />
      </SqCardText>
    </SqCard>

    <SqCard title="Backup" subtitle="Your words live only on this phone">
      <SqCardText v-if="native">
        Save a backup to Files every week or two. Moving from the Home Screen web app?
        Save a backup there first, then tap Restore here and choose that file.
      </SqCardText>
      <SqCardText v-else>
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

    <SqCard v-if="!native" title="This phone" variant="outlined">
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
    <p class="rien-muted rien-credits">
      Icons: Solar by 480 Design, CC BY 4.0. Fish drawn for Rien.
    </p>
  </div>
</template>
