import type { SessionRow } from '../schemas/db'
import { addDays, dateKey } from './streak'

// --- What a fish looks like -----------------------------------------------------

export interface Species {
  name: string
  body: string
  fin: string
  stripe?: string
  // Width to height of the body: higher is longer, lower is taller.
  shape: number
}

// --- Study fish: one per activity, grown by practice -----------------------------

export type Stage = 'egg' | 'baby' | 'young' | 'adult' | 'giant'
export type Health = 'happy' | 'fine' | 'hungry' | 'sick' | 'dead'

// Rounds needed to reach each stage.
export const STAGES: [Stage, number][] = [['egg', 0], ['baby', 1], ['young', 5], ['adult', 15], ['giant', 40]]

// Days since the last round before a fish reaches each state. Regular practice
// matters more than scores, so health follows practice, not accuracy: a slip
// is part of learning and never hurts a fish.
export const HEALTH_DAYS: [Health, number][] = [['happy', 2], ['fine', 6], ['hungry', 13], ['sick', 20]]

export interface SkillFish {
  kind: 'skill'
  id: string
  game: string
  title: string
  species: Species
  rounds: number
  stage: Stage
  health: Health
  daysSince: number | null
  // Rounds to the next stage, or null at the top stage.
  toNext: number | null
}

export const SKILLS: { game: string, title: string, species: Species, nativeOnly?: boolean }[] = [
  { game: 'word-recall', title: 'Goldie', species: { name: 'Goldfish', body: '#f59e0b', fin: '#fbbf24', shape: 1.5 } },
  { game: 'fix-it', title: 'Fixer', species: { name: 'Blue tang', body: '#2563eb', fin: '#facc15', shape: 1.6 } },
  { game: 'sound-hunter', title: 'Echo', species: { name: 'Clownfish', body: '#f97316', fin: '#fb923c', stripe: '#ffffff', shape: 1.7 } },
  { game: 'sentence-builder', title: 'Builder', species: { name: 'Angelfish', body: '#fde047', fin: '#facc15', stripe: '#1f2937', shape: 1.05 } },
  { game: 'gap-radio', title: 'Radio', species: { name: 'Neon tetra', body: '#22d3ee', fin: '#ef4444', shape: 2.1 } },
  { game: 'say-it', title: 'Chatty', species: { name: 'Betta', body: '#7c3aed', fin: '#c084fc', shape: 1.4 }, nativeOnly: true },
  { game: 'file-boss', title: 'Boss', species: { name: 'Grouper', body: '#78716c', fin: '#a8a29e', stripe: '#57534e', shape: 1.9 } },
  { game: 'couple-talk', title: 'Lovebirds', species: { name: 'Kissing gourami', body: '#f9a8d4', fin: '#fbcfe8', shape: 1.6 } },
]

export function stageFor(rounds: number): { stage: Stage, toNext: number | null } {
  let index = 0
  STAGES.forEach(([, min], i) => { if (rounds >= min) index = i })
  const next = STAGES[index + 1]
  return { stage: STAGES[index]![0], toNext: next ? next[1] - rounds : null }
}

export function healthFor(daysSince: number | null): Health {
  if (daysSince === null) return 'happy'
  for (const [health, max] of HEALTH_DAYS) if (daysSince <= max) return health
  return 'dead'
}

const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)

export function skillFish(sessions: readonly Pick<SessionRow, 'date' | 'games'>[], today: Date, native: boolean): SkillFish[] {
  const todayKey = dateKey(today)
  return SKILLS.filter(s => native || !s.nativeOnly).map((skill) => {
    let rounds = 0
    let last: string | null = null
    for (const day of sessions) {
      const played = day.games.filter(g => g === skill.game).length
      rounds += played
      if (played && (!last || day.date > last)) last = day.date
    }
    const daysSince = last ? daysBetween(last, todayKey) : null
    const { stage, toNext } = stageFor(rounds)
    return {
      kind: 'skill' as const,
      id: `skill:${skill.game}`,
      game: skill.game,
      title: skill.title,
      species: skill.species,
      rounds,
      stage,
      // An egg cannot go hungry; it waits to hatch.
      health: stage === 'egg' ? 'happy' : healthFor(daysSince),
      daysSince,
      toNext,
    }
  })
}

// --- Achievement fish: a new species for each milestone --------------------------

export interface TankStats {
  sessions: readonly Pick<SessionRow, 'date' | 'games' | 'rounds'>[]
  words: number
  learned: number
  bosses: readonly { score: number, total: number }[]
  talks: number
  native: boolean
}

export interface Achievement {
  id: string
  title: string
  goal: string
  species: Species
  // Progress towards the goal, as [have, need].
  progress: (stats: TankStats) => [number, number]
}

export interface AchievementFish {
  kind: 'achievement'
  id: string
  title: string
  goal: string
  species: Species
  unlocked: boolean
  have: number
  need: number
}

