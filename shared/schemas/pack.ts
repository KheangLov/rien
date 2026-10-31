import { z } from 'zod'
import { normalizeAnswer } from '../utils/answer'
import { bookSchema, fileNumberSchema, mistakeTypeSchema } from './db'

const PACK_ID = /^[a-z0-9-]+$/

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
  questions: z.array(z.string().trim().min(1).max(160)).length(3),
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
export const packSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    title: z.string().trim().min(1),
    book: bookSchema.optional(),
    file: fileNumberSchema.optional(),
    fixIt: z.array(fixItItemSchema).default([]),
    soundPairs: z.array(soundPairSchema).default([]),
    talks: z.array(talkSchema).default([]),
    builder: z.array(builderSchema).default([]),
    radio: z.array(radioSchema).default([]),
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
export type SoundFocus = (typeof SOUND_FOCUSES)[number]
