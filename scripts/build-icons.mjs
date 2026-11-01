// Copies only the Solar icons Rien uses (linear, bold, bold-duotone) out of
// @iconify-json/solar into app/assets/icons/solar.json, plus a fish drawn in
// Solar's style (Solar has none). Run after changing the icon list:
//   node scripts/build-icons.mjs
// Solar icon set by 480 Design, CC BY 4.0 (https://www.figma.com/community/file/1166831539721848736).
import { readFileSync, writeFileSync } from 'node:fs'

const BASES = [
  'home-2', 'notebook', 'chart-2', 'user-circle', 'close-circle', 'alt-arrow-left', 'alt-arrow-right',
  'add-circle', 'check-read', 'magnifer', 'play', 'fire', 'stars', 'gallery', 'camera', 'volume-loud',
  'lightbulb', 'layers', 'pen-new-square', 'soundwave', 'widget-add', 'radio', 'microphone-2', 'cup-star',
  'chat-round-dots',
]
const VARIANTS = ['linear', 'bold', 'bold-duotone']

const solar = JSON.parse(readFileSync(new URL('../node_modules/@iconify-json/solar/icons.json', import.meta.url), 'utf8'))
const icons = {}
for (const base of BASES) {
  for (const variant of VARIANTS) {
    const name = `${base}-${variant}`
    // Some names are aliases of another icon.
    let source = name
    while (!solar.icons[source] && solar.aliases?.[source]) source = solar.aliases[source].parent
    if (!solar.icons[source]) throw new Error(`Solar has no ${name}`)
    icons[name] = solar.icons[source]
  }
}

// A fish in Solar's style: 24 px grid, 1.5 px rounded strokes; duotone body at 50%.
const body = 'M6 12c2.4-3.6 5.6-5.5 8.8-5.5c2.8 0 5 1.7 6.4 4.4a2.4 2.4 0 0 1 0 2.2c-1.4 2.7-3.6 4.4-6.4 4.4c-3.2 0-6.4-1.9-8.8-5.5Z'
const tail = 'M6 12L2.5 8.5v7Z'
const gill = 'M12.9 8.4c-.8 1.1-1.2 2.3-1.2 3.6s.4 2.5 1.2 3.6'
const eye = 'M18.2 11.2a.9.9 0 1 1-1.8 0a.9.9 0 0 1 1.8 0Z'
icons['rien-fish-linear'] = { body: `<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="${body}"/><path d="${tail}"/><path d="${gill}"/></g><path fill="currentColor" d="${eye}"/>` }
icons['rien-fish-bold'] = { body: `<path fill="currentColor" fill-rule="evenodd" d="${body} ${eye}"/><path fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" d="${tail}"/>` }
icons['rien-fish-bold-duotone'] = { body: `<path fill="currentColor" d="${body}" opacity=".5"/><path fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-width="1.5" d="${tail}"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" d="${gill}"/><path fill="currentColor" d="${eye}"/>` }

const out = { prefix: 'solar', width: 24, height: 24, icons }
writeFileSync(new URL('../app/assets/icons/solar.json', import.meta.url), `${JSON.stringify(out)}\n`)
console.log(`${Object.keys(icons).length} icons, ${Math.round(JSON.stringify(out).length / 1024)} KB`)
