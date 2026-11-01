import { contrastRatio, createBrandTheme } from '@squirkle-ui/core'
import type { Settings } from '#shared/schemas/db'

export type Accent = Settings['accent']

// The main colours she can pick in Settings. Teal is Rien's own and comes from
// nuxt.config.ts; the others are made readable on light and dark surfaces by
// Squirkle's createBrandTheme.
// tints: the three soft colour fields behind the app (Liquid Glass), the first
// close to the main colour and two that go with it.
export const ACCENTS: { id: Accent, name: string, color: string, tints: [string, string, string] }[] = [
  { id: 'teal', name: 'Teal', color: '#0f766e', tints: ['#2dd4bf', '#38bdf8', '#f472b6'] },
  { id: 'blue', name: 'Blue', color: '#1d4ed8', tints: ['#60a5fa', '#22d3ee', '#a78bfa'] },
  { id: 'indigo', name: 'Indigo', color: '#4f46e5', tints: ['#818cf8', '#60a5fa', '#f0abfc'] },
  { id: 'violet', name: 'Violet', color: '#7c3aed', tints: ['#a78bfa', '#f472b6', '#60a5fa'] },
  { id: 'pink', name: 'Pink', color: '#db2777', tints: ['#f472b6', '#c084fc', '#fdba74'] },
  { id: 'red', name: 'Red', color: '#dc2626', tints: ['#f87171', '#fb923c', '#f472b6'] },
  { id: 'orange', name: 'Orange', color: '#ea580c', tints: ['#fb923c', '#facc15', '#f87171'] },
  { id: 'green', name: 'Green', color: '#16a34a', tints: ['#4ade80', '#2dd4bf', '#facc15'] },
]

const onColor = (background: string) =>
  contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000'

// Squirkle's own page backgrounds, which the main colour faintly tints.
const BACKGROUND = { light: '#f8f9fb', dark: '#0f1013' }

// CSS for her main colour, light and dark: the primary colour (teal's comes
// from nuxt.config.ts), the brand colour of the big cards (--rien-brand), the
// background's three colour fields, and a faint tint
// of the background itself, so the whole app fits the colour. The selectors
// outrank Squirkle's .sq-theme--light/.sq-theme--dark, which sit on <html> and
// on the app's root.
export function accentCss(accent: Accent): string {
  const choice = ACCENTS.find(a => a.id === accent) ?? ACCENTS[0]!
  const { light, dark } = createBrandTheme(choice.color)
  const primary = (color: string | undefined) => (accent === 'teal' || !color ? '' : `--sq-primary:${color};--sq-on-primary:${onColor(color)};`)
  const tints = `--rien-brand:${choice.color};${choice.tints.map((tint, i) => `--rien-tint-${i + 1}:${tint};`).join('')}`
  const background = (base: string, share: number) => `--sq-background:color-mix(in srgb,${choice.tints[0]} ${share}%,${base});`
  return `:root.sq-theme--light,:root .sq-theme--light{${primary(light?.colors.primary)}${tints}${background(BACKGROUND.light, 5)}}`
    + `:root.sq-theme--dark,:root .sq-theme--dark{${primary(dark?.colors.primary)}${tints}${background(BACKGROUND.dark, 7)}}`
}
