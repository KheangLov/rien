// Setup and /sync-ai checker: limits, placeholders, paths, vague words, frontmatter. Exit 1 on any FAIL.
import fs from 'node:fs'
import path from 'node:path'
const fails = []
const fail = (file, line, why) => fails.push(`FAIL ${file}${line ? ':' + line : ''} ${why}`)
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null)
const walk = (dir, ext) =>
  !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return ['setup', 'tasks', 'node_modules'].includes(d.name) ? [] : walk(p, ext)
    return p.endsWith(ext) ? [p] : []
  })
const docs = ['AGENTS.md', 'CLAUDE.md', ...walk('.ai', '.md'), ...walk('.claude/skills', '.md'), ...walk('.claude/agents', '.md')].filter((f) => read(f) !== null)
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
    for (const m of l.matchAll(/`([\w.\-/]+\/[\w.\-/]*(?::\d+(?:-\d+)?)?)`|\]\(([^)#\s]+)\)/g)) {
      const p = (m[1] ?? m[2]).replace(/:\d+(-\d+)?$/, '')
      if (/^https?:|^~|^\.\.\//.test(p) || p.includes('*')) continue
      if (!fs.existsSync(p)) fail(file, i + 1, `missing path ${p}`)
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
console.log(fails.length ? fails.join('\n') : 'check: all pass')
process.exit(fails.length ? 1 : 0)
