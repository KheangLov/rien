import { getSquirclePath, supportsNativeSquircle } from '@squirkle-ui/core'

// Squircle corners for Rien's own small surfaces (icon tiles, round buttons,
// pills, thumbnails, word tokens, calendar days), the same shape Squirkle UI
// gives its components. Each element keeps its radius in main.css; this turns
// that radius into a squircle:
// - Chrome and Android: native `corner-shape: squircle`, radius × (1 + smoothing),
//   exactly what Squirkle's .sq-surface does.
// - Safari and iPhone (no corner-shape yet): a clip path with the same shape,
//   redrawn whenever the element changes size, and a smaller border radius
//   underneath so the clip, not the radius, draws the corner.
// Elements come and go with every screen, so a MutationObserver finds new ones.
// Clipping also cuts off outer shadows and outlines, so these elements avoid them.
const SELECTOR = [
  '.rien-list-icon',
  '.rien-icon-btn',
  '.rien-add-btn',
  '.rien-celebrate-icon',
  '.rien-hero-btn',
  '.rien-hero-step',
  '.rien-session-step',
  '.rien-skip',
  '.rien-token',
  '.rien-built',
  '.rien-gap',
  '.rien-gap-result',
  '.rien-spoken-word',
  '.rien-chip-c',
  '.rien-box',
  '.rien-blocks > span',
  '.rien-rule',
  '.rien-egg',
  '.rien-fish-thumb',
  '.rien-fish-stage',
  '.rien-dot',
  '.rien-done-dot',
  '.rien-cal-nav',
  '.rien-cal-day',
].join(', ')

const SMOOTHING = 0.6
const MARK = 'rienSquircle'

export default defineNuxtPlugin(() => {
  const native = supportsNativeSquircle()
  // The radius each element had in CSS (before this plugin changed it).
  const radii = new WeakMap<HTMLElement, string>()

  // A radius in px, from "12px" or a percentage ("50%" or 999px pills: half the short side).
  function radiusOf(el: HTMLElement): number {
    const css = radii.get(el) ?? '0px'
    const short = Math.min(el.offsetWidth, el.offsetHeight)
    const px = css.endsWith('%') ? (parseFloat(css) / 100) * short : parseFloat(css)
    return Math.min(px || 0, short / 2)
  }

  const clip = (el: HTMLElement) => {
    const w = el.offsetWidth
    const h = el.offsetHeight
    if (!w || !h) return
    const r = radiusOf(el)
    const path = getSquirclePath({ width: w, height: h, radius: r, smoothing: SMOOTHING })
    el.style.clipPath = path ? `path('${path}')` : ''
    // The element's own rounding must sit outside the squircle, or its circle
    // corners show instead (a circle is narrower than a squircle of the same
    // size). Half the squircle's corner size always does.
    el.style.borderRadius = `${Math.min(r * (1 + SMOOTHING), Math.min(w, h) / 2) * 0.5}px`
  }

  const resized = new ResizeObserver((entries) => {
    for (const entry of entries) clip(entry.target as HTMLElement)
  })

  function shape(el: HTMLElement) {
    if (el.dataset[MARK] !== undefined) return
    const css = getComputedStyle(el)
    if (css.display === 'inline') return
    el.dataset[MARK] = ''
    radii.set(el, css.borderTopLeftRadius)
    if (native) {
      const r = css.borderTopLeftRadius
      // Percentages already describe a full superellipse; px radii grow like Squirkle's.
      el.style.borderRadius = r.endsWith('%') ? r : `${parseFloat(r) * (1 + SMOOTHING)}px`
      el.style.setProperty('corner-shape', 'squircle')
      return
    }
    clip(el)
    resized.observe(el)
  }

  function scan(root: ParentNode) {
    if (root instanceof HTMLElement && root.matches(SELECTOR)) shape(root)
    root.querySelectorAll<HTMLElement>(SELECTOR).forEach(shape)
  }

  // Classes can be added later (a calendar day becoming "today"), and nodes leave;
  // the ResizeObserver lets go of removed elements by itself.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        if (m.target instanceof HTMLElement && m.target.matches(SELECTOR)) shape(m.target)
        continue
      }
      m.addedNodes.forEach((node) => { if (node instanceof HTMLElement) scan(node) })
    }
  })

  const start = () => {
    scan(document.body)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
})
