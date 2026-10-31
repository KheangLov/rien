import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import type { StudyRepository } from './repository'
import { openSqlRepository, type SqlDriver } from './sql'

const DATABASE = 'rien'

// SQLite through @capacitor-community/sqlite. Each call passes
// transaction = false because the repository manages its own transactions.
function capacitorDriver(db: SQLiteDBConnection): SqlDriver {
  let depth = 0
  return {
    async exec(sql) {
      await db.execute(sql, false)
    },
    async run(sql, params = []) {
      await db.run(sql, params, false)
    },
    async all(sql, params = []) {
      return ((await db.query(sql, params)).values ?? []) as never
    },
    async transaction(work) {
      // Nested calls (a migration inside open) join the outer transaction.
      if (depth > 0) return work()
      depth++
      await db.beginTransaction()
      try {
        const result = await work()
        await db.commitTransaction()
        return result
      }
      catch (error) {
        await db.rollbackTransaction()
        throw error
      }
      finally {
        depth--
      }
    },
  }
}

export async function openNativeRepository(): Promise<StudyRepository> {
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const consistent = (await sqlite.checkConnectionsConsistency()).result
  const existing = (await sqlite.isConnection(DATABASE, false)).result
  const db = consistent && existing
    ? await sqlite.retrieveConnection(DATABASE, false)
    : await sqlite.createConnection(DATABASE, false, 'no-encryption', 1, false)
  await db.open()
  return openSqlRepository(capacitorDriver(db))
}
