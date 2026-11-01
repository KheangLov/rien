<script setup lang="ts">
// A tab's large title, which collapses into a small centred title in a
// frosted bar once it scrolls away (as in iOS); or, for a sub-page, a small
// bar with a back button.
defineProps<{ title: string, subtitle?: string, back?: string }>()

const large = ref<HTMLElement | null>(null)
const compact = ref(false)
let observer: IntersectionObserver | undefined

onMounted(() => {
  if (!large.value) return
  observer = new IntersectionObserver(([entry]) => {
    compact.value = !entry!.isIntersecting
  }, { rootMargin: '-44px 0px 0px 0px' })
  observer.observe(large.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <header v-if="back" class="rien-subbar">
    <NuxtLink :to="back" class="rien-subbar-back" aria-label="Back">
      <RienIcon name="back" :size="26" weight="bold" />
    </NuxtLink>
    <h1 class="rien-subbar-title">{{ title }}</h1>
    <div class="rien-subbar-end"><slot name="action" /></div>
  </header>
  <template v-else>
    <Teleport to="body">
      <Transition name="ios-navbar">
        <div v-if="compact" class="ios-navbar" aria-hidden="true">
          <h2>{{ title }}</h2>
        </div>
      </Transition>
    </Teleport>
    <header class="rien-largetitle">
      <div>
        <p v-if="subtitle" class="rien-largetitle-sub">{{ subtitle }}</p>
        <h1 ref="large">{{ title }}</h1>
      </div>
      <slot name="action" />
    </header>
  </template>
</template>
