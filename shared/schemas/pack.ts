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

// A pack with no book is a core pack and applies at every level.
export const packSchema = z
  .object({
    id: z.string().regex(PACK_ID),
    title: z.string().trim().min(1),
    book: bookSchema.optional(),
    file: fileNumberSchema.optional(),
    fixIt: z.array(fixItItemSchema).default([]),
    soundPairs: z.array(soundPairSchema).default([]),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>()
    const check = (list: 'fixIt' | 'soundPairs', id: string, index: number) => {
      if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [list, index, 'id'], message: `Duplicate id "${id}"` })
      seen.add(id)
    }
    pack.fixIt.forEach((item, index) => check('fixIt', item.id, index))
    pack.soundPairs.forEach((pair, index) => check('soundPairs', pair.id, index))
  })

export const packIndexSchema = z.object({
  packs: z.array(z.string().regex(/^[a-z0-9-]+\.json$/)).min(1),
})

export type FixItItem = z.output<typeof fixItItemSchema>
export type Pack = z.output<typeof packSchema>
export type SoundPair = z.output<typeof soundPairSchema>
export type SoundFocus = (typeof SOUND_FOCUSES)[number]
