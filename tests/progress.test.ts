import { describe, expect, it } from 'vitest'
import { minutesByDay, minutesThisWeek, weakSpots } from '#shared/utils/progress'

const wed = new Date(2026, 10, 4, 20, 0)
const sessions = [
  { date: '2026-10-25', games: ['fix-it'], minutes: 9 },
  { date: '2026-11-02', games: ['fix-it'], minutes: 12.4 },
  { date: '2026-11-04', games: ['word-recall'], minutes: 6.6 },
]

describe('progress figures', () => {
  it('lists minutes for each of the last days, with empty days as zero', () => {
    const { labels, keys, values } = minutesByDay(sessions, wed, 3)
    expect(keys).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
    expect(labels).toEqual(['2', '3', '4'])
    expect(values).toEqual([12, 0, 7])
  })

  it('adds up minutes from Monday to today', () => {
    expect(minutesThisWeek(sessions, wed)).toBe(19)
  })

  it('ranks weak spots and drops empty types', () => {
    expect(weakSpots({ article: 2, tense: 5, preposition: 0 }).map(w => w.type)).toEqual(['tense', 'article'])
  })
})
