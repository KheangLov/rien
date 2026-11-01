import { correctedText, type FixItCard } from './fixit'
import { editDistance, normalizeAnswer } from './answer'
import { shuffle } from './rounds'

// Quick games: Speed Round (right or wrong, against the clock), Listen & Pick
// (hear a word, choose it) and Picture Match (see a picture, choose the word).
// They are for fun and fluency, so they score a round but do not reschedule
// anything; her words and Fix It sentences keep their own reviews.

// --- Built-in picture words ------------------------------------------------------

export interface BankWord {
  word: string
  emoji: string
  // Wrong choices come from the same group, so the picture has to be read.
  group: 'fruit' | 'food' | 'animal' | 'transport' | 'thing' | 'clothes' | 'weather' | 'place' | 'job'
}

export const WORD_BANK: BankWord[] = [
  { word: 'apple', emoji: '🍎', group: 'fruit' },
  { word: 'banana', emoji: '🍌', group: 'fruit' },
  { word: 'mango', emoji: '🥭', group: 'fruit' },
  { word: 'grapes', emoji: '🍇', group: 'fruit' },
  { word: 'watermelon', emoji: '🍉', group: 'fruit' },
  { word: 'pineapple', emoji: '🍍', group: 'fruit' },
  { word: 'coconut', emoji: '🥥', group: 'fruit' },
  { word: 'lemon', emoji: '🍋', group: 'fruit' },
  { word: 'rice', emoji: '🍚', group: 'food' },
  { word: 'bread', emoji: '🍞', group: 'food' },
  { word: 'egg', emoji: '🥚', group: 'food' },
  { word: 'noodles', emoji: '🍜', group: 'food' },
  { word: 'cake', emoji: '🍰', group: 'food' },
  { word: 'ice cream', emoji: '🍦', group: 'food' },
  { word: 'coffee', emoji: '☕', group: 'food' },
  { word: 'milk', emoji: '🥛', group: 'food' },
  { word: 'cheese', emoji: '🧀', group: 'food' },
  { word: 'cat', emoji: '🐈', group: 'animal' },
  { word: 'dog', emoji: '🐕', group: 'animal' },
  { word: 'cow', emoji: '🐄', group: 'animal' },
  { word: 'pig', emoji: '🐖', group: 'animal' },
  { word: 'horse', emoji: '🐎', group: 'animal' },
  { word: 'elephant', emoji: '🐘', group: 'animal' },
  { word: 'monkey', emoji: '🐒', group: 'animal' },
  { word: 'bird', emoji: '🐦', group: 'animal' },
  { word: 'snake', emoji: '🐍', group: 'animal' },
  { word: 'frog', emoji: '🐸', group: 'animal' },
  { word: 'rabbit', emoji: '🐇', group: 'animal' },
  { word: 'duck', emoji: '🦆', group: 'animal' },
  { word: 'buffalo', emoji: '🐃', group: 'animal' },
  { word: 'bus', emoji: '🚌', group: 'transport' },
  { word: 'car', emoji: '🚗', group: 'transport' },
  { word: 'bicycle', emoji: '🚲', group: 'transport' },
  { word: 'motorbike', emoji: '🏍️', group: 'transport' },
  { word: 'train', emoji: '🚆', group: 'transport' },
  { word: 'plane', emoji: '✈️', group: 'transport' },
  { word: 'boat', emoji: '🚤', group: 'transport' },
  { word: 'taxi', emoji: '🚕', group: 'transport' },
  { word: 'book', emoji: '📖', group: 'thing' },
  { word: 'phone', emoji: '📱', group: 'thing' },
  { word: 'computer', emoji: '💻', group: 'thing' },
  { word: 'clock', emoji: '⏰', group: 'thing' },
  { word: 'key', emoji: '🔑', group: 'thing' },
  { word: 'umbrella', emoji: '☂️', group: 'thing' },
  { word: 'camera', emoji: '📷', group: 'thing' },
  { word: 'scissors', emoji: '✂️', group: 'thing' },
  { word: 'shirt', emoji: '👕', group: 'clothes' },
  { word: 'dress', emoji: '👗', group: 'clothes' },
  { word: 'shoes', emoji: '👟', group: 'clothes' },
  { word: 'glasses', emoji: '👓', group: 'clothes' },
  { word: 'cap', emoji: '🧢', group: 'clothes' },
  { word: 'socks', emoji: '🧦', group: 'clothes' },
  { word: 'scarf', emoji: '🧣', group: 'clothes' },
  { word: 'sun', emoji: '☀️', group: 'weather' },
  { word: 'rain', emoji: '🌧️', group: 'weather' },
  { word: 'cloud', emoji: '☁️', group: 'weather' },
  { word: 'snow', emoji: '❄️', group: 'weather' },
  { word: 'rainbow', emoji: '🌈', group: 'weather' },
  { word: 'moon', emoji: '🌙', group: 'weather' },
  { word: 'lightning', emoji: '⚡', group: 'weather' },
  { word: 'house', emoji: '🏠', group: 'place' },
  { word: 'school', emoji: '🏫', group: 'place' },
  { word: 'hospital', emoji: '🏥', group: 'place' },
  { word: 'bank', emoji: '🏦', group: 'place' },
  { word: 'beach', emoji: '🏖️', group: 'place' },
  { word: 'mountain', emoji: '⛰️', group: 'place' },
  { word: 'doctor', emoji: '🧑‍⚕️', group: 'job' },
  { word: 'teacher', emoji: '🧑‍🏫', group: 'job' },
  { word: 'cook', emoji: '🧑‍🍳', group: 'job' },
  { word: 'farmer', emoji: '🧑‍🌾', group: 'job' },
  { word: 'police officer', emoji: '👮', group: 'job' },
]

