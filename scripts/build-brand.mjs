// Draws Rien's logo (a teal squircle with the "Rien" wordmark) from one vector
// source at every exact pixel size, so nothing is scaled up and blurry:
// PWA icons and iPhone home-screen splash screens, the iPhone app icon and
// launch logo, and the Android launcher icons and splash icon.
// Run after changing the logo or the splash colours:
//   node scripts/build-brand.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'
import { Resvg } from '@resvg/resvg-js'
import { IOS_SCREENS, SPLASH_DARK, SPLASH_LIGHT, splashFile } from './brand.ts'

const TEAL = '#0f766e'
const TEAL_LIGHT = '#139483'
const MINT = '#5eead4'

// "Rien" in Helvetica Bold, as a path (no font needed to build), in a 512 box.
const WORD = 'M122.7 246.4L93.2 246.4L93.2 300L65.3 300L65.3 163.3L132.3 163.3Q146.7 163.5 154.5 166.8Q162.2 170 167.6 176.3Q172 181.5 174.6 187.8Q177.2 194.1 177.2 202.2Q177.2 212 172.3 221.4Q167.4 230.8 156.1 234.7Q165.5 238.5 169.5 245.5Q173.4 252.5 173.4 266.9L173.4 276.1Q173.4 285.4 174.2 288.8Q175.3 294.1 179.4 296.6L179.4 300L147.9 300Q146.6 295.5 146.1 292.7Q145 286.9 144.9 280.9L144.7 268.2Q144.5 255.1 139.9 250.7Q135.3 246.4 122.7 246.4ZM140 221.5Q148.6 217.6 148.6 206.1Q148.6 193.7 140.3 189.4Q135.7 187 126.4 187L93.2 187L93.2 223.7L125.6 223.7Q135.2 223.7 140 221.5ZM226.9 198.9L226.9 300L200.1 300L200.1 198.9L226.9 198.9ZM226.9 162.4L226.9 186.8L200.1 186.8L200.1 162.4L226.9 162.4ZM339 270.3Q338 279.3 329.7 288.6Q316.7 303.3 293.3 303.3Q274 303.3 259.2 290.9Q244.5 278.5 244.5 250.5Q244.5 224.2 257.8 210.2Q271.1 196.2 292.4 196.2Q305 196.2 315.1 200.9Q325.2 205.6 331.8 215.9Q337.7 224.9 339.5 236.7Q340.5 243.7 340.3 256.8L271.1 256.8Q271.7 272 280.7 278.1Q286.2 281.9 293.9 281.9Q302 281.9 307.1 277.3Q309.9 274.8 312 270.3L339 270.3ZM312.9 239.3Q312.2 228.8 306.5 223.4Q300.8 218 292.4 218Q283.2 218 278.1 223.7Q273.1 229.5 271.8 239.3L312.9 239.3ZM405.7 218.5Q392.3 218.5 387.3 229.9Q384.7 235.9 384.7 245.3L384.7 300L358.3 300L358.3 199.1L383.8 199.1L383.8 213.8Q388.9 206 393.5 202.6Q401.7 196.5 414.2 196.5Q429.9 196.5 439.8 204.7Q449.8 212.9 449.8 231.9L449.8 300L422.7 300L422.7 238.5Q422.7 230.5 420.6 226.2Q416.7 218.5 405.7 218.5Z'
const MARK = `<g transform="translate(0 -9)"><path fill="#fff" d="${WORD}"/><rect x="136" y="350" width="240" height="18" rx="9" fill="${MINT}"/></g>`
const GRADIENT = `<defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TEAL_LIGHT}"/><stop offset="1" stop-color="${TEAL}"/></linearGradient></defs>`

// A squircle the iOS way: one superellipse, |x|^5 + |y|^5 = 1, centred in the 512 box.
function squircle(half = 256, n = 5, steps = 720) {
  const points = []
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

const scaled = (scale, body) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${body}</g>`
const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${GRADIENT}${body}</svg>`

// Full-bleed square: the system cuts the shape (iPhone icons, maskable PWA icon).
const bleed = (markScale = 1) => svg(`<rect width="512" height="512" fill="url(#tile)"/>${scaled(markScale, MARK)}`)
// The squircle tile on transparent, at a share of the canvas.
const tile = (tileScale = 1) => svg(scaled(tileScale, `<path fill="url(#tile)" d="${squircle()}"/>${MARK}`))
// Android's round launcher icon.
const round = () => svg(`<circle cx="256" cy="256" r="256" fill="url(#tile)"/>${scaled(0.72, MARK)}`)
// Android's adaptive foreground: the mark alone, inside the 66 of 108 dp safe circle.
const foreground = () => svg(scaled(0.7, MARK))

// PNG out, RGB when nothing is see-through (App Store icons must have no alpha).
function png(pixels, width, height) {
  let opaque = true
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) { opaque = false; break }
  const channels = opaque ? 3 : 4
  const raw = Buffer.alloc((width * channels + 1) * height)
  for (let y = 0, o = 0; y < height; y++) {
    raw[o++] = 0
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4
      for (let c = 0; c < channels; c++) raw[o++] = pixels[p + c]
    }
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length)
    head.write(type, 4, 'latin1')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])))
    return Buffer.concat([head, data, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = opaque ? 2 : 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const render = (source, size) => {
  const image = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render()
  return png(image.pixels, image.width, image.height)
}

// A logo of logoSize pixels centred on a screen filled with one colour.
function onScreen(source, logoSize, width, height, colour) {
  const image = new Resvg(source, { fitTo: { mode: 'width', value: logoSize } }).render()
  // `pixels` copies the whole image on every read, so read it once.
  const pixels = image.pixels
  const out = Buffer.alloc(width * height * 4, Buffer.from(`${colour.slice(1)}ff`, 'hex'))
  const left = Math.round((width - image.width) / 2)
  const top = Math.round((height - image.height) / 2)
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const p = (y * image.width + x) * 4
      const q = ((top + y) * width + left + x) * 4
      const a = pixels[p + 3] / 255
      for (let c = 0; c < 3; c++) out[q + c] = Math.round(pixels[p + c] * a + out[q + c] * (1 - a))
    }
  }
  return png(out, width, height)
}

