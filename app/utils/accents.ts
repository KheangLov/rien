import { contrastRatio, createBrandTheme } from '@squirkle-ui/core'
import type { Settings } from '#shared/schemas/db'
import { TEAL_LOGO, logoSvg, type LogoColours } from '#shared/utils/logo'

export type Accent = Settings['accent']

// The main colours she can pick in Settings, all from one modern palette
// (Tailwind's). Teal is Rien's own and comes from nuxt.config.ts; the others
// are made readable on light and dark surfaces by Squirkle's createBrandTheme.
// tints: the three soft colour fields behind the app (Liquid Glass), the first
// close to the main colour and two that go with it.
// logo: the logo tile's gradient and the bar under the word, in this colour.
export const ACCENTS: { id: Accent, name: string, color: string, tints: [string, string, string], logo: LogoColours }[] = [
  { id: 'teal', name: 'Teal', color: '#0f766e', tints: ['#2dd4bf', '#38bdf8', '#f472b6'], logo: TEAL_LOGO },
  { id: 'blue', name: 'Blue', color: '#1d4ed8', tints: ['#60a5fa', '#22d3ee', '#a78bfa'], logo: { top: '#2563eb', bottom: '#1d4ed8', bar: '#93c5fd' } },
  { id: 'indigo', name: 'Indigo', color: '#4f46e5', tints: ['#818cf8', '#60a5fa', '#f0abfc'], logo: { top: '#6366f1', bottom: '#4f46e5', bar: '#a5b4fc' } },
  { id: 'violet', name: 'Violet', color: '#7c3aed', tints: ['#a78bfa', '#f472b6', '#60a5fa'], logo: { top: '#8b5cf6', bottom: '#7c3aed', bar: '#c4b5fd' } },
  { id: 'pink', name: 'Pink', color: '#db2777', tints: ['#f472b6', '#c084fc', '#fdba74'], logo: { top: '#ec4899', bottom: '#db2777', bar: '#f9a8d4' } },
  { id: 'red', name: 'Red', color: '#dc2626', tints: ['#f87171', '#fb923c', '#f472b6'], logo: { top: '#ef4444', bottom: '#dc2626', bar: '#fca5a5' } },
  { id: 'orange', name: 'Orange', color: '#ea580c', tints: ['#fb923c', '#facc15', '#f87171'], logo: { top: '#f97316', bottom: '#ea580c', bar: '#fed7aa' } },
  { id: 'green', name: 'Green', color: '#16a34a', tints: ['#4ade80', '#2dd4bf', '#facc15'], logo: { top: '#22c55e', bottom: '#16a34a', bar: '#bbf7d0' } },
]

export const accentOf = (accent: Accent) => ACCENTS.find(a => a.id === accent) ?? ACCENTS[0]!

// share% of a into b, as hex (what color-mix(in srgb, a share%, b) gives).
export function mixHex(a: string, b: string, share: number): string {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(channel(a, i) * share / 100 + channel(b, i) * (1 - share / 100)).toString(16).padStart(2, '0')).join('')}`
}

const onColor = (background: string) =>
  contrastRatio(background, '#ffffff') >= contrastRatio(background, '#000000') ? '#ffffff' : '#000000'

// Squirkle's own page backgrounds, which the main colour faintly tints.
const BACKGROUND = { light: '#f8f9fb', dark: '#0f1013' }

// The page background in her colour, light and dark: also the browser's and
// Android's bar colour (theme-color), so they match the page exactly.
export const backgroundOf = (accent: Accent) => {
  const tint = accentOf(accent).tints[0]
  return { light: mixHex(tint, BACKGROUND.light, 5), dark: mixHex(tint, BACKGROUND.dark, 7) }
}

// CSS for her main colour, light and dark: the primary colour (teal's comes
// from nuxt.config.ts), the brand colour of the big cards (--rien-brand), the
// background's three colour fields, the logo's colours, and a faint tint of
// the background itself, so the whole app fits the colour. The selectors
// outrank Squirkle's .sq-theme--light/.sq-theme--dark, which sit on <html> and
// on the app's root.
export function accentCss(accent: Accent): string {
  const choice = accentOf(accent)
  const { light, dark } = createBrandTheme(choice.color)
  const background = backgroundOf(accent)
  const primary = (color: string | undefined) => (accent === 'teal' || !color ? '' : `--sq-primary:${color};--sq-on-primary:${onColor(color)};`)
  const shared = `--rien-brand:${choice.color};${choice.tints.map((tint, i) => `--rien-tint-${i + 1}:${tint};`).join('')}`
    + `--rien-logo-top:${choice.logo.top};--rien-logo-bottom:${choice.logo.bottom};--rien-logo-bar:${choice.logo.bar};`
  return `:root.sq-theme--light,:root .sq-theme--light{${primary(light?.colors.primary)}${shared}--sq-background:${background.light};}`
    + `:root.sq-theme--dark,:root .sq-theme--dark{${primary(dark?.colors.primary)}${shared}--sq-background:${background.dark};}`
}

// Saved on this device each time her look is applied, for the opening screen
// (scripts/splash.html), which shows before the app or its database have
// loaded: her colours, the logo's in her colour, and her Appearance (light,
// dark, or system to follow the phone).
export function saveSplashColours(accent: Accent, appearance: Settings['appearance']): void {
  const choice = accentOf(accent)
  try {
    localStorage.setItem('rien-splash-colours', JSON.stringify({ brand: choice.color, tints: choice.tints, logo: choice.logo, appearance }))
  }
  catch {}
}

// The browser tab's icon in her colour (web only: home-screen icons are set
// when the app is installed).
export function setTabIcon(accent: Accent): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(logoSvg(accentOf(accent).logo))}`
}
