// Loaded into Rien's service worker (nuxt.config.ts, workbox importScripts).
// Serves the web app manifest in her look, at its usual address: Chrome stops
// updating an installed app whose manifest address changes, but it rereads
// the manifest at launch and updates the app's colours and icon (asking her
// first for the icon). The page saves her look in the cache "rien-look" each
// time it is applied (plugins/appearance.client.ts):
//   { accent, iconFollowsColour, background }
// - theme_color and background_color: her page background, so the system bars
//   of the installed app match the page instead of Rien's original teal;
// - icons: in her colour when she has chosen "Icon in my colour".
const LOOK_CACHE = 'rien-look'
const LOOK_KEY = '/rien-look.json'
const ACCENTS = ['blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'green']

async function manifestInHerLook(request) {
  const original = await fetch(request).catch(() => caches.match(request, { ignoreSearch: true }))
  if (!original || !original.ok) return original ?? Response.error()
  let look
  try {
    const saved = await (await caches.open(LOOK_CACHE)).match(LOOK_KEY)
    look = saved ? await saved.json() : undefined
  }
  catch {}
  if (!look) return original
  const manifest = await original.clone().json().catch(() => undefined)
  if (!manifest) return original
  if (/^#[0-9a-f]{6}$/i.test(look.background ?? '')) {
    manifest.theme_color = look.background
    manifest.background_color = look.background
  }
  if (look.iconFollowsColour && ACCENTS.includes(look.accent)) {
    manifest.icons = [
      { src: `/icons/${look.accent}/pwa-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${look.accent}/pwa-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${look.accent}/pwa-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]
  }
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json' } })
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin === self.location.origin && url.pathname.endsWith('/manifest.webmanifest')) {
    event.respondWith(manifestInHerLook(event.request))
  }
})
