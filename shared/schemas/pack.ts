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

export const soundPairSchema = z.object({
  a: z.string().trim().min(1),
  b: z.string().trim().min(1),
  focus: z.string().trim().min(1),
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
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>()
    pack.fixIt.forEach((item, index) => {
      if (seen.has(item.id)) {
        ctx.addIssue({ code: 'custom', path: ['fixIt', index, 'id'], message: `Duplicate id "${item.id}"` })
      }
      seen.add(item.id)
    })
  })

export const packIndexSchema = z.object({
  packs: z.array(z.string().regex(/^[a-z0-9-]+\.json$/)).min(1),
})

export type FixItItem = z.output<typeof fixItItemSchema>
export type Pack = z.output<typeof packSchema>
