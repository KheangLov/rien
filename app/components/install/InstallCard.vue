<script setup lang="ts">
// On Today, until Rien is installed: one tap to put it on the home screen.
const { showCard, install, dismiss, ios, promptReady } = useInstall()
</script>

<template>
  <SqCard v-if="showCard" variant="outlined" class="rien-install-card">
    <SqCardText class="rien-install">
      <img src="/pwa-192.png" alt="" width="52" height="52" class="rien-install-logo">
      <div>
        <strong>Install Rien</strong>
        <p class="rien-muted">
          Opens full screen from your home screen and works offline, like an app.
        </p>
      </div>
    </SqCardText>
    <SqCardActions>
      <SqBtn variant="text" @click="dismiss">Not now</SqBtn>
      <SqBtn color="primary" @click="install">
        <RienIcon :name="ios && !promptReady ? 'share' : 'install'" :size="20" weight="bold" />
        {{ ios && !promptReady ? 'Show me how' : 'Install' }}
      </SqBtn>
    </SqCardActions>
  </SqCard>
</template>
