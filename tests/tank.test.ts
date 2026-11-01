import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, achievementFish, daysAgo, healthFor, longestStreak, silhouetteOf, SKILLS, skillFish, stageFor, tankChanges, type TankStats } from '#shared/utils/tank'

const today = new Date(2026, 10, 20, 9, 0)
const day = (offset: number, games: string[], rounds: { game: string, clean: number, total: number }[] = []) =>
  ({ date: daysAgo(today, offset), games, minutes: 5, rounds })

describe('growth and health', () => {
  it('grows through the stages with rounds played', () => {
    expect(stageFor(0)).toEqual({ stage: 'egg', toNext: 1 })
    expect(stageFor(1)).toEqual({ stage: 'baby', toNext: 4 })
    expect(stageFor(14)).toEqual({ stage: 'young', toNext: 1 })
    expect(stageFor(40)).toEqual({ stage: 'giant', toNext: null })
  })

  it('follows days since practice, and dies after three weeks', () => {
    expect([0, 2, 3, 7, 14, 20, 21].map(healthFor)).toEqual(['happy', 'happy', 'fine', 'hungry', 'sick', 'sick', 'dead'])
  })

  it('builds one fish per activity from the session log', () => {
    const fish = skillFish([day(10, ['fix-it', 'fix-it']), day(1, ['word-recall'])], today, false)
    const fixer = fish.find(f => f.game === 'fix-it')!
    expect(fixer).toMatchObject({ rounds: 2, stage: 'baby', health: 'hungry', daysSince: 10 })
    expect(fish.find(f => f.game === 'word-recall')).toMatchObject({ stage: 'baby', health: 'happy' })
    expect(fish.find(f => f.game === 'gap-radio')).toMatchObject({ stage: 'egg', health: 'happy' })
    expect(fish.some(f => f.game === 'say-it')).toBe(false)
    expect(skillFish([], today, true).some(f => f.game === 'say-it')).toBe(true)
  })

  it('a dead fish keeps its size and comes back after one round', () => {
    const before = skillFish([day(30, ['fix-it', 'fix-it', 'fix-it', 'fix-it', 'fix-it'])], today, false)
    expect(before.find(f => f.game === 'fix-it')).toMatchObject({ stage: 'young', health: 'dead' })
    const after = skillFish([day(30, ['fix-it', 'fix-it', 'fix-it', 'fix-it', 'fix-it']), day(0, ['fix-it'])], today, false)
    expect(after.find(f => f.game === 'fix-it')).toMatchObject({ stage: 'young', health: 'happy' })
  })
})

describe('every fish is its own', () => {
  const all = [...SKILLS, ...ACHIEVEMENTS].map(f => f.species)

  it('has a different species for each activity and award', () => {
    expect(new Set(all.map(s => s.name)).size).toBe(all.length)
  })

  it('has a different outline, so even locked awards are told apart', () => {
    const outlines = all.map(silhouetteOf)
    const repeats = outlines.filter((o, i) => outlines.indexOf(o) !== i)
    expect(repeats).toEqual([])
  })
})

describe('achievements', () => {
  const stats = (over: Partial<TankStats> = {}): TankStats =>
    ({ sessions: [], words: 0, learned: 0, bosses: [], talks: 0, native: false, ...over })

  it('counts the longest run of days', () => {
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'])).toBe(3)
    expect(longestStreak([])).toBe(0)
  })

  it('unlocks with progress shown towards locked ones', () => {
    const awards = achievementFish(stats({ words: 12, bosses: [{ score: 12, total: 15 }] }))
    expect(awards.find(a => a.id === 'award:first-word')!.unlocked).toBe(true)
    expect(awards.find(a => a.id === 'award:words-25')).toMatchObject({ unlocked: false, have: 12, need: 25 })
    expect(awards.find(a => a.id === 'award:boss-beaten')!.unlocked).toBe(true)
  })

  it('needs a round with every answer right for Perfect', () => {
    const awards = (rounds: { game: string, clean: number, total: number }[]) =>
      achievementFish(stats({ sessions: [day(0, ['fix-it'], rounds)] })).find(a => a.id === 'award:perfect-round')!.unlocked
    expect(awards([{ game: 'fix-it', clean: 7, total: 8 }])).toBe(false)
    expect(awards([{ game: 'fix-it', clean: 8, total: 8 }])).toBe(true)
  })

  it('Explorer needs every activity available on this device', () => {
    const all = ['word-recall', 'fix-it', 'sound-hunter', 'sentence-builder', 'gap-radio', 'speed-round', 'listen-pick', 'picture-match', 'file-boss', 'couple-talk']
    const explorer = (native: boolean) => achievementFish(stats({ native, sessions: [day(0, all)] })).find(a => a.id === 'award:all-games')!
    expect(explorer(false).unlocked).toBe(true)
    expect(explorer(true)).toMatchObject({ unlocked: false, have: 10, need: 11 })
  })
})

describe('tankChanges', () => {
  it('announces new fish, hatching, growth and revival', () => {
    const s = (sessions: ReturnType<typeof day>[], words = 0) => ({
      skills: skillFish(sessions, today, false),
      awards: achievementFish({ sessions, words, learned: 0, bosses: [], talks: 0, native: false }),
    })
    const four = Array.from({ length: 4 }, () => 'fix-it')
    const messages = tankChanges(s([day(5, four)]), s([day(5, four), day(0, ['fix-it', 'gap-radio'])], 1))
    expect(messages).toEqual(expect.arrayContaining([
      'New fish: Sprout the guppy! (Save your first word)',
      'Fixer grew into a young blue tang!',
      'Radio the neon tetra hatched!',
    ]))
    const revived = tankChanges(s([day(25, ['fix-it'])]), s([day(25, ['fix-it']), day(0, ['fix-it'])]))
    expect(revived).toContain('Fixer is back to life!')
  })
})
