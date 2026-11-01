<script setup lang="ts">
import { backupAgeLabel, backupReminderDue } from '#shared/utils/backups'

// Web app only: a reminder on Today to save a backup file, once she has a few
// words and her last backup is two weeks old (shared/utils/backups.ts). The
// Rien app keeps its own copies, so it never needs this. "Later" waits 3 days.
const SNOOZE_KEY = 'rien-backup-snoozed'
const SNOOZE_MS = 3 * 86_400_000

const db = useDb()
const now = useClock()
const settings = useLiveQuery(() => db.getSettings(), null)
const words = useLiveQuery(() => db.countCards(), 0)
const snoozedAt = ref(0)
const saving = ref(false)
const saved = ref(false)

onMounted(() => {
  try {
    snoozedAt.value = Number(localStorage.getItem(SNOOZE_KEY)) || 0
  }
  catch {}
})

const show = computed(() => !isNativeApp()
  && settings.value !== null
  && (saved.value || (backupReminderDue(settings.value.lastBackupAt, words.value, now.value) && now.value.getTime() - snoozedAt.value > SNOOZE_MS)))
const age = computed(() => backupAgeLabel(settings.value?.lastBackupAt, now.value).toLowerCase())

async function save() {
  saving.value = true
  try {
    await exportBackup()
    saved.value = true
    haptic('success')
  }
  catch (error) {
    console.error('[rien] backup failed', error)
  }
  finally {
    saving.value = false
  }
}

function later() {
  snoozedAt.value = Date.now()
  try {
    localStorage.setItem(SNOOZE_KEY, String(snoozedAt.value))
  }
  catch {}
}
</script>

<template>
  <SqCard v-if="show" variant="outlined" class="rien-backup-card">
    <SqCardText class="rien-install">
      <span class="rien-backup-icon"><RienIcon :name="saved ? 'check' : 'download'" :size="26" weight="bold" /></span>
      <div>
        <strong>{{ saved ? 'Backup saved' : 'Keep your words safe' }}</strong>
        <p class="rien-muted">
          {{ saved
            ? 'Keep the file somewhere safe, like Google Drive. Restore it from Settings if you ever need to.'
            : `${words} words live only in this browser. Last backup: ${age}.` }}
        </p>
      </div>
    </SqCardText>
    <SqCardActions v-if="!saved">
      <SqBtn variant="text" @click="later">Later</SqBtn>
      <SqBtn color="primary" :loading="saving" @click="save">Save backup</SqBtn>
    </SqCardActions>
  </SqCard>
</template>
