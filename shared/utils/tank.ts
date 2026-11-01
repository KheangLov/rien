import type { SessionRow } from '../schemas/db'
import { addDays, dateKey } from './streak'

// --- What a fish looks like -----------------------------------------------------

export type BodyForm = 'torpedo' | 'deep' | 'disc' | 'tall' | 'long' | 'puffer' | 'heavy' | 'humped' | 'arrow'
export type TailForm = 'forked' | 'round' | 'fan' | 'flowing' | 'lyre' | 'lunate' | 'sword'
// Extra parts that make a species recognisable even as a grey silhouette.
export type Feature = 'sail' | 'barbels' | 'lips' | 'feelers' | 'snout'

export interface Species {
  name: string
  // Shading runs from the back down to the belly.
  back: string
  belly: string
  fin: string
  form: BodyForm
  tail: TailForm
  tailColor?: string
  pattern?: { kind: 'bands' | 'lateral' | 'bars' | 'spots' | 'patches', color: string, edge?: string, accent?: string }
  // Lionfish: long spines instead of a soft dorsal fin.
  spines?: boolean
  features?: readonly Feature[]
}

// Every fish in the tank has its own outline: body, tail, spines and features
// (tests/tank.test.ts checks), so no two look alike, not even locked.
export const silhouetteOf = (s: Species) => [s.form, s.tail, s.spines ? 'spines' : '', ...(s.features ?? [])].join(' ')

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

