import type { Level } from '../schemas/db'

// IELTS helpers: an estimated band from the skill model's level, feedback on
// spoken answers (from the phone's transcript) and checks on written ones.
// None of this is an official score: only an examiner gives a band.

// --- Band estimate --------------------------------------------------------------------

// IELTS's own alignment of bands with CEFR: B1 4.0–5.0, B2 5.5–6.5, C1 7.0–8.0.
// Rien's in-between steps sit at the ends of each range.
const BAND_FOR_LEVEL: Record<Level, string> = {
  'A1': 'below 3.5',
  'A2': '3.5–4.0',
  'A2+': '4.0',
  'B1': '4.5–5.0',
  'B1+': '5.0–5.5',
  'B2': '5.5–6.0',
  'B2+': '6.0–6.5',
  'C1': '7.0 or higher',
}

export const bandFor = (level: Level) => BAND_FOR_LEVEL[level]

// --- Words ------------------------------------------------------------------------------

const words = (text: string) => text.toLowerCase().replace(/[’']/g, '\'').match(/[a-z]+(?:'[a-z]+)?/g) ?? []

export const countWords = (text: string) => words(text).length

// Linking words examiners look for (coherence and cohesion), longest first so
// "on the other hand" is found before "hand".
export const LINKING_WORDS = [
  'on the other hand', 'in addition', 'as a result', 'for example', 'for instance', 'in conclusion', 'to sum up',
  'in my opinion', 'in my view', 'even though', 'as well as', 'because of', 'such as', 'apart from',
  'however', 'although', 'therefore', 'moreover', 'furthermore', 'whereas', 'while', 'because', 'since',
  'firstly', 'secondly', 'finally', 'overall', 'also', 'but', 'so', 'unless', 'despite', 'instead', 'meanwhile',
] as const

export function linkingWordsIn(text: string): string[] {
  let rest = ` ${words(text).join(' ')} `
  const found: string[] = []
  for (const link of LINKING_WORDS) {
    const needle = ` ${link} `
    if (rest.includes(needle)) {
      found.push(link)
      rest = rest.split(needle).join(' ')
    }
  }
  return found
}

// --- Speaking ----------------------------------------------------------------------------

// Sounds and phrases that fill silence. "Like" is left out: it is too often a real word.
const FILLERS = ['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'you know', 'i mean']

export interface SpeakingFeedback {
  words: number
  wordsPerMinute: number
  fillers: number
  linking: string[]
  // Different words as a share of all words (higher = more varied).
  variety: number
  // What to work on next, most useful first.
  tips: string[]
}

// Part 1 answers should be a few sentences; Part 2 about two minutes; Part 3 longer answers with reasons.
const AIMS = { 1: 20, 2: 180, 3: 40 } as const

export function speakingFeedback(transcript: string, seconds: number, part: 1 | 2 | 3): SpeakingFeedback {
  const list = words(transcript)
  const joined = ` ${list.join(' ')} `
  const fillers = FILLERS.reduce((n, f) => n + (joined.split(` ${f} `).length - 1), 0)
  const linking = linkingWordsIn(transcript)
  const wordsPerMinute = seconds > 0 ? Math.round(list.length / (seconds / 60)) : 0
  const variety = list.length ? new Set(list).size / list.length : 0
  const tips: string[] = []
  if (list.length < AIMS[part]) {
    tips.push(part === 2
      ? 'Keep talking for the full two minutes: use every point on the card, and add an example or a story.'
      : 'Say more: answer, then give a reason and an example.')
  }
  if (linking.length < (part === 1 ? 1 : 3)) tips.push('Join your ideas with linking words: because, so, however, for example.')
  if (list.length > 20 && fillers / list.length > 0.05) tips.push('Fewer "um" and "er": pause silently, or use "Let me think…" once.')
  if (wordsPerMinute > 0 && wordsPerMinute < 90 && list.length > 15) tips.push('Try to speak a little faster and more smoothly; it\'s fine to make small mistakes.')
  if (list.length > 40 && variety < 0.45) tips.push('Use more different words: try a synonym instead of repeating the same word.')
  if (tips.length === 0) tips.push('Well done. Next time, add one more detail or example to each answer.')
  return { words: list.length, wordsPerMinute, fillers, linking, variety, tips }
}

// --- Writing ------------------------------------------------------------------------------

export interface WritingCheck {
  label: string
  ok: boolean
  detail: string
}

export interface WritingFeedback {
  words: number
  paragraphs: number
  linking: string[]
  academic: string[]
  contractions: number
  // Content words used four times or more.
  repeated: string[]
  checks: WritingCheck[]
}

const STOP_WORDS = new Set(('the a an and or but of to in on at for with is are was were be been it its this that these those '
  + 'i you he she we they my your his her our their there have has had do does did not no as by from so if than then more most '
  + 'can could will would should may might also very many much some any which who what when where how why all one two people').split(' '))

export function writingFeedback(text: string, task: 1 | 2, academicWords: readonly string[]): WritingFeedback {
  const list = words(text)
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).length
  const linking = linkingWordsIn(text)
  const academicSet = new Set(academicWords.map(w => w.toLowerCase()))
  const academic = [...new Set(list.filter(w => academicSet.has(w) || [...academicSet].some(a => a.length > 4 && w.startsWith(a.slice(0, -1)))))]
  const contractions = list.filter(w => /'(s|t|re|ve|ll|d|m)$/.test(w) && !/'s$/.test(w)).length
  const counts = new Map<string, number>()
  for (const w of list) if (!STOP_WORDS.has(w) && w.length > 3) counts.set(w, (counts.get(w) ?? 0) + 1)
  const repeated = [...counts.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).map(([w]) => w)
  const minimum = task === 1 ? 150 : 250
  const lower = text.toLowerCase()
  const checks: WritingCheck[] = [
    { label: `At least ${minimum} words`, ok: list.length >= minimum, detail: `${list.length} words. Fewer than ${minimum} loses marks.` },
    { label: task === 1 ? 'An overview of the main trends' : 'Your opinion is clear', ok: task === 1 ? /\b(overall|in general|it is clear)\b/.test(lower) : /\b(i (strongly )?(believe|think|agree|disagree)|in my (opinion|view))\b/.test(lower), detail: task === 1 ? 'Start one paragraph with "Overall," and say what stands out most.' : 'Say what you think early, and again at the end.' },
    { label: task === 1 ? 'Three or more paragraphs' : 'Four or more paragraphs', ok: paragraphs >= (task === 1 ? 3 : 4), detail: `${paragraphs} paragraph${paragraphs === 1 ? '' : 's'}. Leave an empty line between paragraphs.` },
    { label: 'Five or more different linking words', ok: linking.length >= 5, detail: linking.length ? `Used: ${linking.join(', ')}.` : 'Try: however, for example, as a result, in addition.' },
    { label: 'No contractions', ok: contractions === 0, detail: contractions ? `${contractions} found: write "do not", not "don't", in academic writing.` : 'Good: full forms throughout.' },
    { label: 'No word used too often', ok: repeated.length === 0, detail: repeated.length ? `Find other words for: ${repeated.slice(0, 4).join(', ')}.` : 'Good variety.' },
  ]
  if (task === 2) {
    checks.push({ label: 'A conclusion', ok: /\b(in conclusion|to sum up|to conclude|overall)\b/.test(lower), detail: 'End with a short paragraph starting "In conclusion,".' })
  }
  return { words: list.length, paragraphs, linking, academic, contractions, repeated, checks }
}

// --- Listening forms -----------------------------------------------------------------------

const NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
}

// Spelling counts in IELTS, so letters must match; capitals, spaces, "the"
// before a date and small number words do not.
export function formAnswerRight(typed: string, answer: string, accept: readonly string[] = []): boolean {
  const norm = (s: string) => s.toLowerCase().trim()
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g, w => NUMBERS[w]!)
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/\bthe\b|\bof\b/g, '')
    .replace(/[^a-z0-9]/g, '')
  const t = norm(typed)
  return t.length > 0 && [answer, ...accept].some(a => norm(a) === t)
}
