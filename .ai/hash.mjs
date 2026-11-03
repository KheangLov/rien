// Tamper seal for a task file (.ai/TASK_CONTRACT.md): sha256 of the file up to
// "## Import Check", without its status: and approved_hash: lines.
// Usage: node .ai/hash.mjs .ai/tasks/<slug>.md
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file || !/^\.ai\/tasks\/[\w.-]+\.md$/.test(file)) {
  console.error('usage: node .ai/hash.mjs .ai/tasks/<slug>.md')
  process.exit(2)
}
const body = readFileSync(file, 'utf8').split('\n## Import Check')[0]
  .split('\n').filter(l => !/^(status|approved_hash):/.test(l)).join('\n')
console.log(createHash('sha256').update(body).digest('hex'))
