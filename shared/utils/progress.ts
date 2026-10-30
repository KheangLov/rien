import { MISTAKE_LABELS, type MistakeType, type SessionRow } from '../schemas/db'
import { addDays, dateKey, weekStart } from './streak'

type DayMinutes = Pick<SessionRow, 'date' | 'minutes'>

// Minutes studied on each of the last `days` days, oldest first.
export function minutesByDay(sessions: readonly DayMinutes[], today: Date, days = 14) {
  const byDate = new Map(sessions.map(s => [s.date, s.minutes]))
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i - days + 1))
  return {
    labels: dates.map(d => String(d.getDate())),
    keys: dates.map(dateKey),
    values: dates.map(d => Math.round(byDate.get(dateKey(d)) ?? 0)),
  }
}

export function minutesThisWeek(sessions: readonly DayMinutes[], today: Date): number {
  const from = dateKey(weekStart(today))
  const to = dateKey(today)
  return Math.round(sessions.filter(s => s.date >= from && s.date <= to).reduce((sum, s) => sum + s.minutes, 0))
}

// Mistake types with at least one slip, most frequent first.
export function weakSpots(counts: Partial<Record<MistakeType, number>>) {
  return (Object.entries(counts) as [MistakeType, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, label: MISTAKE_LABELS[type], count }))
}
