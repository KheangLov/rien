<script setup lang="ts">
// A squircle the way Squirkle UI draws them: native `corner-shape: squircle`
// where supported, otherwise an SVG squircle from SqShape. `clip` clips the
// element to the shape, so a glass blur follows the curve.
// surface (default): painted from --sq-bg / --sq-bd / --sq-bw like Squirkle's
// own surfaces. surface=false: shape and clip only, so the element's own
// background (a gradient) is kept.
withDefaults(defineProps<{ tag?: string, radius?: number, clip?: boolean, surface?: boolean }>(), {
  tag: 'div',
  radius: 24,
  clip: true,
  surface: true,
})
</script>

<template>
  <component
    :is="tag"
    class="rien-sq"
    :class="{ 'sq-surface': surface }"
    :style="{ '--sq-r': `${radius}px` }"
  >
    <SqShape :clip="clip" />
    <slot />
  </component>
</template>
