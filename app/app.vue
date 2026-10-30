<script setup lang="ts">
const { $pwa } = useNuxtApp()
</script>

<template>
  <SqApp class="rien-shell">
    <NuxtPage />
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