// The longest run of consecutive study days.
export function longestStreak(days: readonly string[]): number {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous && daysBetween(previous, day) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

const studyDays = (stats: TankStats) => stats.sessions.filter(s => s.games.length > 0).map(s => s.date)
const allRounds = (stats: TankStats) => stats.sessions.flatMap(s => s.rounds ?? [])

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-word', title: 'Sprout', goal: 'Save your first word', species: { name: 'Guppy', body: '#4ade80', fin: '#86efac', shape: 1.6 }, progress: s => [s.words, 1] },
  { id: 'words-25', title: 'Collector', goal: 'Save 25 words', species: { name: 'Molly', body: '#1e293b', fin: '#f59e0b', shape: 1.6 }, progress: s => [s.words, 25] },
  { id: 'words-100', title: 'Word Master', goal: 'Save 100 words', species: { name: 'Koi', body: '#fafafa', fin: '#f97316', stripe: '#ea580c', shape: 1.9 }, progress: s => [s.words, 100] },
  { id: 'learned-10', title: 'Memory', goal: 'Learn 10 words (past their first reviews)', species: { name: 'Discus', body: '#0ea5e9', fin: '#f472b6', shape: 1.0 }, progress: s => [s.learned, 10] },
  { id: 'streak-3', title: 'Steady', goal: 'Study 3 days in a row', species: { name: 'Platy', body: '#ef4444', fin: '#fca5a5', shape: 1.5 }, progress: s => [longestStreak(studyDays(s)), 3] },
  { id: 'streak-7', title: 'Week Hero', goal: 'Study 7 days in a row', species: { name: 'Rainbowfish', body: '#818cf8', fin: '#f472b6', stripe: '#fde047', shape: 1.7 }, progress: s => [longestStreak(studyDays(s)), 7] },
  { id: 'streak-30', title: 'Unstoppable', goal: 'Study 30 days in a row', species: { name: 'Arowana', body: '#e5e7eb', fin: '#facc15', shape: 2.6 }, progress: s => [longestStreak(studyDays(s)), 30] },
  { id: 'full-session', title: 'Teammate', goal: 'Finish four activities in one day', species: { name: 'Cardinal tetra', body: '#dc2626', fin: '#38bdf8', shape: 2.0 }, progress: s => [Math.max(0, ...s.sessions.map(d => new Set(d.games).size)), 4] },
  { id: 'perfect-round', title: 'Perfect', goal: 'Get every answer right in a round', species: { name: 'Golden wrasse', body: '#eab308', fin: '#fde68a', shape: 1.8 }, progress: s => [allRounds(s).some(r => r.total > 0 && r.clean === r.total) ? 1 : 0, 1] },
  { id: 'boss-beaten', title: 'Boss Beater', goal: 'Score 80% or more in a File Boss', species: { name: 'Lionfish', body: '#b91c1c', fin: '#fecaca', stripe: '#fff7ed', shape: 1.4 }, progress: s => [s.bosses.some(b => b.score >= Math.ceil(b.total * 0.8)) ? 1 : 0, 1] },
  { id: 'talk-5', title: 'Chatterbox', goal: 'Have 5 Couple Talks', species: { name: 'Pearl gourami', body: '#d6d3d1', fin: '#fb7185', shape: 1.6 }, progress: s => [s.talks, 5] },
  { id: 'all-games', title: 'Explorer', goal: 'Try every activity', species: { name: 'Butterflyfish', body: '#fef08a', fin: '#0f172a', stripe: '#0f172a', shape: 1.2 },
    progress: (s) => {
      const games = SKILLS.filter(k => s.native || !k.nativeOnly).map(k => k.game)
      const played = new Set(s.sessions.flatMap(d => d.games))
      return [games.filter(g => played.has(g)).length, games.length]
    } },
]

export function achievementFish(stats: TankStats): AchievementFish[] {
  return ACHIEVEMENTS.map((a) => {
    const [have, need] = a.progress(stats)
    return { kind: 'achievement' as const, id: `award:${a.id}`, title: a.title, goal: a.goal, species: a.species, unlocked: have >= need, have: Math.min(have, need), need }
  })
}

// --- What changed after a round (for the "your fish grew" message) ---------------

export function tankChanges(before: { skills: SkillFish[], awards: AchievementFish[] }, after: { skills: SkillFish[], awards: AchievementFish[] }): string[] {
  const messages: string[] = []
  for (const award of after.awards) {
    const was = before.awards.find(a => a.id === award.id)
    if (award.unlocked && !was?.unlocked) messages.push(`New fish: ${award.title} the ${award.species.name.toLowerCase()}! (${award.goal})`)
  }
  for (const fish of after.skills) {
    const was = before.skills.find(f => f.id === fish.id)
    if (!was) continue
    if (was.health === 'dead' && fish.health !== 'dead') messages.push(`${fish.title} is back to life!`)
    else if (was.stage === 'egg' && fish.stage !== 'egg') messages.push(`${fish.title} the ${fish.species.name.toLowerCase()} hatched!`)
    else if (was.stage !== fish.stage) messages.push(`${fish.title} grew into ${fish.stage === 'adult' ? 'an' : 'a'} ${fish.stage} ${fish.species.name.toLowerCase()}!`)
  }
  return messages
}

export function daysAgo(today: Date, days: number): string {
  return dateKey(addDays(today, -days))
}
