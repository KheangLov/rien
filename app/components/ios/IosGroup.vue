<script setup lang="ts">
// An inset grouped list, as in the iOS Settings app: an optional header above,
// rows in one squircle card, and an optional footer note below.
defineProps<{ header?: string, footer?: string }>()
</script>

<template>
  <section class="ios-group">
    <h2 v-if="header" class="rien-section-title">{{ header }}</h2>
    <Squircle class="rien-list" :radius="22">
      <ul class="rien-list-items">
        <slot />
      </ul>
    </Squircle>
    <p v-if="footer" class="ios-group-footer">{{ footer }}</p>
  </section>
</template>