function write(path, data) {
  mkdirSync(new URL('.', new URL(path, ROOT)), { recursive: true })
  writeFileSync(new URL(path, ROOT), data)
}
const ROOT = new URL('../', import.meta.url)

// Web and PWA.
write('public/icon.svg', `${tile().replace('<svg ', '<svg width="512" height="512" ')}\n`)
write('public/pwa-192.png', render(tile(), 192))
write('public/pwa-512.png', render(tile(), 512))
write('public/pwa-maskable-512.png', render(bleed(0.8), 512))
write('public/apple-touch-icon.png', render(bleed(), 180))

// iPhone home-screen splash screens for the PWA (iOS shows a blank screen
// without one). Logo 128 pt, as on the native app.
rmSync(new URL('public/splash/', ROOT), { recursive: true, force: true })
for (const [w, h, scale] of IOS_SCREENS) {
  for (const [mode, colour] of [['light', SPLASH_LIGHT], ['dark', SPLASH_DARK]]) {
    write(`public${splashFile([w, h, scale], mode)}`, onScreen(tile(), 128 * scale, w * scale, h * scale, colour))
  }
}

// iPhone app: icon (iOS cuts the squircle) and launch-screen logo (128 pt).
const IOS = 'ios/App/App/Assets.xcassets/'
write(`${IOS}AppIcon.appiconset/AppIcon-512@2x.png`, render(bleed(), 1024))
rmSync(new URL(`${IOS}Splash.imageset/`, ROOT), { recursive: true, force: true })
const LOGO_FILES = ['splash-logo.png', 'splash-logo@2x.png', 'splash-logo@3x.png']
LOGO_FILES.forEach((file, i) => write(`${IOS}SplashLogo.imageset/${file}`, render(tile(), 128 * (i + 1))))
write(`${IOS}SplashLogo.imageset/Contents.json`, `${JSON.stringify({
  images: LOGO_FILES.map((filename, i) => ({ filename, idiom: 'universal', scale: `${i + 1}x` })),
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`)
const rgb = hex => Object.fromEntries(['red', 'green', 'blue'].map((k, i) => [k, `0x${hex.slice(1 + i * 2, 3 + i * 2).toUpperCase()}`]))
const colour = hex => ({ 'color-space': 'srgb', components: { alpha: '1.000', ...rgb(hex) } })
write(`${IOS}SplashBackground.colorset/Contents.json`, `${JSON.stringify({
  colors: [
    { color: colour(SPLASH_LIGHT), idiom: 'universal' },
    { appearances: [{ appearance: 'luminosity', value: 'dark' }], color: colour(SPLASH_DARK), idiom: 'universal' },
  ],
  info: { author: 'xcode', version: 1 },
}, null, 2)}\n`)

// Android: launcher icons (48 dp, adaptive foreground 108 dp) and the splash
// icon (drawn at 288 dp, inside a 192 dp circle): the tile is 128 dp, the same
// size as on the iPhone and in the web splash, so the hand-over does not jump.
const RES = 'android/app/src/main/res/'
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [name, scale] of Object.entries(DENSITIES)) {
  write(`${RES}mipmap-${name}/ic_launcher.png`, render(tile(), 48 * scale))
  write(`${RES}mipmap-${name}/ic_launcher_round.png`, render(round(), 48 * scale))
  write(`${RES}mipmap-${name}/ic_launcher_foreground.png`, render(foreground(), 108 * scale))
  write(`${RES}drawable-${name}/splash_icon.png`, render(tile(128 / 288), 288 * scale))
  for (const old of [`drawable-port-${name}`, `drawable-land-${name}`]) rmSync(new URL(`${RES}${old}/`, ROOT), { recursive: true, force: true })
}
rmSync(new URL(`${RES}drawable/splash.png`, ROOT), { force: true })
const colours = hex => `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/build-brand.mjs. -->
<resources>
    <color name="splash_background">${hex}</color>
</resources>
`
write(`${RES}values/splash.xml`, colours(SPLASH_LIGHT))
write(`${RES}values-night/splash.xml`, colours(SPLASH_DARK))
// The animated opening screen (scripts/splash.html), shown from the page's own
// HTML in the web app and in the phone apps.
const read = path => readFileSync(new URL(path, ROOT), 'utf8')
const fish = JSON.parse(read('app/assets/icons/solar.json')).icons['rien-fish-bold'].body
const fill = {
  SQUIRCLE: squircle(256, 5, 96), WORD, FISH: fish, TEAL, TEAL_LIGHT, MINT, SPLASH_LIGHT, SPLASH_DARK,
}
write('app/spa-loading-template.html', read('scripts/splash.html')
  .replace(/\{\{(\w+)\}\}/g, (_, key) => fill[key])
  .replace(/^<!-- Rien's opening screen[\s\S]*?-->\n/, '<!-- Written by scripts/build-brand.mjs from scripts/splash.html: edit that file. -->\n'))

console.log('Logo, icons and splash screens written.')
