import { contrastRatio, createBrandTheme } from '@squirkle-ui/core'
import type { Settings } from '#shared/schemas/db'

export type Accent = Settings['accent']

// The main colours she can pick in Settings. Teal is Rien's own and comes from
// nuxt.config.ts; the others are made readable on light and dark surfaces by
// Squirkle's createBrandTheme.
export const ACCENTS: { id: Accent, name: string, color: string }[] = [
  { id: 'teal', name: 'Teal', color: '#0f766e' },
  { id: 'blue', name: 'Blue', color: '#1d4ed8' },
  { id: 'indigo', name: 'Indigo', color: '#4f46e5' },
  { id: 'violet', name: 'Violet', color: '#7c3aed' },
  { id: 'pink', name: 'Pink', color: '#db2777' },
  { id: 'red', name: 'Red', color: '#dc2626' },
  { id: 'orange', name: 'Orange', color: '#ea580c' },
  { id: 'green', name: 'Green', color: '#16a34a' },
]

const onColor = (background: string) =>
  contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000'

// CSS that sets the main colour for both themes. The selectors outrank
// Squirkle's own .sq-theme--light/.sq-theme--dark, which sit on <html> and on
// the app's root, so one rule recolours everything that uses --sq-primary.
export function accentCss(accent: Accent): string {
  const choice = ACCENTS.find(a => a.id === accent)
  if (!choice || accent === 'teal') return ''
  const { light, dark } = createBrandTheme(choice.color)
  const vars = (primary: string) => `--sq-primary:${primary};--sq-on-primary:${onColor(primary)};`
  return `:root.sq-theme--light,:root .sq-theme--light{${vars(light?.colors.primary ?? choice.color)}}`
    + `:root.sq-theme--dark,:root .sq-theme--dark{${vars(dark?.colors.primary ?? choice.color)}}`
}
