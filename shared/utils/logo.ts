// Rien's logo, from one source: a squircle tile with a gradient, the "Rien"
// wordmark and a bar under it, in a 512 box. Drawn into PNGs by
// scripts/build-brand.mjs (home-screen icons, launch screens), inline by
// RienLogo.vue, and as the browser tab's icon in her main colour.

// The tile's gradient (top, bottom) and the bar under the word.
export type LogoColours = { top: string, bottom: string, bar: string }

// Rien's own teal: what the home-screen icon and launch screens show.
export const TEAL_LOGO: LogoColours = { top: '#139483', bottom: '#0f766e', bar: '#5eead4' }

// The logo in each main colour (Settings → Colour): the app's own logo, the
// browser tab's icon and, on Android, the home-screen icon if she chooses.
export const ACCENT_LOGOS = {
  teal: TEAL_LOGO,
  blue: { top: '#2563eb', bottom: '#1d4ed8', bar: '#93c5fd' },
  indigo: { top: '#6366f1', bottom: '#4f46e5', bar: '#a5b4fc' },
  violet: { top: '#8b5cf6', bottom: '#7c3aed', bar: '#c4b5fd' },
  pink: { top: '#ec4899', bottom: '#db2777', bar: '#f9a8d4' },
  red: { top: '#ef4444', bottom: '#dc2626', bar: '#fca5a5' },
  orange: { top: '#f97316', bottom: '#ea580c', bar: '#fed7aa' },
  green: { top: '#22c55e', bottom: '#16a34a', bar: '#bbf7d0' },
} as const satisfies Record<string, LogoColours>

// "Rien" in Helvetica Bold, as a path (no font needed), in the 512 box.
export const LOGO_WORD = 'M122.7 246.4L93.2 246.4L93.2 300L65.3 300L65.3 163.3L132.3 163.3Q146.7 163.5 154.5 166.8Q162.2 170 167.6 176.3Q172 181.5 174.6 187.8Q177.2 194.1 177.2 202.2Q177.2 212 172.3 221.4Q167.4 230.8 156.1 234.7Q165.5 238.5 169.5 245.5Q173.4 252.5 173.4 266.9L173.4 276.1Q173.4 285.4 174.2 288.8Q175.3 294.1 179.4 296.6L179.4 300L147.9 300Q146.6 295.5 146.1 292.7Q145 286.9 144.9 280.9L144.7 268.2Q144.5 255.1 139.9 250.7Q135.3 246.4 122.7 246.4ZM140 221.5Q148.6 217.6 148.6 206.1Q148.6 193.7 140.3 189.4Q135.7 187 126.4 187L93.2 187L93.2 223.7L125.6 223.7Q135.2 223.7 140 221.5ZM226.9 198.9L226.9 300L200.1 300L200.1 198.9L226.9 198.9ZM226.9 162.4L226.9 186.8L200.1 186.8L200.1 162.4L226.9 162.4ZM339 270.3Q338 279.3 329.7 288.6Q316.7 303.3 293.3 303.3Q274 303.3 259.2 290.9Q244.5 278.5 244.5 250.5Q244.5 224.2 257.8 210.2Q271.1 196.2 292.4 196.2Q305 196.2 315.1 200.9Q325.2 205.6 331.8 215.9Q337.7 224.9 339.5 236.7Q340.5 243.7 340.3 256.8L271.1 256.8Q271.7 272 280.7 278.1Q286.2 281.9 293.9 281.9Q302 281.9 307.1 277.3Q309.9 274.8 312 270.3L339 270.3ZM312.9 239.3Q312.2 228.8 306.5 223.4Q300.8 218 292.4 218Q283.2 218 278.1 223.7Q273.1 229.5 271.8 239.3L312.9 239.3ZM405.7 218.5Q392.3 218.5 387.3 229.9Q384.7 235.9 384.7 245.3L384.7 300L358.3 300L358.3 199.1L383.8 199.1L383.8 213.8Q388.9 206 393.5 202.6Q401.7 196.5 414.2 196.5Q429.9 196.5 439.8 204.7Q449.8 212.9 449.8 231.9L449.8 300L422.7 300L422.7 238.5Q422.7 230.5 420.6 226.2Q416.7 218.5 405.7 218.5Z'

// A squircle the iOS way: one superellipse, |x|^5 + |y|^5 = 1, centred in the 512 box.
export function logoSquircle(half = 256, n = 5, steps = 720): string {
  const points: string[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = 256 + half * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = 256 + half * Math.sign(s) * Math.abs(s) ** (2 / n)
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return `M${points.join('L')}Z`
}

// The word and bar, which every version of the logo shares.
export const logoMark = (bar: string) =>
  `<g transform="translate(0 -9)"><path fill="#f8fafc" d="${LOGO_WORD}"/><rect x="136" y="350" width="240" height="18" rx="9" fill="${bar}"/></g>`

export const logoGradient = (colours: LogoColours, id = 'tile') =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colours.top}"/><stop offset="1" stop-color="${colours.bottom}"/></linearGradient>`

// The whole tile as one SVG (96 points are plenty below a few hundred pixels).
export const logoSvg = (colours: LogoColours, steps = 96) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${logoGradient(colours)}</defs>`
  + `<path fill="url(#tile)" d="${logoSquircle(256, 5, steps)}"/>${logoMark(colours.bar)}</svg>`
