// Dates are local calendar days ("2026-11-02"), Monday to Sunday weeks.

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return addDays(start, -((start.getDay() + 6) % 7))
}

export interface WeekDay {
  key: string
  label: string
  studied: boolean
  today: boolean
  future: boolean
}

export interface StreakSummary {
  // Days studied in the current run, not counting rest days.
  current: number
  studiedToday: boolean
  // This week's one free missed day has been used.
  restUsedThisWeek: boolean
  week: WeekDay[]
  weekCount: number
}

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// A streak survives one missed day per week (the rest day). A second miss in
// the same week ends it. Today only counts against her once it is over.
export function summarizeStreak(studyDays: Iterable<string>, today: Date): StreakSummary {
  const studied = new Set(studyDays)
  const todayKey = dateKey(today)
  const earliest = [...studied].sort()[0]
  const restWeeks = new Set<string>()

  let current = 0
  let day = studied.has(todayKey) ? today : addDays(today, -1)
  while (earliest && dateKey(day) >= earliest) {
    const key = dateKey(day)
    if (studied.has(key)) {
      current++
    }
    else {
      const week = dateKey(weekStart(day))
      if (restWeeks.has(week)) break
      restWeeks.add(week)
    }
    day = addDays(day, -1)
  }

  const monday = weekStart(today)
  const week = LABELS.map((label, i) => {
    const key = dateKey(addDays(monday, i))
    return { key, label, studied: studied.has(key), today: key === todayKey, future: key > todayKey }
  })

  return {
    current,
    studiedToday: studied.has(todayKey),
    restUsedThisWeek: current > 0 && restWeeks.has(dateKey(monday)),
    week,
    weekCount: week.filter(d => d.studied).length,
  }
}
