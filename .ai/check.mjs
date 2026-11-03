// Setup and /sync-ai checker: limits, placeholders, paths, line citations, vague words, frontmatter. Exit 1 on any FAIL; WARN never fails.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
const fails = [], warns = []
const fail = (file, line, why) => fails.push(`FAIL ${file}${line ? ':' + line : ''} ${why}`)
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const walk = (dir, ext) =>
  !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return ['setup', 'tasks', 'node_modules'].includes(d.name) ? [] : walk(p, ext)
    return p.endsWith(ext) ? [p] : []
  })
const docs = ['AGENTS.md', 'CLAUDE.md', ...walk('.ai', '.md'), ...walk('.claude/skills', '.md'), ...walk('.claude/agents', '.md')].filter((f) => read(f) !== null)
const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const synced = (read('.ai/CONTEXT_MAP.md') ?? '').match(/\*\*Last synced:\*\* `([^`]*)`/)?.[1] ?? ''
let changed = new Set()
try {
  if (!/^[0-9a-f]{7,40}$/.test(synced)) throw new Error(`Last synced sha missing or malformed: "${synced}"`)
  git(['cat-file', '-e', `${synced}^{commit}`])
  changed = new Set([...git(['diff', '--name-only', synced]).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean))
} catch (e) {
  fail('.ai/CONTEXT_MAP.md', 0, `Last synced not usable: ${String(e.stderr || e.message).trim().split('\n')[0]}`)
}
const counts = new Map()
const lineCount = (f, t = counts.has(f) ? '' : fs.readFileSync(f, 'utf8')) => counts.get(f) ?? counts.set(f, t.split('\n').length - (t.endsWith('\n') ? 1 : 0)).get(f)
const vague = /\b(etc\.|appropriate|as needed|handle properly|clean up)\b|~\s?\d/i
for (const file of docs) {
  const lines = read(file).split('\n')
  let preserved = false
  lines.forEach((l, i) => {
    if (l.includes('<!-- preserved:')) preserved = l.includes(':start')
    if (preserved) return
    if (l.includes('{{')) fail(file, i + 1, 'placeholder left')
    const bare = l.replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '')
    if (file.startsWith('.ai') && vague.test(bare)) fail(file, i + 1, 'vague word')
    for (const m of l.matchAll(/`([\w.\-/]+\/[\w.\-/]*(?::\d+(?:-\d+)?)?|[A-Za-z_][\w.\-]*\.[A-Za-z]\w*:\d+(?:-\d+)?)`|\]\(([^)#\s]+)\)/g)) {
      const cite = m[1] ?? m[2]
      const p = cite.replace(/:\d+(-\d+)?$/, '')
      if (/^https?:|^~|^\.\.\//.test(p) || p.includes('*')) continue
      if (!fs.existsSync(p)) { fail(file, i + 1, `missing path ${p}`); continue }
      const n = cite.match(/:(\d+)(?:-(\d+))?$/)
      if (!n || !fs.statSync(p).isFile()) continue
      const end = Number(n[2] ?? n[1]), total = lineCount(p)
      if (end > total) fail(file, i + 1, `line ${end} past end of ${p} (${total} lines)`)
      else if (changed.has(p)) warns.push(`WARN ${file}:${i + 1} stale citation ${p}:${n[1]} (changed since Last synced)`)
    }
  })
  if (file.startsWith('.ai/') && lines.length > 300) fail(file, 0, `${lines.length} lines > 300`)
  if (file.startsWith('.ai/') && !/\*\*Purpose:\*\*[\s\S]*\*\*Read when:\*\*/.test(lines.slice(0, 5).join('\n'))) fail(file, 0, 'missing Purpose / Read when')
}
const agents = read('AGENTS.md') ?? ''
const ours = agents.replace(/<!-- preserved:start -->[\s\S]*<!-- preserved:end -->/, '')
if (ours.trim().split('\n').length > 50) fail('AGENTS.md', 0, `${ours.trim().split('\n').length} own lines > 50`)
if (Buffer.byteLength(agents) > 32768) fail('AGENTS.md', 0, 'over 32 KiB')
const never = (agents.split('## Never')[1] ?? '').split('\n## ')[0].split('\n').filter((l) => /^\d+\. /.test(l))
if (never.length > 12) fail('AGENTS.md', 0, `${never.length} Never rules > 12`)
const claude = read('CLAUDE.md') ?? ''
if (claude.split('\n')[0] !== '@AGENTS.md') fail('CLAUDE.md', 1, 'line 1 must be @AGENTS.md')
if (/^@\.ai\//m.test(claude)) fail('CLAUDE.md', 0, '@-import of .ai/')
for (const m of claude.matchAll(/^- `\/([\w-]+)/gm)) if (!fs.existsSync(`.claude/skills/${m[1]}/SKILL.md`)) fail('CLAUDE.md', 0, `skill /${m[1]} not installed`)
for (const f of [...walk('.claude/skills', 'SKILL.md'), ...walk('.claude/agents', '.md')]) {
  const head = read(f).split('---')[1] ?? ''
  if (!/^model:/m.test(head) || !/^effort:/m.test(head)) fail(f, 0, 'frontmatter needs model and effort')
}
if (warns.length) console.log(warns.join('\n'))
console.log(fails.length ? fails.join('\n') : `check: all pass${warns.length ? ` (${warns.length} stale citations)` : ''}`)
process.exit(fails.length ? 1 : 0)
