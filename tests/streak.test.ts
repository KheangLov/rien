import { describe, expect, it } from 'vitest'
import { dateKey, summarizeStreak, weekStart } from '#shared/utils/streak'

// 2026-11-04 is a Wednesday.
const wed = new Date(2026, 10, 4, 20, 0)

describe('dates', () => {
  it('uses local calendar days and Monday weeks', () => {
    expect(dateKey(wed)).toBe('2026-11-04')
    expect(dateKey(weekStart(wed))).toBe('2026-11-02')
    expect(dateKey(weekStart(new Date(2026, 10, 8)))).toBe('2026-11-02') // Sunday
  })
})

describe('summarizeStreak', () => {
  it('is zero with no study days', () => {
    expect(summarizeStreak([], wed)).toMatchObject({ current: 0, studiedToday: false, weekCount: 0 })
  })

  it('counts consecutive days including today', () => {
    const s = summarizeStreak(['2026-11-02', '2026-11-03', '2026-11-04'], wed)
    expect(s).toMatchObject({ current: 3, studiedToday: true, restUsedThisWeek: false, weekCount: 3 })
  })

  it('does not break the streak just because today is not done yet', () => {
    expect(summarizeStreak(['2026-11-02', '2026-11-03'], wed).current).toBe(2)
  })

  it('forgives one missed day per week', () => {
    // Missed Tuesday, studied the rest.
    const s = summarizeStreak(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-04'], wed)
    expect(s.current).toBe(4)
    expect(s.restUsedThisWeek).toBe(true)
  })

  it('breaks on a second missed day in the same week', () => {
    // Missed Monday and Tuesday.
    const s = summarizeStreak(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-04'], wed)
    expect(s.current).toBe(1)
  })

  it('allows a rest day in each of two different weeks', () => {
    // Missed Sunday 1 Nov (previous week) and Tuesday 3 Nov (this week).
    const s = summarizeStreak(['2026-10-30', '2026-10-31', '2026-11-02', '2026-11-04'], wed)
    expect(s.current).toBe(4)
  })

  it('shows the week from Monday with today and future days marked', () => {
    const { week } = summarizeStreak(['2026-11-02'], wed)
    expect(week.map(d => d.label).join('')).toBe('MTWTFSS')
    expect(week[0]).toMatchObject({ key: '2026-11-02', studied: true })
    expect(week[2]).toMatchObject({ today: true, future: false })
    expect(week[3]!.future).toBe(true)
  })
})