// needsSpeech: only where Say It works (the Rien app, or a browser that can listen).
export const SKILLS: { game: string, title: string, species: Species, needsSpeech?: boolean }[] = [
  { game: 'word-recall', title: 'Goldie', species: { name: 'Goldfish', back: '#ea580c', belly: '#fde68a', fin: '#fb923c', form: 'deep', tail: 'fan' } },
  { game: 'fix-it', title: 'Fixer', species: { name: 'Blue tang', back: '#1e3a8a', belly: '#60a5fa', fin: '#1d4ed8', form: 'disc', tail: 'lunate', tailColor: '#facc15', pattern: { kind: 'lateral', color: '#0f172a' } } },
  { game: 'sound-hunter', title: 'Echo', species: { name: 'Clownfish', back: '#ea580c', belly: '#fdba74', fin: '#f97316', form: 'deep', tail: 'round', pattern: { kind: 'bands', color: '#f8fafc', edge: '#111827' } } },
  { game: 'sentence-builder', title: 'Builder', species: { name: 'Angelfish', back: '#d4d4d8', belly: '#fef9c3', fin: '#e5e7eb', form: 'tall', tail: 'lyre', pattern: { kind: 'bars', color: '#1f2937' } } },
  { game: 'gap-radio', title: 'Radio', species: { name: 'Neon tetra', back: '#334155', belly: '#e2e8f0', fin: '#cbd5e1', form: 'long', tail: 'forked', pattern: { kind: 'lateral', color: '#22d3ee', accent: '#ef4444' } } },
  { game: 'say-it', title: 'Chatty', species: { name: 'Betta', back: '#5b21b6', belly: '#a78bfa', fin: '#8b5cf6', form: 'torpedo', tail: 'flowing', features: ['sail'] }, needsSpeech: true },
  { game: 'file-boss', title: 'Boss', species: { name: 'Grouper', back: '#57534e', belly: '#d6d3d1', fin: '#78716c', form: 'heavy', tail: 'round', pattern: { kind: 'spots', color: '#292524' } } },
  { game: 'speed-round', title: 'Dash', species: { name: 'Sailfish', back: '#1e40af', belly: '#e0f2fe', fin: '#3b82f6', form: 'long', tail: 'lunate', pattern: { kind: 'bars', color: '#93c5fd' }, features: ['sail', 'snout'] } },
  { game: 'listen-pick', title: 'Ears', species: { name: 'Croaker', back: '#a8a29e', belly: '#fafaf9', fin: '#d6d3d1', form: 'heavy', tail: 'forked', pattern: { kind: 'lateral', color: '#78716c' }, features: ['barbels'] } },
  { game: 'picture-match', title: 'Picasso', species: { name: 'Parrotfish', back: '#0d9488', belly: '#a7f3d0', fin: '#f472b6', form: 'humped', tail: 'lunate', tailColor: '#f472b6', pattern: { kind: 'patches', color: '#f9a8d4' } } },
  { game: 'couple-talk', title: 'Lovebirds', species: { name: 'Kissing gourami', back: '#f472b6', belly: '#fce7f3', fin: '#fbcfe8', form: 'deep', tail: 'forked', features: ['lips'] } },
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

export function skillFish(sessions: readonly Pick<SessionRow, 'date' | 'games'>[], today: Date, speech: boolean): SkillFish[] {
  const todayKey = dateKey(today)
  return SKILLS.filter(s => speech || !s.needsSpeech).map((skill) => {
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
  speech: boolean
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
  { id: 'first-word', title: 'Sprout', goal: 'Save your first word', species: { name: 'Guppy', back: '#15803d', belly: '#bbf7d0', fin: '#f97316', form: 'torpedo', tail: 'fan', tailColor: '#f97316', pattern: { kind: 'spots', color: '#facc15' } }, progress: s => [s.words, 1] },
  { id: 'words-25', title: 'Collector', goal: 'Save 25 words', species: { name: 'Sailfin molly', back: '#0f172a', belly: '#475569', fin: '#1e293b', form: 'torpedo', tail: 'round', tailColor: '#f59e0b', features: ['sail'] }, progress: s => [s.words, 25] },
  { id: 'words-100', title: 'Word Master', goal: 'Save 100 words', species: { name: 'Koi', back: '#f5f5f4', belly: '#f8fafc', fin: '#fed7aa', form: 'long', tail: 'flowing', pattern: { kind: 'patches', color: '#ea580c' }, features: ['barbels'] }, progress: s => [s.words, 100] },
  { id: 'learned-10', title: 'Memory', goal: 'Learn 10 words (past their first reviews)', species: { name: 'Discus', back: '#0369a1', belly: '#38bdf8', fin: '#0ea5e9', form: 'disc', tail: 'round', pattern: { kind: 'bars', color: '#f97316' } }, progress: s => [s.learned, 10] },
  { id: 'streak-3', title: 'Steady', goal: 'Study 3 days in a row', species: { name: 'Swordtail', back: '#b91c1c', belly: '#fca5a5', fin: '#ef4444', form: 'torpedo', tail: 'sword', tailColor: '#facc15' }, progress: s => [longestStreak(studyDays(s)), 3] },
  { id: 'streak-7', title: 'Week Hero', goal: 'Study 7 days in a row', species: { name: 'Rainbowfish', back: '#4338ca', belly: '#fbcfe8', fin: '#f472b6', form: 'tall', tail: 'forked', pattern: { kind: 'lateral', color: '#fde047' } }, progress: s => [longestStreak(studyDays(s)), 7] },
  { id: 'streak-30', title: 'Unstoppable', goal: 'Study 30 days in a row', species: { name: 'Arowana', back: '#a1a1aa', belly: '#fafafa', fin: '#facc15', form: 'arrow', tail: 'round', features: ['barbels'] }, progress: s => [longestStreak(studyDays(s)), 30] },
  { id: 'full-session', title: 'Teammate', goal: 'Finish four activities in one day', species: { name: 'Pufferfish', back: '#ca8a04', belly: '#fef9c3', fin: '#fde047', form: 'puffer', tail: 'round', pattern: { kind: 'spots', color: '#422006' } }, progress: s => [Math.max(0, ...s.sessions.map(d => new Set(d.games).size)), 4] },
  { id: 'perfect-round', title: 'Perfect', goal: 'Get every answer right in a round', species: { name: 'Golden flowerhorn', back: '#b45309', belly: '#fde047', fin: '#f59e0b', form: 'humped', tail: 'round', pattern: { kind: 'lateral', color: '#1c1917' } }, progress: s => [allRounds(s).some(r => r.total > 0 && r.clean === r.total) ? 1 : 0, 1] },
  { id: 'boss-beaten', title: 'Boss Beater', goal: 'Score 80% or more in a File Boss', species: { name: 'Lionfish', back: '#991b1b', belly: '#fee2e2', fin: '#fecaca', form: 'deep', tail: 'fan', pattern: { kind: 'bars', color: '#fff7ed' }, spines: true }, progress: s => [s.bosses.some(b => b.score >= Math.ceil(b.total * 0.8)) ? 1 : 0, 1] },
  { id: 'talk-5', title: 'Chatterbox', goal: 'Have 5 Couple Talks', species: { name: 'Pearl gourami', back: '#78716c', belly: '#fdba74', fin: '#e7e5e4', form: 'deep', tail: 'lunate', pattern: { kind: 'spots', color: '#fafaf9' }, features: ['feelers'] }, progress: s => [s.talks, 5] },
  { id: 'all-games', title: 'Explorer', goal: 'Try every activity', species: { name: 'Butterflyfish', back: '#facc15', belly: '#fef9c3', fin: '#fde047', form: 'disc', tail: 'round', pattern: { kind: 'bars', color: '#0f172a' }, features: ['snout'] },
    progress: (s) => {
      const games = SKILLS.filter(k => s.speech || !k.needsSpeech).map(k => k.game)
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
