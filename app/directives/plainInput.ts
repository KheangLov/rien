import type { Directive } from 'vue'

// Turns off autocorrect, auto-capitalisation and spellcheck on the <input> inside
// a component. iPhone autocorrect would otherwise quietly fix a dropped "-s" or "-ed".
// SqTextField does not forward these attributes yet, so this sets them directly.
export const vPlainInput: Directive<HTMLElement> = {
  mounted(el) {
    const input = el instanceof HTMLInputElement ? el : el.querySelector('input')
    if (!input) return
    input.setAttribute('autocorrect', 'off')
    input.setAttribute('autocapitalize', 'none')
    input.setAttribute('spellcheck', 'false')
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('enterkeyhint', 'done')
  },
}
