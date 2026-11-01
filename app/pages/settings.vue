<script setup lang="ts">
import { BOOK_LABELS, BOOKS, FILE_NUMBERS, type Settings } from '#shared/schemas/db'
import { backupAgeLabel } from '#shared/utils/backups'
import { FILES_IN_BOOK } from '#shared/utils/levelUp'

const db = useDb()
const { $pwa } = useNuxtApp()
const native = isNativeApp()
const android = native && usesNativeReader()

const bookItems = BOOKS.map(value => ({ title: BOOK_LABELS[value].replace('English File ', ''), value }))
// Only the Files her book has (Pre-Intermediate 12, the others 10).
const fileItems = computed(() => FILE_NUMBERS
  .filter(value => value <= FILES_IN_BOOK[settings.value?.book ?? BOOKS[0]])
  .map(value => ({ title: `File ${value}`, value })))
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
// The offline copy is ready once a service worker controls the page.
// $pwa.offlineReady is only set on the visit that first installs it.
const offline = ref(false)
const { canInstall, install } = useInstall()

function refreshStatus() {
  online.value = navigator.onLine
  standalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

onMounted(async () => {
  settings.value = await db.getSettings()
  refreshStatus()
  void navigator.serviceWorker?.ready.then(() => { offline.value = true })
  window.addEventListener('online', refreshStatus)
  window.addEventListener('offline', refreshStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', refreshStatus)
  window.removeEventListener('offline', refreshStatus)
})

const { $setAppearance } = useNuxtApp()

// Android swaps launcher entries to change the icon, which on some phones
// (Samsung's too) takes the icon off the home screen: say so before turning it on.
function toggleIconColour(on: boolean) {
  const warning = native
    ? 'Rien\'s icon will change to this colour when you leave the app. On some phones it then disappears from the home screen (it stays in the app list) and needs adding back. Turn it on?'
    : 'Rien\'s home-screen icon will change to this colour. Android asks you first, the next time you open Rien from the home screen. On iPhone, the icon is set when you add Rien to the home screen. Turn it on?'
  if (on && !window.confirm(warning)) return
  void update({ iconFollowsColour: on })
}

// The screen changes as soon as she taps, then the setting is saved: waiting
// for the database (a round trip on the phone) made every switch feel slow.
async function update(patch: Partial<Settings>) {
  if (!settings.value) return
  settings.value = { ...settings.value, ...patch }
  if ('appearance' in patch || 'liquidGlass' in patch || 'motion' in patch || 'accent' in patch || 'iconFollowsColour' in patch) $setAppearance(settings.value)
  settings.value = await db.saveSettings(patch)
}

async function updateReminder(patch: Partial<Settings['reminder']>) {
  const reminder = { ...settings.value!.reminder, ...patch }
  const allowed = await applyReminder(reminder)
  if (!allowed && reminder.enabled) {
    message.value = { type: 'error', text: 'Allow notifications for Rien in the phone\'s Settings app first.' }
    return
  }
  await update({ reminder })
}

const autoBackups = ref<{ name: string, date: Date }[]>([])
const autoOpen = ref(false)
const lastSaved = computed(() => backupAgeLabel(settings.value?.lastBackupAt, new Date()))
const lastAuto = computed(() => backupAgeLabel(settings.value?.lastAutoBackupAt, new Date()))

async function saveBackup() {
  try {
    const words = await exportBackup()
    settings.value = await db.getSettings()
    message.value = { type: 'success', text: `Backup saved with ${words} words.` }
  }
  catch (error) {
    // Closing the share sheet without choosing is not a failure worth reporting.
    if (!String(error).includes('cancel')) message.value = { type: 'error', text: 'Could not save the backup.' }
  }
}

async function openAutoBackups() {
  autoBackups.value = await listAutoBackups()
  autoOpen.value = true
}

async function copyNow() {
  try {
    await saveAutoBackup()
    autoBackups.value = await listAutoBackups()
    settings.value = await db.getSettings()
  }
  catch (error) {
    autoOpen.value = false
    message.value = { type: 'error', text: `Could not save a copy: ${String(error).slice(0, 120)}` }
  }
}

async function restoreAuto(name: string, date: Date) {
  if (!window.confirm(`Replace everything on this phone with the copy from ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}?`)) return
  autoOpen.value = false
  try {
    const cards = await restoreAutoBackup(name)
    settings.value = await db.getSettings()
    message.value = { type: 'success', text: `Restored ${cards} words.` }
  }
  catch {
    message.value = { type: 'error', text: 'Could not read that copy. Nothing was changed.' }
  }
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!window.confirm('Replace everything on this phone with this backup?')) return
  try {
    const { cards } = await db.importAll(await file.text())
    resetLearner()
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
        <IosPicker label="Book" icon="words" :model-value="settings.book" :options="bookItems" @update:model-value="update({ book: $event, file: Math.min(settings.file, FILES_IN_BOOK[$event as Settings['book']]) })" />
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

      <IosGroup header="Look & feel" footer="Motion also stays off when the phone's settings ask for less motion (Reduce Motion on iPhone, Remove animations on Android).">
        <li class="ios-control-row">
          <IosSegmented
            :model-value="settings.appearance"
            :options="[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]"
            label="Appearance"
            @update:model-value="update({ appearance: $event })"
          />
        </li>
        <li class="ios-control-row rien-accents" role="radiogroup" aria-label="Main colour">
          <span class="rien-accents-label">Colour</span>
          <div class="rien-accents-swatches">
            <button
              v-for="accent in ACCENTS"
              :key="accent.id"
              type="button"
              role="radio"
              class="rien-accent"
              :class="{ 'is-on': settings.accent === accent.id }"
              :style="{ '--swatch': accent.color }"
              :aria-checked="settings.accent === accent.id"
              :aria-label="accent.name"
              @click="update({ accent: accent.id })"
            >
              <RienIcon v-if="settings.accent === accent.id" name="check" :size="16" weight="bold" />
            </button>
          </div>
        </li>
        <IosRow v-if="android || !native" label="Icon in my colour" icon="install" @click="toggleIconColour(!settings.iconFollowsColour)">
          <template #end>
            <IosSwitch :model-value="settings.iconFollowsColour" label="Icon in my colour" @update:model-value="toggleIconColour($event)" />
          </template>
        </IosRow>
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

      <IosGroup v-if="native" header="Say It" :footer="`Online recognition usually hears endings better; your voice is then processed by ${android ? 'Google' : 'Apple'}. Off keeps everything on this phone where it can.`">
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
        ? 'Rien keeps a copy every week (the last four), and your phone\'s own backup to Google or iCloud includes them. For a copy you hold yourself, Save backup to Files. Moving from the web app? Save a backup there, then Restore here.'
        : 'Your words live only in this browser; clearing its website data deletes them. Rien reminds you on Today when it is time to save a backup.'"
    >
      <IosRow label="Save backup" icon="download" tint="primary" :value="settings ? lastSaved : undefined" @click="saveBackup" />
      <IosRow v-if="native" label="Auto backup" icon="calendar" :value="settings ? lastAuto : undefined" chevron @click="openAutoBackups" />
      <IosRow label="Restore from a file" icon="upload" tint="primary" @click="fileInput?.click()" />
    </IosGroup>

    <IosSheet :open="autoOpen" title="Automatic backups" @close="autoOpen = false">
      <p class="rien-muted">Rien keeps a copy of everything every week. Tap one to go back to it; everything on this phone is replaced.</p>
      <IosGroup v-if="autoBackups.length">
        <IosRow
          v-for="copy in autoBackups"
          :key="copy.name"
          :label="copy.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })"
          icon="calendar"
          chevron
          @click="restoreAuto(copy.name, copy.date)"
        />
      </IosGroup>
      <p v-else class="rien-muted">No copy yet. The first one is saved a few seconds after Rien opens, once you have words or a day of study.</p>
      <SqBtn variant="tonal" block class="rien-copy-now" @click="copyNow">Save a copy now</SqBtn>
    </IosSheet>
    <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importBackup">

    <SqAlert v-if="message" :type="message.type" variant="tonal" :text="message.text" class="rien-pop" />

    <IosGroup v-if="!native" header="This device">
      <IosRow label="Connection" icon="phone" :value="online ? 'Online' : 'Offline'" />
      <IosRow label="Opened from" icon="today" :value="standalone ? 'Home Screen' : 'Browser'" />
      <IosRow label="Offline copy" icon="download" :value="offline || $pwa?.offlineReady ? 'Ready' : 'Preparing'" />
      <IosRow v-if="canInstall" label="Install Rien" icon="install" tint="primary" @click="install" />
      <IosRow label="Speech test" icon="say-it" to="/speech-test" />
    </IosGroup>

    <p class="rien-muted rien-credits">
      Built with Squirkle UI.
    </p>
  </div>
</template>
