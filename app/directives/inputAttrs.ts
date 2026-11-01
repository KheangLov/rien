import type { Directive } from 'vue'

// Sets attributes on the <input> inside a component (SqTextField does not
// forward them yet; Squirkle upstream issue 2), e.g. an accessible name for a
// field shown without a visible label, or the keyboard's "search" key.
export const vInputAttrs: Directive<HTMLElement, Record<string, string>> = {
  mounted(el, binding) {
    const input = el instanceof HTMLInputElement ? el : el.querySelector('input')
    if (!input) return
    for (const [name, value] of Object.entries(binding.value)) input.setAttribute(name, value)
  },
}
