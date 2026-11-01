import { z } from 'zod'
import { normalizeAnswer } from '../utils/answer'
import { bookSchema, fileNumberSchema, LEVELS, mistakeTypeSchema } from './db'

const PACK_ID = /^[a-z0-9-]+$/
// A grammar point from shared/utils/skills.ts (GRAMMAR_SKILLS); the pack tests
// check the name is one of them.
const skillSchema = z.string().regex(/^[a-z-]+$/).optional()
// Overrides the pack's level for one harder or easier item.
const levelSchema = z.enum(LEVELS).optional()

// When a tense sentence happens, for its timeline picture. Set by hand on every
// tense item: guessing from time words gets "didn't see … today" and "since"
// wrong, and a wrong picture teaches the wrong rule.
export const TENSE_TIMES = [
  'past', 'past-continuous', 'past-habit', 'earlier-past', 'past-to-now', 'now', 'always', 'future', 'imagined',
] as const
export type TenseTime = typeof TENSE_TIMES[number]

// Each Fix It sentence has exactly one mistake, in one word she can tap.
// A missing word (often an article) is marked on the word next to the gap:
// "My mother is teacher" taps "teacher" and fixes it to "a teacher".
export const fixItItemSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    text: z.string().trim().min(3).max(200),
    wrong: z.string().trim().min(1),
    fix: z.string().trim().min(1),
    // Other choices, all wrong in this sentence.
    distractors: z.array(z.string().trim().min(1)).min(1).max(3),
    type: mistakeTypeSchema,
    explain: z.string().trim().min(1).max(200),
    // Optional so one missing value never stops a whole pack loading; the pack
    // tests require it on every tense item.
    when: z.enum(TENSE_TIMES).optional(),
    skill: skillSchema,
    level: levelSchema,
  })
  .superRefine((item, ctx) => {
    const key = normalizeAnswer(item.wrong)
    const matches = item.text.split(/\s+/).filter(token => normalizeAnswer(token) === key).length
    if (matches !== 1) {
      ctx.addIssue({ code: 'custom', path: ['wrong'], message: `"${item.wrong}" must appear exactly once in the sentence (found ${matches})` })
    }
    const choices = [item.fix, ...item.distractors].map(normalizeAnswer)
    if (new Set(choices).size !== choices.length) {
      ctx.addIssue({ code: 'custom', path: ['distractors'], message: 'Choices must all be different' })
    }
    if (choices.includes(key)) {
      ctx.addIssue({ code: 'custom', path: ['distractors'], message: 'A choice repeats the mistake itself' })
    }
  })

export const SOUND_FOCUSES = ['final-s', 'final-ed', 'final-consonant', 'sh-ch', 'th', 'v-w'] as const

export const SOUND_FOCUS_LABELS: Record<SoundFocus, string> = {
  'final-s': '-s endings',
  'final-ed': '-ed endings',
  'final-consonant': 'final b/p, d/t, g/k',
  'sh-ch': 'sh and ch',
  'th': 'th',
  'v-w': 'v and w',
}

export const SOUND_FOCUS_TIPS: Record<SoundFocus, string> = {
  'final-s': 'Listen for the /s/ or /z/ at the very end.',
  'final-ed': 'Listen for the /t/, /d/ or /ɪd/ of -ed at the end.',
  'final-consonant': 'Listen to the last sound: is it voiced (b, d, g) or not (p, t, k)?',
  'sh-ch': 'sh is a long soft sound; ch starts with a short stop, like t + sh.',
  'th': 'th is made with the tongue between the teeth.',
  'v-w': 'v uses the top teeth on the lip; w uses round lips and no teeth.',
}

// Two words that differ in one sound she may not hear yet.
export const soundPairSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    a: z.string().trim().min(1),
    b: z.string().trim().min(1),
    focus: z.enum(SOUND_FOCUSES),
  })
  .refine(pair => normalizeAnswer(pair.a) !== normalizeAnswer(pair.b), { message: 'The two words must differ', path: ['b'] })

// An evening conversation prompt for the two of them: three questions that
// pull in one grammar point, and a tip naming it.
export const talkSchema = z.object({
  id: z.string().regex(PACK_ID),
  topic: z.string().trim().min(1).max(60),
  focus: mistakeTypeSchema,
  tip: z.string().trim().min(1).max(160),
  // Asked one at a time, taking turns.
  questions: z.array(z.string().trim().min(1).max(160)).min(3).max(8),
  // Ways to begin an answer, for the grammar this topic practises.
  starters: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
})

// Sentence Builder: the words of `text` are shuffled and she puts them in order.
export const builderSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    text: z.string().trim().min(3).max(120),
    // Other orders that are also correct.
    alternatives: z.array(z.string().trim().min(3)).default([]),
    // Keep the first word's capital letter on its tile (for "I" and names).
    keepFirstCapital: z.boolean().default(false),
    tip: z.string().trim().min(1).max(160),
    skill: skillSchema,
    level: levelSchema,
  })
  .superRefine((item, ctx) => {
    const words = item.text.split(/\s+/)
    if (words.length < 3 || words.length > 12) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'Use 3 to 12 words' })
    }
    const key = (t: string) => t.split(/\s+/).map(normalizeAnswer).sort().join(' ')
    item.alternatives.forEach((alt, index) => {
      if (key(alt) !== key(item.text)) {
        ctx.addIssue({ code: 'custom', path: ['alternatives', index], message: 'An alternative must use the same words' })
      }
    })
  })

// Gap Radio: a short text read aloud with some words blanked.
export const radioSchema = z.object({
  id: z.string().regex(PACK_ID),
  title: z.string().trim().min(1).max(60),
  text: z.string().trim().min(40).max(700),
})

