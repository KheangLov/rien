<script setup lang="ts">
import { BOOK_LABELS, BOOKS, FILE_NUMBERS, type Settings } from '#shared/schemas/db'

const db = useDb()
const { $pwa } = useNuxtApp()
const native = isNativeApp()

const bookItems = BOOKS.map(value => ({ title: BOOK_LABELS[value].replace('English File ', ''), value }))
const fileItems = FILE_NUMBERS.map(value => ({ title: `File ${value}`, value }))
const weeklyGoalItems = [3, 4, 5, 6, 7].map(value => ({ title: `${value} days a week`, value }))
const roundSizeItems = [10, 15, 20, 30].map(value => ({ title: `${value} words`, value }))
const newPerDayItems = [5, 10, 15, 20].map(value => ({ title: `${value}`, value }))
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

    <template v-if="settings">
      <IosGroup header="Class" footer="ACE Level 6 is most likely Files 9 to 12. Ask the teacher which File the class is on.">
        <IosPicker label="Book" icon="words" :model-value="settings.book" :options="bookItems" @update:model-value="update({ book: $event })" />
        <IosPicker label="File" icon="word-recall" :model-value="settings.file" :options="fileItems" @update:model-value="update({ file: $event })" />
      </IosGroup>

      <IosGroup header="Daily practice" footer="Reviews are never limited. Fewer new words a day keeps reviews short.">
        <IosPicker label="Weekly goal" icon="goal" :model-value="settings.weeklyGoal" :options="weeklyGoalItems" @update:model-value="update({ weeklyGoal: $event })" />
        <IosPicker label="Words per round" icon="calendar" :model-value="settings.dailyGoal" :options="roundSizeItems" @update:model-value="update({ dailyGoal: $event })" />
        <IosPicker label="New words a day" icon="plus" :model-value="settings.newPerDay" :options="newPerDayItems" @update:model-value="update({ newPerDay: $event })" />
        <IosRow label="Khmer hints" icon="translate" @click="update({ khmerHints: !settings.khmerHints })">
          <template #end>
            <IosSwitch :model-value="settings.khmerHints" label="Khmer hints" @update:model-value="update({ khmerHints: $event })" />
          </template>
        </IosRow>
      </IosGroup>

      <IosGroup header="Look & feel" footer="Motion also stays off when Reduce Motion is on in the iPhone's settings.">
        <li class="ios-control-row">
          <IosSegmented
            :model-value="settings.appearance"
            :options="[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]"
            label="Appearance"
            @update:model-value="update({ appearance: $event })"
          />
        </li>
        <IosRow label="Liquid Glass" icon="sparkles" @click="update({ liquidGlass: !settings.liquidGlass })">
          <template #end>
            <IosSwitch :model-value="settings.liquidGlass" label="Liquid Glass" @update:model-value="update({ liquidGlass: $event })" />
          </template>
        </IosRow>
        <IosRow label="Animation and motion" icon="play" @click="update({ motion: !settings.motion })">
          <template #end>
            <IosSwitch :model-value="settings.motion" label="Animation and motion" @update:model-value="update({ motion: $event })" />
          </template>
        </IosRow>
      </IosGroup>

      <IosGroup v-if="native" header="Say It" footer="Online recognition usually hears endings better; your recordings are then processed by Apple. Off keeps everything on this phone.">
        <IosRow label="Online speech recognition" icon="say-it" @click="update({ speechOnline: !settings.speechOnline })">
          <template #end>
            <IosSwitch :model-value="settings.speechOnline" label="Online speech recognition" @update:model-value="update({ speechOnline: $event })" />
          </template>
        </IosRow>
      </IosGroup>

      <IosGroup v-if="native" header="Daily reminder">
        <IosRow label="Remind me every day" icon="bell" @click="updateReminder({ enabled: !settings.reminder.enabled })">
          <template #end>
            <IosSwitch :model-value="settings.reminder.enabled" label="Daily reminder" @update:model-value="updateReminder({ enabled: $event })" />
          </template>
        </IosRow>
        <IosPicker
          v-if="settings.reminder.enabled"
          label="Time"
          icon="calendar"
          :model-value="settings.reminder.hour * 60 + settings.reminder.minute"
          :options="reminderTimes"
          @update:model-value="updateReminder({ hour: Math.floor($event / 60), minute: $event % 60 })"
        />
      </IosGroup>
    </template>

    <IosGroup
      header="Backup"
      :footer="native
        ? 'Your words live only on this phone. Save a backup to Files every week or two. Moving from the web app? Save a backup there, then Restore here.'
        : 'Your words live only on this device; clearing Safari website data deletes them. Save a backup every week or two.'"
    >
      <IosRow label="Save backup" icon="download" tint="primary" @click="exportBackup" />
      <IosRow label="Restore from a backup" icon="upload" tint="primary" @click="fileInput?.click()" />
    </IosGroup>
    <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importBackup">

    <SqAlert v-if="message" :type="message.type" variant="tonal" :text="message.text" class="rien-pop" />

    <IosGroup v-if="!native" header="This device">
      <IosRow label="Connection" icon="phone" :value="online ? 'Online' : 'Offline'" />
      <IosRow label="Opened from" icon="today" :value="standalone ? 'Home Screen' : 'Browser'" />
      <IosRow label="Offline copy" icon="download" :value="$pwa?.offlineReady ? 'Ready' : 'Preparing'" />
      <IosRow v-if="$pwa?.showInstallPrompt" label="Install Rien" icon="plus" tint="primary" @click="$pwa.install()" />
      <IosRow label="Speech test" icon="say-it" to="/speech-test" />
    </IosGroup>

    <p class="rien-muted rien-credits">
      Icons: Solar by 480 Design, CC BY 4.0. Fish drawn for Rien.
    </p>
  </div>
</template>
