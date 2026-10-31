import { describe, expect, it, vi } from 'vitest'
import { lazyRepository, withChangeEvents } from '~/data/events'
import { openSqlRepository } from '~/data/sql'
import { nodeSqliteDriver } from './node-sqlite-driver'

const word = { answer: 'borrow', meaning: 'to take and give back', book: 'english-file-pre-intermediate-4e' as const, file: 7 }

describe('withChangeEvents', () => {
  it('notifies after writes but not reads, and stops after unsubscribe', async () => {
    const repo = withChangeEvents(await openSqlRepository(nodeSqliteDriver()))
    const listener = vi.fn()
    const off = repo.subscribe(listener)

    await repo.countCards()
    expect(listener).not.toHaveBeenCalled()
    await repo.addWord(word)
    await repo.saveSettings({ file: 8 })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(await repo.countCards()).toBe(1)

    off()
    await repo.recordActivity('2026-11-02', 'fix-it', 1)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not notify when a write fails', async () => {
    const repo = withChangeEvents(await openSqlRepository(nodeSqliteDriver()))
    const listener = vi.fn()
    repo.subscribe(listener)
    await expect(repo.importAll({ nope: true })).rejects.toThrow()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('lazyRepository', () => {
  it('waits for the real repository to open', async () => {
    let open!: (value: Awaited<ReturnType<typeof openSqlRepository>>) => void
    const repo = lazyRepository(new Promise(resolve => (open = resolve)))
    const pending = repo.countCards()
    open(await openSqlRepository(nodeSqliteDriver()))
    expect(await pending).toBe(0)
  })
})
