import { DatabaseSync } from 'node:sqlite'
import type { SqlDriver } from '~/data/sql'

// The same driver contract as the Capacitor plugin, on Node's built-in SQLite.
export function nodeSqliteDriver(db = new DatabaseSync(':memory:')): SqlDriver {
  let depth = 0
  return {
    async exec(sql) {
      db.exec(sql)
    },
    async run(sql, params = []) {
      db.prepare(sql).run(...params)
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...params) as never
    },
    async transaction(work) {
      if (depth > 0) return work()
      depth++
      db.exec('BEGIN')
      try {
        const result = await work()
        db.exec('COMMIT')
        return result
      }
      catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
      finally {
        depth--
      }
    },
  }
}
