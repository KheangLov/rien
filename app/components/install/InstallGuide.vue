<script setup lang="ts">
import type { IconName } from '~/components/RienIcon.vue'

// How to install Rien in this browser, when it has no one-tap install prompt
// to offer (always the case on iPhone and iPad). Opened by useInstall().install().
const { guideOpen, platform, secure } = useInstall()

// Each step is text with bold parts written as **…**.
const parts = (text: string) => text.split(/\*\*(.+?)\*\*/).map((part, i) => ({ part, bold: i % 2 === 1 }))

const STEPS: Record<'ios' | 'android' | 'desktop', { icon: IconName, text: string }[]> = {
  ios: [
    { icon: 'share', text: 'Tap **Share** in Safari\'s toolbar (in Chrome, it is at the top).' },
    { icon: 'plus', text: 'Scroll down and tap **Add to Home Screen**.' },
    { icon: 'check', text: 'Tap **Add**, then open Rien from its new icon.' },
  ],
  android: [
    { icon: 'menu', text: 'Open the browser menu: **⋮** in Chrome, **≡** in Samsung Internet.' },
    { icon: 'install', text: 'Tap **Install app** or **Add to Home screen** (Samsung: **Add page to** → **Home screen**).' },
    { icon: 'check', text: 'Tap **Install**, then open Rien from its new icon.' },
  ],
  desktop: [
    { icon: 'install', text: 'Click the **install** icon at the right end of the address bar.' },
    { icon: 'menu', text: 'Or open the browser menu **⋮** → **Cast, save and share** → **Install page as app**.' },
    { icon: 'check', text: 'Click **Install**. Rien opens in its own window.' },
  ],
}
</script>

<template>
  <IosSheet :open="guideOpen" title="Install Rien" @close="guideOpen = false">
    <p v-if="!secure" class="rien-install-note">
      This page is open from a local network address, and browsers only install
      apps from a secure (https) address. Open Rien's https address to install it.
    </p>
    <ol class="rien-install-steps">
      <li v-for="(step, i) in STEPS[platform]" :key="i">
        <span class="rien-install-step-icon"><RienIcon :name="step.icon" :size="22" weight="bold" /></span>
        <span><component :is="bold ? 'b' : 'span'" v-for="({ part, bold }, j) in parts(step.text)" :key="j">{{ part }}</component></span>
      </li>
    </ol>
    <p class="rien-muted rien-install-after">Installed, Rien opens full screen and works offline.</p>
    <SqBtn color="primary" size="large" block @click="guideOpen = false">Got it</SqBtn>
  </IosSheet>
</template>