// Pictures that could fairly be either word: never choices for each other.
const LOOK_ALIKE = [['car', 'taxi'], ['rain', 'cloud'], ['cow', 'buffalo'], ['cap', 'shirt'], ['moon', 'sun']]
const lookAlike = (a: string, b: string) => LOOK_ALIKE.some(pair => pair.includes(a) && pair.includes(b))

// --- Choices ---------------------------------------------------------------------

// Three wrong choices for an answer, the closest-looking first (same first
// letter, similar length, few letters apart), so the choice is not obvious.
export function similarWords(answer: string, pool: readonly string[], count = 3, random: () => number = Math.random): string[] {
  const key = normalizeAnswer(answer)
  const seen = new Set([key])
  const scored = pool
    .filter((word) => {
      const k = normalizeAnswer(word)
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((word) => {
      const k = normalizeAnswer(word)
      const score = (k[0] === key[0] ? 2 : 0)
        + (Math.abs(k.length - key.length) <= 2 ? 1 : 0)
        + (editDistance(k, key) <= Math.max(2, Math.floor(key.length / 3)) ? 3 : 0)
        + random()
      return { word, score }
    })
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map(s => s.word)
}

// Words that sound the same: never both choices in Listen & Pick, where only
// the sound tells them apart.
const HOMOPHONES = [
  ['right', 'write'], ['there', 'their', 'they\'re'], ['to', 'too', 'two'], ['son', 'sun'], ['meet', 'meat'],
  ['see', 'sea'], ['buy', 'by', 'bye'], ['hear', 'here'], ['know', 'no'], ['week', 'weak'], ['eight', 'ate'],
  ['flower', 'flour'], ['one', 'won'], ['road', 'rode'], ['wear', 'where'], ['for', 'four'], ['hour', 'our'],
  ['new', 'knew'], ['blue', 'blew'], ['pair', 'pear'], ['piece', 'peace'], ['plane', 'plain'], ['sale', 'sail'],
  ['tail', 'tale'], ['wait', 'weight'], ['way', 'weigh'], ['whole', 'hole'], ['mail', 'male'], ['night', 'knight'],
]

export function soundsSame(a: string, b: string): boolean {
  const [x, y] = [normalizeAnswer(a), normalizeAnswer(b)]
  return x === y || HOMOPHONES.some(set => set.includes(x) && set.includes(y))
}

export interface ChoiceQuestion {
  answer: string
  options: string[]
  // Picture Match: an emoji or her own photo (a data: URL).
  emoji?: string
  image?: string
}

// --- Listen & Pick ---------------------------------------------------------------

// Words to hear: her own saved words first, topped up from the word bank so a
// round is full even with few saved words. Wrong choices look alike.
export function listenQuestions(saved: readonly string[], size = 8, random: () => number = Math.random): ChoiceQuestion[] {
  const own = shuffle([...new Set(saved.map(w => w.trim()).filter(Boolean))], random)
  const bank = shuffle(WORD_BANK.map(w => w.word), random)
  const pool = [...own, ...bank]
  const answers = [...own.slice(0, Math.ceil(size * 0.6)), ...bank].slice(0, size)
  return answers.map(answer => ({
    answer,
    options: shuffle([answer, ...similarWords(answer, pool.filter(w => !soundsSame(w, answer)), 3, random)], random),
  }))
}

// --- Picture Match ---------------------------------------------------------------

// Her words with photos first, then picture words from the bank; wrong choices
// for a bank picture come from its own group (fruit with fruit).
export function pictureQuestions(
  photos: readonly { answer: string, image: string }[],
  savedWords: readonly string[],
  size = 8,
  random: () => number = Math.random,
): ChoiceQuestion[] {
  const own = shuffle(photos, random).slice(0, Math.ceil(size / 2)).map((card) => {
    const others = [...savedWords, ...WORD_BANK.map(w => w.word)]
    return { answer: card.answer, image: card.image, options: shuffle([card.answer, ...similarWords(card.answer, others, 3, random)], random) }
  })
  const bank = shuffle(WORD_BANK, random).slice(0, size - own.length).map((item) => {
    const group = WORD_BANK.filter(w => w.group === item.group && w.word !== item.word && !lookAlike(w.word, item.word)).map(w => w.word)
    const wrong = shuffle(group, random).slice(0, 3)
    return { answer: item.word, emoji: item.emoji, options: shuffle([item.word, ...wrong], random) }
  })
  return shuffle([...own, ...bank], random)
}

// --- Speed Round -----------------------------------------------------------------

export interface SpeedQuestion {
  itemId: string
  // The sentence shown: the one with the mistake, or the corrected one.
  sentence: string
  correct: boolean
  // The right sentence and why, shown after a wrong tap.
  fixed: string
  explain: string
}

// Fix It sentences, each shown either as written (with its mistake) or
// corrected, half and half at random: is it right or wrong?
export function speedQuestions(cards: readonly FixItCard[], random: () => number = Math.random): SpeedQuestion[] {
  return shuffle(cards, random).map((card) => {
    const fixed = correctedText(card)
    const correct = random() < 0.5
    return { itemId: card.itemId, sentence: correct ? fixed : card.text, correct, fixed, explain: card.explain }
  })
}

// Seconds per Speed Round.
export const SPEED_SECONDS = 60
