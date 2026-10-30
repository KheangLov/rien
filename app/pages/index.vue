<script setup lang="ts">
const { $pwa } = useNuxtApp()

const online = ref(true)
const standalone = ref(false)

function refreshStatus() {
  online.value = navigator.onLine
  standalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

onMounted(() => {
  refreshStatus()
  window.addEventListener('online', refreshStatus)
  window.addEventListener('offline', refreshStatus)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', refreshStatus)
  window.removeEventListener('offline', refreshStatus)
})
</script>

<template>
  <main class="rien-page">
    <SqCard variant="tonal">
      <SqCardTitle>Rien · <span class="rien-khmer">រៀន</span></SqCardTitle>
      <SqCardText>
        Daily English practice, ten to fifteen minutes at a time. The games arrive in week 1.
      </SqCardText>
    </SqCard>

    <SqCard title="Day 1 checks" variant="outlined">
      <SqCardText>
        <div class="rien-row">
          <SqChip :color="online ? 'success' : 'warning'" :text="online ? 'Online' : 'Offline'" />
          <SqChip :color="standalone ? 'success' : 'info'" :text="standalone ? 'Opened from Home Screen' : 'Opened in browser'" />
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

    <SqAlert v-if="!standalone" type="info" variant="tonal">
      On iPhone: tap Share, then “Add to Home Screen”. Open it once online, then turn on Airplane Mode and open it again.
    </SqAlert>
  </main>
</template>
