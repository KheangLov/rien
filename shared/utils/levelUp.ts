import { BOOKS, type Book } from '../schemas/db'
import { predict, type Model } from './mastery'
import type { Level } from './skills'

// When to suggest moving up a File or a book. She decides; the app only says
// when the evidence is there: the skill model expects her to know most of her
// File's sentences, from enough of her answers, and she has passed its File Boss.

// Files in each book (OUP contents pages): Pre-Intermediate has 12,
// Intermediate and Upper-Intermediate 10.
export const FILES_IN_BOOK: Record<Book, number> = {
  'english-file-pre-intermediate-4e': 12,
  'english-file-intermediate-4e': 10,
  'english-file-upper-intermediate-4e': 10,
}

// ACE's General English levels that use each book (Term 3 2026 timetable).
export const ACE_LEVELS_FOR_BOOK: Record<Book, string> = {
  'english-file-pre-intermediate-4e': 'GEP 4–6',
  'english-file-intermediate-4e': 'GEP 7–8',
  'english-file-upper-intermediate-4e': 'GEP 9–10',
}

// The model's expected share of her File's sentences she knows.
export const MASTERY_TO_MOVE = 0.75
// Answers on the File's sentences before the model's view counts.
export const ANSWERS_TO_MOVE = 15
// The File Boss score that counts as a pass.
export const BOSS_PASS = 0.8
// "Not yet" hides the suggestion for this long.
export const SNOOZE_DAYS = 7

export interface Place { book: Book, file: number }

export function nextPlace({ book, file }: Place): Place | null {
  if (file < FILES_IN_BOOK[book]) return { book, file: file + 1 }
  const next = BOOKS[BOOKS.indexOf(book) + 1]
  return next ? { book: next, file: 1 } : null
}

export interface LevelSuggestion {
  to: Place
  // Moving to a new book (and ACE level), not just the next File.
  newBook: boolean
  // Share of her File's sentences the model expects her to know.
  mastery: number
  answers: number
  boss: { score: number, total: number }
}

export function suggestLevel(input: {
  place: Place
  // Her File's sentences (Fix It and Sentence Builder).
  items: readonly { itemId: string, skill: string, level: Level }[]
  model: Model
  // File Boss results for this File.
  bosses: readonly { score: number, total: number }[]
  // "Not yet" for this File, until this time.
  snoozedUntil?: Date
  now: Date
}): LevelSuggestion | null {
  const { place, items, model, now } = input
  if (input.snoozedUntil && input.snoozedUntil > now) return null
  const to = nextPlace(place)
  if (!to || items.length === 0) return null
  const answers = items.reduce((n, item) => n + (model.items.get(item.itemId)?.n ?? 0), 0)
  if (answers < ANSWERS_TO_MOVE) return null
  const mastery = items.reduce((sum, item) => sum + predict(model, item, now), 0) / items.length
  if (mastery < MASTERY_TO_MOVE) return null
  const boss = [...input.bosses].sort((a, b) => b.score / b.total - a.score / a.total)[0]
  if (!boss || boss.score / boss.total < BOSS_PASS) return null
  return { to, newBook: to.book !== place.book, mastery, answers, boss }
}
