<script setup lang="ts">
// iPhone and iPad: browsers there have no install button, so this shows the
// steps. Opened by useInstall().install().
const { guideOpen } = useInstall()
</script>

<template>
  <IosSheet :open="guideOpen" title="Install Rien" @close="guideOpen = false">
    <ol class="rien-install-steps">
      <li>
        <span class="rien-install-step-icon"><RienIcon name="share" :size="22" weight="bold" /></span>
        <span>Tap <b>Share</b> in Safari's toolbar (in Chrome, it is at the top).</span>
      </li>
      <li>
        <span class="rien-install-step-icon"><RienIcon name="plus" :size="22" weight="bold" /></span>
        <span>Scroll down and tap <b>Add to Home Screen</b>.</span>
      </li>
      <li>
        <span class="rien-install-step-icon"><RienIcon name="check" :size="22" weight="bold" /></span>
        <span>Tap <b>Add</b>. Open Rien from its new icon: it runs full screen and works offline.</span>
      </li>
    </ol>
    <SqBtn color="primary" size="large" block @click="guideOpen = false">Got it</SqBtn>
  </IosSheet>
</template>
