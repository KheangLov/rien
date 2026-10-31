<script setup lang="ts">
const { $pwa } = useNuxtApp()
const route = useRoute()

// The four tab pages show the tab bar; games and sub-pages are full screen.
const TABS = ['/', '/words', '/progress', '/settings']
const hasTabs = computed(() => TABS.includes(route.path.replace(/\/$/, '') || '/'))
</script>

<template>
  <SqApp class="rien-shell" :class="{ 'has-tabs': hasTabs }">
    <SqMain>
      <NuxtPage />
    </SqMain>
    <TabBar v-if="hasTabs" />
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
