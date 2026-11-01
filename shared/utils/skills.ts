import { LEVELS, MISTAKE_LABELS, type Book, type Level, type MistakeType } from '../schemas/db'
import { SOUND_FOCUS_LABELS, type SoundFocus, type TenseTime } from '../schemas/pack'

// --- Levels ---------------------------------------------------------------------

// CEFR levels, with the steps English File's books take between them. ACE's
// General English levels use English File: GEP 1–3 Elementary, 4–6
// Pre-Intermediate, 7–8 Intermediate, 9–10 Upper-Intermediate, 11–12 Ready for
// IELTS (ACE timetable, Term 3 2026).
export { LEVELS, type Level }

// How hard a typical item at each level is, on the skill model's logit scale
// (shared/utils/mastery.ts): one level is about half a step.
export const LEVEL_DIFFICULTY: Record<Level, number> = {
  'A1': -2, 'A2': -1.2, 'A2+': -0.7, 'B1': -0.2, 'B1+': 0.3, 'B2': 0.8, 'B2+': 1.3, 'C1': 1.8,
}

// The level of a File in each book: the first third, the middle and the end.
const BOOK_LEVELS: Record<Book, [Level, Level, Level]> = {
  'english-file-pre-intermediate-4e': ['A2', 'A2+', 'B1'],
  'english-file-intermediate-4e': ['B1', 'B1+', 'B1+'],
  'english-file-upper-intermediate-4e': ['B2', 'B2', 'B2+'],
}

export function levelFor(book: Book | undefined, file: number | undefined, fallback: Level = 'A2'): Level {
  if (!book) return fallback
  const thirds = BOOK_LEVELS[book]
  return thirds[Math.min(2, Math.max(0, Math.floor(((file ?? 1) - 1) / 4)))] ?? fallback
}

// --- Skills ---------------------------------------------------------------------

// Grammar points a content item can name as its skill. Older items name only a
// mistake type; skillOf() turns those into the closest skill here.
export const GRAMMAR_SKILLS = {
  'present-simple': 'Present simple',
  'present-continuous': 'Present continuous',
  'past-simple': 'Past simple',
  'past-continuous': 'Past continuous',
  'used-to': 'used to',
  'present-perfect': 'Present perfect',
  'present-perfect-continuous': 'Present perfect continuous',
  'past-perfect': 'Past perfect',
  'future-forms': 'Future forms',
  'conditionals': 'Conditionals',
  'passive': 'The passive',
  'modals': 'Modal verbs',
  'modals-deduction': 'must, might, can\'t (guessing)',
  'relative-clauses': 'Relative clauses',
  'reported-speech': 'Reported speech',
  'verb-patterns': 'Verb + -ing or to',
  'comparatives': 'Comparing',
  'quantifiers': 'much, many, a few, enough',
  'question-forms': 'Questions',
  'articles': 'a, an, the',
  'prepositions': 'Prepositions',
  'third-person-s': 'He, she, it + -s',
  'plural-s': 'Plurals',
  'possessive-s': 'Possessive \'s',
  'word-order': 'Word order',
  'phrasal-verbs': 'Phrasal verbs',
  'linkers': 'Linking words',
} as const
export type GrammarSkill = keyof typeof GRAMMAR_SKILLS
export const GRAMMAR_SKILL_IDS = Object.keys(GRAMMAR_SKILLS) as [GrammarSkill, ...GrammarSkill[]]

// Skills that are not grammar points.
const OTHER_SKILLS: Record<string, string> = {
  'vocabulary': 'Words',
  'listening': 'Listening',
  'speaking': 'Speaking',
  'other': 'Other',
}

// A tense item's timeline (its `when`) names the tense it practises.
const TENSE_SKILL: Record<TenseTime, GrammarSkill> = {
  'past': 'past-simple',
  'past-continuous': 'past-continuous',
  'past-habit': 'used-to',
  'earlier-past': 'past-perfect',
  'past-to-now': 'present-perfect',
  'now': 'present-continuous',
  'always': 'present-simple',
  'future': 'future-forms',
  'imagined': 'conditionals',
}

const TYPE_SKILL: Partial<Record<MistakeType, string>> = {
  'article': 'articles',
  'preposition': 'prepositions',
  'third-person-s': 'third-person-s',
  'plural-s': 'plural-s',
  'possessive-s': 'possessive-s',
  'word-order': 'word-order',
  'listening': 'listening',
  'final-sound': 'sound:final-consonant',
}

// The skill a Fix It or Sentence Builder item trains: its own `skill` if it
// names one, else worked out from its mistake type (and timeline, for tenses).
export function skillOf(item: { skill?: string, type?: MistakeType, when?: TenseTime }): string {
  if (item.skill) return item.skill
  if (item.type === 'tense') return item.when ? TENSE_SKILL[item.when] : 'past-simple'
  return (item.type && TYPE_SKILL[item.type]) ?? item.type ?? 'other'
}

export const soundSkill = (focus: SoundFocus) => `sound:${focus}`

export function skillLabel(skill: string): string {
  if (skill.startsWith('sound:')) return `Hearing ${SOUND_FOCUS_LABELS[skill.slice(6) as SoundFocus] ?? 'sounds'}`
  return (GRAMMAR_SKILLS as Record<string, string>)[skill] ?? OTHER_SKILLS[skill] ?? MISTAKE_LABELS[skill as MistakeType] ?? skill
}

// Skills whose slips are verb-form slips ("Verb tense").
const VERB_FORM_SKILLS = new Set<string>([...Object.values(TENSE_SKILL), 'present-perfect-continuous', 'passive', 'reported-speech'])

// The mistake type a skill's slips are filed under (My slips, Fix It's mix).
export function mistakeTypeOf(skill: string): MistakeType {
  if (skill.startsWith('sound:')) return skill === 'sound:final-consonant' || skill === 'sound:final-s' || skill === 'sound:final-ed' ? 'final-sound' : 'sound'
  const byType = Object.entries(TYPE_SKILL).find(([, s]) => s === skill)?.[0] as MistakeType | undefined
  if (byType) return byType
  if (VERB_FORM_SKILLS.has(skill)) return 'tense'
  if (skill === 'listening') return 'listening'
  return 'other'
}
