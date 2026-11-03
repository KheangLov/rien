// Runs the in-app e2e runner in headless Chrome and saves a screenshot at
// every "[e2e] SCREEN <name>" checkpoint. Build first with `pnpm build:e2e`.
//
//   node scripts/e2e-browser.mjs [--width 390] [--height 844] [--out <dir>] [--dark] [--dir <build>]
//
// Serves .output/public (or --dir, e.g. a copy, so another session's rebuild
// can't swap chunks mid-run) on 127.0.0.1 (a free port, single-page fallback),
// opens it in a fresh Chrome profile, prints every [e2e] line, writes
// <out>/<name>.png per checkpoint, and exits 0 only on "DONE … fail=0".
// Node built-ins only; Chrome from CHROME_PATH or the usual install paths.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const width = Number(opt('width', '390'))
const height = Number(opt('height', '844'))
const out = resolve(opt('out', join(tmpdir(), `rien-e2e-${Date.now()}`)))
const dark = args.includes('--dark')
const TIMEOUT_MS = 6 * 60_000

const root = resolve(opt('dir', '.output/public'))
if (!existsSync(join(root, 'index.html'))) {
  console.error(`no ${root}/index.html: run \`pnpm build:e2e\` first`)
  process.exit(2)
}

const chrome = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => p && existsSync(p))
if (!chrome) {
  console.error('Chrome not found: set CHROME_PATH')
  process.exit(2)
}

// --- Static server ------------------------------------------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain' }
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  let file = join(root, path)
  if (!file.startsWith(root) || !existsSync(file) || !extname(file)) file = join(root, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const url = `http://127.0.0.1:${server.address().port}/`

// --- Chrome over the DevTools protocol -----------------------------------------
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'rien-e2e-profile-'))
const browser = spawn(chrome, [
  '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0',
  `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
  ...(dark ? ['--force-dark-mode', '--blink-settings=preferredColorScheme=0'] : []),
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })

let finished = false
const cleanup = (code) => {
  if (finished) return
  finished = true
  browser.kill()
  server.close()
  try { rmSync(profile, { recursive: true, force: true }) }
  catch {}
  process.exit(code)
}
setTimeout(() => { console.error(`timed out after ${TIMEOUT_MS / 1000}s without DONE`); cleanup(1) }, TIMEOUT_MS).unref()

const wsBrowser = await new Promise((resolveWs, reject) => {
  let buf = ''
  browser.stderr.on('data', (d) => {
    buf += d
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) resolveWs(m[1])
  })
  browser.on('exit', () => reject(new Error('Chrome exited before DevTools was ready')))
})
const port = new URL(wsBrowser).port
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const page = targets.find(t => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r, { once: true }))

let nextId = 1
const pending = new Map()
const send = (method, params = {}) => new Promise((ok, fail) => {
  const id = nextId++
  pending.set(id, { ok, fail })
  ws.send(JSON.stringify({ id, method, params }))
})

let shots = 0
let chain = Promise.resolve()
const shoot = name => (chain = chain.then(async () => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${String(++shots).padStart(2, '0')}-${name}.png`), Buffer.from(data, 'base64'))
}).catch(e => console.error(`screenshot ${name} failed: ${e.message}`)))

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p.fail(new Error(msg.error.message))
    else p.ok(msg.result)
    return
  }
  if (msg.method !== 'Runtime.consoleAPICalled') return
  const line = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')
  if (!line.startsWith('[e2e] ')) return
  console.log(line)
  const screen = line.match(/^\[e2e\] SCREEN (\S+)/)
  if (screen) shoot(screen[1])
  const done = line.match(/^\[e2e\] DONE pass=(\d+) fail=(\d+)/)
  if (done) {
    chain.then(() => {
      console.log(`screenshots: ${shots} in ${out}`)
      cleanup(Number(done[2]) === 0 ? 0 : 1)
    })
  }
})

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width < 700 })
if (dark) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] })
// Asks the runner to pause briefly at each checkpoint for its picture.
await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__rienShots = true' })
await send('Page.navigate', { url })