// A pack with no book is a core pack and applies at every level.
// --- IELTS (original practice material in the exam's formats) -------------------

// Speaking Part 1 (a topic and short questions), or Part 2 (a cue card: talk
// for two minutes) with its Part 3 discussion questions.
export const ieltsSpeakingSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    part: z.union([z.literal(1), z.literal(2)]),
    topic: z.string().trim().min(1).max(60),
    // Part 1: the questions. Part 2: the Part 3 discussion that follows.
    questions: z.array(z.string().trim().min(1).max(200)).min(3).max(6),
    cue: z.string().trim().max(120).optional(),
    points: z.array(z.string().trim().min(1).max(80)).default([]),
  })
  .refine(s => s.part === 1 || (s.cue && s.points.length >= 3), { message: 'A Part 2 card needs a cue and at least three points', path: ['cue'] })

const chartSchema = z.object({
  title: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(30),
  labels: z.array(z.string().trim().min(1)).min(2).max(8),
  series: z.array(z.object({ name: z.string().trim().min(1), data: z.array(z.number()) })).min(1).max(4),
})

// Writing Task 1 (describe a chart, 150 words, 20 minutes) or Task 2 (an
// essay, 250 words, 40 minutes).
export const ieltsWritingSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    task: z.union([z.literal(1), z.literal(2)]),
    prompt: z.string().trim().min(20).max(400),
    chart: chartSchema.optional(),
  })
  .superRefine((w, ctx) => {
    if (w.task === 1 && !w.chart) ctx.addIssue({ code: 'custom', path: ['chart'], message: 'Task 1 needs a chart' })
    for (const [i, s] of (w.chart?.series ?? []).entries()) {
      if (s.data.length !== w.chart!.labels.length) ctx.addIssue({ code: 'custom', path: ['chart', 'series', i], message: 'One value per label' })
    }
  })

// Reading: a short text and True / False / Not Given statements.
export const ieltsReadingSchema = z.object({
  id: z.string().regex(PACK_ID),
  title: z.string().trim().min(1).max(80),
  text: z.string().trim().min(200).max(1600),
  statements: z.array(z.object({
    id: z.string().regex(PACK_ID),
    text: z.string().trim().min(5).max(200),
    answer: z.enum(['true', 'false', 'not-given']),
    why: z.string().trim().min(5).max(200),
  })).min(4).max(7),
})

// Listening: a conversation read aloud, and a form to complete (names spelled,
// numbers, dates: where marks are often lost).
export const ieltsListeningSchema = z.object({
  id: z.string().regex(PACK_ID),
  title: z.string().trim().min(1).max(80),
  intro: z.string().trim().min(5).max(200),
  lines: z.array(z.object({ speaker: z.enum(['A', 'B']), text: z.string().trim().min(1).max(300) })).min(4),
  form: z.array(z.object({
    id: z.string().regex(PACK_ID),
    label: z.string().trim().min(1).max(60),
    answer: z.string().trim().min(1).max(40),
    // Other ways to write the same answer ("2" for "two").
    accept: z.array(z.string().trim().min(1)).default([]),
  })).min(4).max(8),
})

// A word from the Academic Word List (Coxhead, 2000), with Rien's own meaning
// and example.
export const academicWordSchema = z.object({
  word: z.string().trim().min(2).max(30),
  meaning: z.string().trim().min(3).max(120),
  example: z.string().trim().min(5).max(160),
})

export const packSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    title: z.string().trim().min(1),
    book: bookSchema.optional(),
    file: fileNumberSchema.optional(),
    // CEFR level of the pack; worked out from the book and File when left out.
    level: z.enum(LEVELS).optional(),
    fixIt: z.array(fixItItemSchema).default([]),
    soundPairs: z.array(soundPairSchema).default([]),
    talks: z.array(talkSchema).default([]),
    builder: z.array(builderSchema).default([]),
    radio: z.array(radioSchema).default([]),
    ieltsSpeaking: z.array(ieltsSpeakingSchema).default([]),
    ieltsWriting: z.array(ieltsWritingSchema).default([]),
    ieltsReading: z.array(ieltsReadingSchema).default([]),
    ieltsListening: z.array(ieltsListeningSchema).default([]),
    academicWords: z.array(academicWordSchema).default([]),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>()
    const check = (list: 'fixIt' | 'soundPairs' | 'talks' | 'builder' | 'radio', id: string, index: number) => {
      if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [list, index, 'id'], message: `Duplicate id "${id}"` })
      seen.add(id)
    }
    pack.fixIt.forEach((item, index) => check('fixIt', item.id, index))
    pack.soundPairs.forEach((pair, index) => check('soundPairs', pair.id, index))
    pack.talks.forEach((talk, index) => check('talks', talk.id, index))
    pack.builder.forEach((item, index) => check('builder', item.id, index))
    pack.radio.forEach((item, index) => check('radio', item.id, index))
  })

export const packIndexSchema = z.object({
  packs: z.array(z.string().regex(/^[a-z0-9-]+\.json$/)).min(1),
})

export type FixItItem = z.output<typeof fixItItemSchema>
export type Pack = z.output<typeof packSchema>
export type SoundPair = z.output<typeof soundPairSchema>
export type Talk = z.output<typeof talkSchema>
export type BuilderItem = z.output<typeof builderSchema>
export type RadioText = z.output<typeof radioSchema>
export type IeltsSpeaking = z.output<typeof ieltsSpeakingSchema>
export type IeltsWriting = z.output<typeof ieltsWritingSchema>
export type IeltsReading = z.output<typeof ieltsReadingSchema>
export type IeltsListening = z.output<typeof ieltsListeningSchema>
export type AcademicWord = z.output<typeof academicWordSchema>
export type SoundFocus = (typeof SOUND_FOCUSES)[number]
