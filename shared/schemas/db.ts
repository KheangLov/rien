import { z } from 'zod'

// ACE General English levels 4 to 10 use these English File 4th Edition books.
export const BOOKS = [
  'english-file-pre-intermediate-4e',
  'english-file-intermediate-4e',
  'english-file-upper-intermediate-4e',
] as const

export const BOOK_LABELS: Record<Book, string> = {
  'english-file-pre-intermediate-4e': 'English File Pre-Intermediate',
  'english-file-intermediate-4e': 'English File Intermediate',
  'english-file-upper-intermediate-4e': 'English File Upper-Intermediate',
}

// English File Pre-Intermediate 4th edition has 12 Files.
export const FILE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const MISTAKE_TYPES = [
  'tense',
  'third-person-s',
  'plural-s',
  'possessive-s',
  'article',
  'preposition',
  'final-sound',
  // Sounds Khmer does not have: sh/ch, th, v/w.
  'sound',
  'word-order',
  // Words missed while listening (Gap Radio).
  'listening',
  'other',
] as const

export const MISTAKE_LABELS: Record<MistakeType, string> = {
  'tense': 'Verb tense',
  'third-person-s': 'He, she, it + -s',
  'plural-s': 'Plurals',
  'possessive-s': 'Possessive \'s',
  'article': 'a, an, the',
  'preposition': 'Prepositions',
  'final-sound': 'Word endings',
  'sound': 'sh, ch, th, v, w',
  'word-order': 'Word order',
  'listening': 'Listening',
  'other': 'Other',
}

export const bookSchema = z.enum(BOOKS)
export const fileNumberSchema = z.number().int().min(1).max(12)
export const mistakeTypeSchema = z.enum(MISTAKE_TYPES)

// Mirrors ts-fsrs's Card. Dates are coerced so JSON backups restore cleanly.
export const fsrsStateSchema = z.object({
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number().int().min(0).max(3),
  last_review: z.coerce.date().optional(),
})

// A small JPEG (data URL) shown with the word: pictures help words stick.
const imageSchema = z.string().startsWith('data:image/').max(300_000)

const wordFields = {
  // The English word or phrase she has to produce.
  answer: z.string().trim().min(1, 'Type the English word').max(80),
  meaning: z.string().trim().max(200).default(''),
  khmer: z.string().trim().max(200).default(''),
  example: z.string().trim().max(300).default(''),
  image: imageSchema.optional(),
}

const hasCue = (w: { meaning: string, khmer: string, example: string }) =>
  Boolean(w.meaning || w.khmer || w.example)
const cueMessage = { message: 'Add a meaning, a Khmer hint or an example', path: ['meaning'] }

export const newWordSchema = z
  .object({ ...wordFields, book: bookSchema, file: fileNumberSchema })
  .refine(hasCue, cueMessage)

export const cardSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['word', 'grammar']),
    book: bookSchema,
    file: fileNumberSchema,
    ...wordFields,
    // Normalised answer, indexed for duplicate checks.
    answerKey: z.string().min(1),
    fsrs: fsrsStateSchema,
    // Copy of fsrs.due so Dexie can index it.
    due: z.coerce.date(),
    createdAt: z.coerce.date(),
    // First review, for the daily cap on new words.
    introducedAt: z.coerce.date().optional(),
  })
  .refine(hasCue, cueMessage)

export const reviewSchema = z.object({
  id: z.number().int().optional(),
  cardId: z.string().min(1),
  at: z.coerce.date(),
  rating: z.number().int().min(1).max(4),
  correct: z.boolean(),
  typed: z.string().max(200),
  ms: z.number().int().min(0),
})

export const mistakeSchema = z.object({
  id: z.number().int().optional(),
  type: mistakeTypeSchema,
  itemId: z.string().min(1),
  at: z.coerce.date(),
  detail: z.string().max(200).default(''),
})

// Spaced-review state for one Fix It sentence from a content pack.
export const grammarSchema = z.object({
  itemId: z.string().min(1),
  type: mistakeTypeSchema,
  fsrs: fsrsStateSchema,
  due: z.coerce.date(),
})

// The score of one finished round.
export const roundSchema = z.object({
  game: z.string(),
  clean: z.number().int().min(0),
  total: z.number().int().min(0),
})

// One row per day she studied.
export const sessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  games: z.array(z.string()),
  minutes: z.number().min(0),
  // Added for the fish tank; older rows have none.
  rounds: z.array(roundSchema).default([]),
})

// One finished File Boss quiz.
export const bossResultSchema = z.object({
  id: z.number().int().optional(),
  book: bookSchema,
  file: fileNumberSchema,
  at: z.coerce.date(),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
})

// One finished Couple Talk evening.
export const talkResultSchema = z.object({
  id: z.number().int().optional(),
  talkId: z.string().min(1),
  at: z.coerce.date(),
  minutes: z.number().min(0),
})

export const settingsSchema = z.object({
  book: bookSchema.default('english-file-pre-intermediate-4e'),
  // ACE Level 6 is most likely Files 9 to 12 (an estimate; check with her teacher).
  file: fileNumberSchema.default(9),
  khmerHints: z.boolean().default(true),
  // Most words in one Word Recall round.
  dailyGoal: z.number().int().min(1).max(200).default(20),
  // New (never reviewed) words a day; reviews are never capped.
  newPerDay: z.number().int().min(0).max(50).default(10),
  // Study days per week.
  weeklyGoal: z.number().int().min(1).max(7).default(5),
  // Look and feel. Motion also stays off when the phone asks for reduced motion.
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  liquidGlass: z.boolean().default(true),
  motion: z.boolean().default(true),
  // Say It: let iOS use Apple's online recognition (usually more accurate;
  // recordings are processed by Apple). Off keeps recognition on the phone.
  speechOnline: z.boolean().default(false),
  // Daily notification, native app only.
  reminder: z
    .object({
      enabled: z.boolean().default(false),
      hour: z.number().int().min(0).max(23).default(19),
      minute: z.number().int().min(0).max(59).default(0),
    })
    .default({ enabled: false, hour: 19, minute: 0 }),
})

export const backupSchema = z.object({
  app: z.literal('rien'),
  version: z.literal(1),
  exportedAt: z.coerce.date(),
  cards: z.array(cardSchema),
  reviews: z.array(reviewSchema),
  mistakes: z.array(mistakeSchema),
  sessions: z.array(sessionSchema),
  // Added in week 2; older backups have none.
  grammar: z.array(grammarSchema).default([]),
  // Added in week 3.
  bosses: z.array(bossResultSchema).default([]),
  // Added in week 4.
  talks: z.array(talkResultSchema).default([]),
  settings: settingsSchema,
})

export type Book = (typeof BOOKS)[number]
export type MistakeType = (typeof MISTAKE_TYPES)[number]
export type NewWordInput = z.input<typeof newWordSchema>
export type NewWord = z.output<typeof newWordSchema>
export type CardRow = z.output<typeof cardSchema>
export type ReviewRow = z.output<typeof reviewSchema>
export type MistakeRow = z.output<typeof mistakeSchema>
export type SessionRow = z.output<typeof sessionSchema>
export type RoundScore = z.output<typeof roundSchema>
export type GrammarRow = z.output<typeof grammarSchema>
export type BossResult = z.output<typeof bossResultSchema>
export type TalkResult = z.output<typeof talkResultSchema>
export type Settings = z.output<typeof settingsSchema>
export type Backup = z.output<typeof backupSchema>
