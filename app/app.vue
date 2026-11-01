<script setup lang="ts">
const { $pwa } = useNuxtApp()
const native = isNativeApp()
const route = useRoute()

// The four tab pages show the tab bar; games and sub-pages are full screen.
const TABS = ['/', '/words', '/tank', '/progress', '/settings']
const hasTabs = computed(() => TABS.includes(route.path.replace(/\/$/, '') || '/'))

// News from the tank, one at a time, each for a few seconds.
const toasts = useToasts()
const current = computed(() => toasts.value[0])
let timer: ReturnType<typeof setTimeout> | undefined
watch(current, (text) => {
  clearTimeout(timer)
  if (!text) return
  haptic('success')
  timer = setTimeout(() => toasts.value.shift(), 4200)
})
function openTank() {
  toasts.value.splice(0)
  navigateTo('/tank')
}
</script>

<template>
  <SqApp class="rien-shell" :class="{ 'has-tabs': hasTabs }">
    <SqMain>
      <NuxtPage />
    </SqMain>
    <TabBar v-if="hasTabs" />
    <Transition name="rien-toast">
      <Squircle v-if="current" :key="current" tag="button" :surface="false" :radius="22" type="button" class="rien-toast" role="status" @click="openTank">
        <RienIcon name="fish" :size="26" weight="duotone" />
        <span>{{ current }}</span>
      </Squircle>
    </Transition>
    <InstallGuide v-if="!native" />
    <SqSnackbar
      v-if="$pwa?.needRefresh"
      :model-value="true"
      text="A new version of Rien is ready."
    >
      <template #actions>
        <SqBtn variant="text" color="primary" @click="$pwa.updateServiceWorker()">Reload</SqBtn>
      </template>
    </SqSnackbar>
  </SqApp>
</template>
