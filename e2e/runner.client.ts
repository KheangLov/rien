// End-to-end run through the real screens, included only in builds made with
// RIEN_E2E=1 (see nuxt.config.ts). It taps and types like a person would,
// works out the right answers from the content packs, and logs each step as
// "[e2e] PASS …" or "[e2e] FAIL …", ending with "[e2e] DONE pass=… fail=…".
// "[e2e] SCREEN name" asks the host script for a screenshot.
// The same build runs in the iOS simulator and in Chrome.
import { Capacitor } from '@capacitor/core'
import { defineNuxtPlugin, navigateTo } from '#app'
import type { Pack } from '#shared/schemas/pack'
import { normalizeAnswer } from '#shared/utils/answer'
import { builderCards } from '#shared/utils/builder'
import { WORD_BANK } from '#shared/utils/quick'
import { GAP_EVERY, radioAnswers, radioTokens } from '#shared/utils/radio'
import { useDb } from '~/composables/useDb'
import { loadIelts } from '~/composables/useIelts'
import { resetLearner, useLearner, weakSkills, workingLevelOf } from '~/composables/useLearner'
import { usePacks } from '~/composables/usePacks'

const WORDS = [
  { answer: 'borrow', meaning: 'to take something and give it back later', example: 'Can I borrow your pen?' },
  { answer: 'walked', meaning: 'went somewhere on foot (past)', khmer: 'ដើរ' },
  { answer: 'wants', meaning: 'he or she would like', example: 'She wants two apples.' },
]

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const log = (line: string) => console.log(`[e2e] ${line}`)
const text = () => (document.querySelector('main') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ') ?? ''

async function waitFor<T>(find: () => T | undefined | null | false, what: string, timeout = 8000): Promise<T> {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const found = find()
    if (found) return found
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${what}`)
}

// Case-insensitive (some headings are styled in capitals, which innerText
// reports), and over the whole page: sheets and pinned bars live outside <main>.
const pageText = () => document.body.innerText.replace(/\s+/g, ' ')
const waitText = (needle: string, timeout?: number) =>
  waitFor(() => pageText().toLowerCase().includes(needle.toLowerCase()), `"${needle}"`, timeout)

// Fails if any text field is under 16px (iOS zooms the page when one gets focus)
// or the page is wider than the screen, then asks for a screenshot.
async function screen(name: string) {
  const small = [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
    .filter(el => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
  if (small.length) throw new Error(`${small.length} text field(s) under 16px on ${name}`)
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    throw new Error(`${name} is wider than the screen (${document.documentElement.scrollWidth} > ${window.innerWidth})`)
  }
  // Nothing may stick out of a list or card (Squirkle's own shape layers excepted).
  const spill = [...document.querySelectorAll('.rien-list, .sq-card')].flatMap((box) => {
    const b = box.getBoundingClientRect()
    return [...box.querySelectorAll<HTMLElement>('*')].filter((el) => {
      if (el.closest('.sq-shape-layers, .sq-shape')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && (r.right > b.right + 1 || r.left < b.left - 1)
    })
  })
  if (spill.length) throw new Error(`${spill.length} element(s) stick out of a card on ${name}, e.g. ${spill[0]!.className || spill[0]!.tagName}`)
  log(`SCREEN ${name}`)
  // Time for the host script to take the picture: only the phone scripts do.
  if (Capacitor.isNativePlatform()) await sleep(1500)
}

function button(label: string, root: ParentNode = document): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('button, a')]
    .find(b => (b.textContent?.trim().startsWith(label) || b.getAttribute('aria-label') === label) && !(b as HTMLButtonElement).disabled)
}

async function click(label: string, root?: ParentNode) {
  ;(await waitFor(() => button(label, root), `button "${label}"`)).click()
  await sleep(250)
}

function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function fill(label: string, value: string) {
  const field = await waitFor(() => {
    const lab = [...document.querySelectorAll('label')].find(l => l.textContent?.trim().startsWith(label))
    return (lab?.htmlFor && document.getElementById(lab.htmlFor) as HTMLInputElement | null)
      || lab?.closest('.sq-field')?.querySelector<HTMLInputElement>('input, textarea')
      || lab?.parentElement?.parentElement?.querySelector<HTMLInputElement>('input, textarea')
      || document.querySelector<HTMLInputElement>(`input[aria-label="${label}"], textarea[aria-label="${label}"]`)
  }, `field "${label}"`)
  setValue(field, value)
}

// Puts a generated picture into a file input, as if chosen from the library.
async function choosePictureIn(input: HTMLInputElement) {
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 400
  const g = canvas.getContext('2d')!
  g.fillStyle = '#0ea5e9'
  g.fillRect(0, 0, 600, 400)
  g.fillStyle = '#facc15'
  g.beginPath()
  g.arc(300, 200, 120, 0, Math.PI * 2)
  g.fill()
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'))
  const files = new DataTransfer()
  files.items.add(new File([blob], 'pen.png', { type: 'image/png' }))
  input.files = files.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

async function goTo(path: string, ready: string) {
  await navigateTo(path)
  await waitText(ready)
  await sleep(300)
}

// --- One handler per activity --------------------------------------------------

async function playRecall(options: { hintFirst?: boolean, wrongFirst?: Record<string, string> } = {}) {
  const wrongFirst = { ...options.wrongFirst }
  let hinted = !options.hintFirst
  const seen = new Set<string>()
  for (let i = 0; i < 8 && !text().includes('Round done') && !text().includes('Nice work') && !text().includes('Session complete'); i++) {
    const cue = (await waitFor(() => document.querySelector('.rien-cue'), 'word cue')).textContent!.trim()
    const word = WORDS.find(w => w.meaning === cue)
    if (!word) throw new Error(`unknown cue "${cue}"`)
    if (!hinted) {
      await click('Hint')
      const hint = (await waitFor(() => document.querySelector('.rien-hint'), 'hint')).textContent!
      if (hint[0] !== word.answer[0]) throw new Error(`hint "${hint}" does not start the word`)
      hinted = true
      await fill('Type the English word', word.answer)
      await click('Check')
      await waitText('Right, with a hint')
      await click('Next')
      seen.add(word.answer)
      continue
    }
    if (word.answer === 'borrow' && !document.querySelector('.rien-word-image')) throw new Error('borrow should show its picture')
    const wrong = wrongFirst[word.answer]
    delete wrongFirst[word.answer]
    await fill('Type the English word', wrong ?? word.answer)
    await click('Check')
    if (wrong && word.answer === 'walked') await waitText('Check the ending: -ed')
    const back = document.querySelector('.rien-next-review')?.textContent ?? ''
    if (!/comes back|see you/i.test(back)) throw new Error(`no "comes back" line, got "${back}"`)
    if (text().includes('Type it once')) {
      if (button('Next')) throw new Error('Next is enabled before the word is retyped')
      await screen('word-recall-retype')
      await fill('Type it once', word.answer)
    }
    await click('Next')
    seen.add(word.answer)
  }
  return [...seen].join(', ')
}

function fixItAnswer(packs: Pack[], sentence: string) {
  const item = packs.flatMap(p => p.fixIt).find(i => i.text === sentence)
  if (!item) throw new Error(`no Fix It item for "${sentence}"`)
  const index = item.text.split(/\s+/).findIndex(t => normalizeAnswer(t) === normalizeAnswer(item.wrong))
  return { index, fix: item.fix }
}

async function answerFixIt(packs: Pack[]) {
  const sentence = (await waitFor(() => document.querySelector('.rien-sentence'), 'sentence')).getAttribute('aria-label')!
  const { index, fix } = fixItAnswer(packs, sentence)
  document.querySelectorAll<HTMLButtonElement>('.rien-token')[index]!.click()
  await sleep(200)
  ;(await waitFor(() => [...document.querySelectorAll<HTMLElement>('.rien-choices button')]
    .find(b => b.textContent?.trim() === fix), `choice "${fix}"`)).click()
  await sleep(300)
}

async function playFixIt(packs: Pack[]) {
  for (let i = 0; i < 8; i++) {
    await answerFixIt(packs)
    if (i === 0) {
      await waitFor(() => document.querySelector('.rien-rule'), 'rule picture')
      await screen('fix-it-rule')
    }
    await click('Next')
  }
}

async function answerSound() {
  await click('Play')
  ;(await waitFor(() => document.querySelector<HTMLButtonElement>('.rien-pair button:not([disabled])'), 'sound choice')).click()
  await sleep(300)
}

async function playSounds() {
  for (let i = 0; i < 10; i++) {
    await answerSound()
    await click('Next')
  }
}

const tileWords = (sentence: string) =>
  sentence.replace(/[.?!]$/, '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'-]/gu, ''))

async function playBuilder(packs: Pack[], wrongFirst: boolean) {
  const items = builderCards(packs)
  for (let i = 0; i < 6; i++) {
    const tiles = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Words to place"] .rien-token')]
      return found.length ? found : undefined
    }, 'tiles')
    const key = (words: string[]) => words.map(w => w.toLowerCase()).sort().join(' ')
    const shown = tiles.map(t => t.textContent!.trim())
    const item = items.find(c => key(tileWords(c.text)) === key(shown))
    if (!item) throw new Error(`no sentence for tiles ${shown.join(' ')}`)
    if (wrongFirst && i === 0) {
      for (const tile of [...tiles]) tile.click()
      await click('Check')
      await waitText('Not quite')
      await screen('sentence-builder-retry')
      for (const tile of [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Your sentence"] .rien-token')]) {
        tile.click()
        await sleep(30)
      }
      await waitFor(() => document.querySelectorAll('[aria-label="Your sentence"] .rien-token').length === 0, 'tiles back')
      await sleep(200)
    }
    for (const word of tileWords(item.text).map(w => w.toLowerCase())) {
      const tile = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Words to place"] .rien-token')]
        .find(t => t.textContent!.trim().toLowerCase() === word)
      if (!tile) throw new Error(`no tile "${word}"`)
      tile.click()
      await sleep(30)
    }
    await click('Check')
    await waitText(wrongFirst && i === 0 ? 'Correct on the second try' : 'Correct')
    await click('Next')
  }
}

async function playRadio(packs: Pack[], missOne: boolean) {
  const title = (await waitFor(() => document.querySelector('.rien-cue'), 'title')).textContent!.trim()
  const radio = packs.flatMap(p => p.radio).find(r => r.title === title)
  if (!radio) throw new Error(`no text "${title}"`)
  const shownText = (await waitFor(() => document.querySelector('.rien-radio'), 'radio text')).textContent!.replace(/\s+/g, ' ')
  await click('Play')
  // Each round starts its gaps at a different word: find the start whose
  // remaining words are the ones on screen, spaces and all (so words that
  // run together fail here too).
  const flat = (t: string) => t.replace(/\s+/g, ' ').trim()
  const start = Array.from({ length: GAP_EVERY }, (_, i) => i).find(i =>
    flat(radioTokens(radio.text, GAP_EVERY, i).map(t => (t.gap === undefined ? `${t.before}${t.word}${t.after}` : `${t.before}${t.after}`)).join(' '))
      === flat(shownText))
  if (start === undefined) throw new Error(`text on screen does not match the gaps (words run together?): ${shownText.slice(0, 80)}`)
  const answers = radioAnswers(radioTokens(radio.text, GAP_EVERY, start))
  const inputs = [...document.querySelectorAll<HTMLInputElement>('.rien-gap')]
  if (inputs.length !== answers.length) throw new Error(`${inputs.length} gaps on screen, ${answers.length} expected`)
  inputs.forEach((input, i) => setValue(input, missOne && i === 0 ? 'zzz' : answers[i]!))
  await sleep(100)
  await click('Check')
  await waitText(`${missOne ? answers.length - 1 : answers.length} of ${answers.length} right`)
  await screen('gap-radio-checked')
  await click('Done')
}

// --- Quick games (Picture Match, Listen & Pick, Speed Round) -----------------------

// A quick game is over: its own end card, or (in the daily session) the
// session's "Nice work" or "Session complete".
const quickOver = () => /Round done|Nice work|Session complete/.test(pageText())

// Taps the choice with this text, then waits for the next question or the end.
async function pickChoice(answer: string) {
  const choice = await waitFor(() => [...document.querySelectorAll<HTMLButtonElement>('.rien-quick-choice:not([disabled])')]
    .find(b => b.textContent?.trim() === answer), `choice "${answer}"`)
  choice.click()
  await waitFor(() => document.querySelector('.rien-quick-choice.is-right'), 'right answer shown')
  await waitFor(() => quickOver() || document.querySelector('.rien-quick-choice:not([disabled])'), 'next question', 5000)
}

async function playPictures() {
  for (let i = 0; i < 12; i++) {
    // The picture fades out and in while the new choices already show, so wait
    // until the picture on screen is one of the choices' (her only photo is
    // the one added for "borrow").
    const answer = await waitFor(() => {
      if (quickOver()) return 'done'
      const options = [...document.querySelectorAll<HTMLButtonElement>('.rien-quick-choice:not([disabled])')].map(b => b.textContent!.trim())
      const emoji = document.querySelector('.rien-picture-emoji')?.textContent?.trim()
      const word = emoji ? WORD_BANK.find(w => w.emoji === emoji)?.word : document.querySelector('.rien-picture-photo') && 'borrow'
      return word && options.includes(word) ? word : undefined
    }, 'picture and its choices')
    if (answer === 'done') return
    await pickChoice(answer)
  }
  if (!quickOver()) throw new Error('Picture Match did not finish')
}

// The answer is only spoken, so listen in on the voice to know it.
async function playListen() {
  const synth = window.speechSynthesis
  if (!synth || pageText().includes('cannot read aloud')) {
    await click('Skip')
    return
  }
  let heard = ''
  const realSpeak = synth.speak.bind(synth)
  synth.speak = (utterance) => { heard = utterance.text; realSpeak(utterance) }
  try {
    await click('Play the word')
    for (let i = 0; i < 12; i++) {
      await waitFor(() => quickOver() || document.querySelector('.rien-quick-choice:not([disabled])'), 'listen question')
      if (quickOver()) return
      await waitFor(() => heard, 'spoken word')
      const answer = heard
      heard = ''
      await pickChoice(answer)
    }
    if (!quickOver()) throw new Error('Listen & Pick did not finish')
  }
  finally {
    synth.speak = realSpeak
  }
}

// A few right calls (a sentence with a Fix It mistake in it is wrong), then
// the clock is moved past the minute.
async function playSpeed(packs: Pack[]) {
  const withMistakes = new Set(packs.flatMap(p => p.fixIt).map(i => i.text))
  await click('Start')
  for (let i = 0; i < 4; i++) {
    const card = await waitFor(() => document.querySelector('.rien-speed-sentence'), 'speed sentence')
    const sentence = card.textContent!.trim()
    await waitFor(() => document.querySelector<HTMLButtonElement>('.rien-speed-btn:not([disabled])'), 'speed buttons')
    document.querySelector<HTMLButtonElement>(withMistakes.has(sentence) ? '.rien-speed-btn.is-no' : '.rien-speed-btn.is-yes')!.click()
    await waitFor(() => document.querySelector('.rien-speed-sentence')?.textContent?.trim() !== sentence
      && document.querySelector('.rien-speed-btn:not([disabled])'), 'next sentence', 5000)
  }
  const score = Number(document.querySelector('.rien-speed-score')?.textContent)
  if (score !== 4) throw new Error(`Speed Round: ${score} of 4 right`)
  const realNow = Date.now.bind(Date)
  Date.now = () => realNow() + 61_000
  try {
    await waitText('Time!')
  }
  finally {
    Date.now = realNow
  }
}

export default defineNuxtPlugin({
  name: 'rien-e2e',
  enforce: 'post',
  setup(nuxtApp) {
    nuxtApp.hook('app:mounted', () => {
      setTimeout(() => void run(), 1500)
    })
  },
})

async function run() {
  const db = useDb()
  let pass = 0
  let fail = 0
  const step = async (name: string, work: () => Promise<string | void>) => {
    try {
      const detail = await work()
      pass++
      log(`PASS ${name}${detail ? ` — ${detail}` : ''}`)
    }
    catch (error) {
      fail++
      log(`FAIL ${name} — ${(error as Error).message} — screen: ${text().slice(0, 160)}`)
    }
  }

  // For host scripts (profiling with a year of data): the database and router.
  Object.assign(window, { __rienDb: db, __rienNav: navigateTo })
  log(`START ${navigator.userAgent}`)
  const packs = await usePacks()

  await step('Today loads, fresh, with the tab bar and a session plan', async () => {
    await goTo('/', 'Today’s session')
    if ((await db.countCards()) !== 0) throw new Error('expected a fresh install')
    const tabs = [...document.querySelectorAll('.rien-tab')].map(t => t.textContent!.trim())
    if (tabs.join(',') !== 'Today,Words,Tank,Progress,Me') throw new Error(`tabs: ${tabs.join(',')}`)
    if (!document.querySelector('.rien-tab-lens')) throw new Error('no tab lens')
    // Dragging the lens from Today to Progress opens Progress; then back by tap.
    const bar = document.querySelector('.rien-tabbar') as HTMLElement
    const rect = bar.getBoundingClientRect()
    const at = (i: number) => rect.left + 6 + ((rect.width - 12) / 5) * (i + 0.5)
    const pointer = (type: string, x: number) => bar.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, pointerType: 'touch', clientX: x, clientY: rect.top + rect.height / 2, bubbles: true, isPrimary: true,
    }))
    pointer('pointerdown', at(0))
    for (let i = 1; i <= 6; i++) pointer('pointermove', at(0) + ((at(3) - at(0)) * i) / 6)
    pointer('pointerup', at(3))
    await waitFor(() => location.pathname.startsWith('/progress'), 'drag to Progress')
    await goTo('/', 'Today’s session')
    if (!document.documentElement.classList.contains('rien-glass')) throw new Error('Liquid Glass should be on by default')
    if (!document.documentElement.classList.contains('rien-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches) throw new Error('motion should be on by default')
    await screen('today-empty')
  })

  await step('Add three words from the Words tab', async () => {
    await click('Words')
    await waitText('No words yet')
    await screen('words-empty')
    await click('Add a word')
    await waitText('Right after class')
    for (const [i, word] of WORDS.entries()) {
      await fill('English word', word.answer)
      await fill('Meaning in English', word.meaning)
      if (word.khmer) await fill('Khmer hint', word.khmer)
      if (word.example) await fill('Example sentence', word.example)
      if (i === 0) {
        await choosePictureIn(document.querySelector<HTMLInputElement>('input[type=file]')!)
        await waitFor(() => document.querySelector('img.rien-picture-thumb'), 'picture preview')
        await screen('add-word-picture')
      }
      await click('Save word')
      await waitText(`Saved “${word.answer}”`)
      if (i === 0) {
        // The first word unlocks the first award fish.
        await waitFor(() => document.querySelector('.rien-toast')?.textContent?.includes('New fish: Sprout'), 'Sprout award message')
        await screen('toast-first-fish')
      }
    }
    await fill('English word', 'Borrow')
    await fill('Meaning in English', 'again')
    await click('Save word')
    await waitText('is already in your words')
    await fill('English word', '')
    await fill('Meaning in English', '')
    const borrow = (await db.allCards()).find(c => c.answer === 'borrow')
    if (!borrow?.image?.startsWith('data:image/jpeg')) throw new Error('the picture was not saved as a small JPEG')
    return `${await db.countCards()} saved, picture ${Math.round(borrow.image.length / 1024)} KB, duplicate refused`
  })

  await step('Words tab: search, filters and details', async () => {
    await click('Back')
    // The subtitle is styled in capitals, so match it case-insensitively.
    await waitFor(() => /3 saved/i.test(text()), '"3 saved"')
    await fill('Search words', 'walk')
    await waitFor(() => document.querySelectorAll('.rien-list-row').length === 1, 'one search result')
    await fill('Search words', '')
    await click('Due 3')
    await waitFor(() => document.querySelectorAll('.rien-list-row').length === 3, 'three due')
    await click('Tricky 0')
    await waitText('No tricky words')
    await click('All 3')
    await click('borrow')
    await waitText('reviewed 0 times')
    // The sheet must actually be on screen, not just in the page.
    // (after its slide-up has finished).
    await waitFor(() => {
      const r = document.querySelector('.ios-sheet')!.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom <= window.innerHeight + 1
    }, 'sheet fully on screen', 3000)
    await screen('words-detail')
    await click('Close')
    await waitFor(() => !document.querySelector('.ios-sheet'), 'sheet closed')
  })

  await step('Today’s session: plays every planned activity in order', async () => {
    try { localStorage.clear() }
    catch {}
    await click('Today')
    await waitText('Start session')
    await click('Start session')
    const played: string[] = []
    for (let i = 0; i < 6; i++) {
      await waitFor(() => document.querySelector('.rien-session-label') || text().includes('Session complete'), 'session step')
      if (text().includes('Session complete')) break
      const label = document.querySelector('.rien-session-label')!.textContent!
      if (i === 0) await screen('session-step')
      if (label.includes('Word Recall')) played.push(`recall (${await playRecall({ hintFirst: true, wrongFirst: { walked: 'walk' } })})`)
      else if (label.includes('Fix It')) { await playFixIt(packs); played.push('fix-it') }
      else if (label.includes('Final Sound Hunter')) { await playSounds(); played.push('sounds') }
      else if (label.includes('Sentence Builder')) { await playBuilder(packs, true); played.push('builder') }
      else if (label.includes('Gap Radio')) { await playRadio(packs, true); played.push('radio') }
      else if (label.includes('Say It')) { await click('Skip'); played.push('say-it skipped') }
      else if (label.includes('Picture Match')) { await playPictures(); played.push('pictures') }
      else if (label.includes('Listen & Pick')) { await playListen(); played.push('listen') }
      else if (label.includes('Speed Round')) { await playSpeed(packs); played.push('speed') }
      else throw new Error(`unknown step ${label}`)
      await waitFor(() => text().includes('Nice work') || text().includes('Session complete'), 'between steps')
      if (text().includes('Nice work')) {
        if (i === 0) await screen('session-between')
        await click('Continue')
      }
    }
    await waitText('Session complete')
    await screen('session-complete')
    if (!played[0]?.startsWith('recall')) throw new Error(`due words should come first, got ${played.join(', ')}`)
    return played.join(' → ')
  })

  await step('Tank: study fish hatched by the session, awards unlocked', async () => {
    await goTo('/tank', 'Study fish')
    const swimming = document.querySelectorAll('.rien-fish').length
    const eggs = document.querySelectorAll('.rien-egg').length
    if (swimming < 4) throw new Error(`only ${swimming} fish swimming`)
    // Teammate needs four activities in a day; the simulator session skips Say It, so only check Sprout.
    if (!text().includes('Sprout')) throw new Error('Sprout should be unlocked')
    ;(document.querySelector('.rien-fish') as HTMLElement).click()
    await waitFor(() => button('Feed it') || button('Bring it back') || pageText().includes('Award:'), 'fish sheet')
    await screen('tank')
    await click('Close')
    await waitFor(() => !document.querySelector('.ios-sheet'), 'sheet closed')
    return `${swimming} swimming, ${eggs} eggs`
  })

  await step('Today shows the session done, the streak and done marks', async () => {
    await goTo('/', 'Session done')
    const streak = document.querySelector('.rien-streak-row')?.getAttribute('aria-label')
    if (streak !== '1 day streak') throw new Error(`streak: ${streak}`)
    // Played steps get a done mark; a skipped step (Say It in the simulator) does not.
    const done = document.querySelectorAll('.rien-list .rien-done-dot').length
    if (done < 3) throw new Error(`only ${done} activities marked done`)
    await screen('today-after-session')
    return `${streak}, ${done} done marks`
  })

  const practise = async (id: string, play: () => Promise<void>, finished: string) => {
    await goTo(`/games/${id}`, '')
    await play()
    await waitFor(() => text().includes(finished), finished)
    return text().match(/\d+ (\/|of) \d+[^.]*/)?.[0]
  }

  await step('Fix It on its own', () => practise('fix-it', () => playFixIt(packs), 'Round done'))
  await step('Final Sound Hunter on its own', () => practise('sound-hunter', playSounds, 'Round done'))
  await step('Sentence Builder on its own', () => practise('sentence-builder', () => playBuilder(packs, false), 'Round done'))
  await step('Gap Radio on its own, one gap missed', async () => {
    const before = (await db.mistakeCounts(new Date(0))).listening ?? 0
    await goTo('/games/gap-radio', 'Listen, then fill the gaps')
    await playRadio(packs, true)
    const after = (await db.mistakeCounts(new Date(0))).listening ?? 0
    if (after <= before) throw new Error('no listening mistake saved')
  })

  await step('Picture Match on its own', () => practise('picture-match', playPictures, 'Round done'))
  await step('Listen & Pick on its own', () => practise('listen-pick', playListen, 'Round done'))
  await step('Speed Round on its own', () => practise('speed-round', () => playSpeed(packs), 'Time!'))

  await step('File Boss: all 15 questions', async () => {
    await goTo('/games/file-boss', 'questions mixing')
    for (let i = 0; i < 15; i++) {
      await waitFor(() => document.querySelector('.rien-sentence, .rien-pair, main form input'), 'question')
      if (document.querySelector('.rien-sentence')) await answerFixIt(packs)
      else if (document.querySelector('.rien-pair')) await answerSound()
      else {
        const cue = document.querySelector('.rien-cue')!.textContent!.trim()
        await fill('Type the English word', WORDS.find(w => w.meaning === cue)!.answer)
        await click('Check')
      }
      await click('Next')
    }
    await waitFor(() => text().includes('File beaten') || text().includes('Good try'), 'boss result')
    return text().match(/\d+ \/ 15/)?.[0]
  })

  await step('Couple Talk: every question, a slip noted, saved', async () => {
    const talksBefore = (await db.exportAll()).talks.length
    const mistakesBefore = (await db.exportAll()).mistakes.length
    // The Start button sits in the pinned bar (teleported outside <main>).
    await goTo('/games/couple-talk', 'Take turns')
    await click('Start talking')
    await waitFor(() => document.querySelector('.rien-talk-timer [role=timer]')?.textContent?.startsWith('9:5'), 'timer running')
    await click('Note a slip')
    ;(await waitFor(() => document.querySelector<HTMLElement>('.rien-talk-sliptype'), 'slip types')).click()
    await fill('The right way to say it', 'She goes, not she go')
    await click('Save slip')
    await waitText('1 slip noted for later')
    await screen('couple-talk')
    for (let i = 0; i < 12 && button('Next question'); i++) await click('Next question')
    await click('We\'re done')
    await waitText('Nice talk')
    await waitText('To go over together')
    const after = await db.exportAll()
    if (after.talks.length !== talksBefore + 1) throw new Error('the talk was not saved')
    if (after.mistakes.length !== mistakesBefore + 1) throw new Error('the slip was not saved as a mistake')
  })

  await step('Progress tab shows totals and the File Boss result', async () => {
    await goTo('/progress', 'Days studied')
    // Weak spots from slip counts until the skill model has enough answers,
    // then its Skills card.
    await waitFor(() => /weak spots|skills/i.test(pageText()), 'Weak spots or Skills')
    await waitText('3 words saved')
    await waitText('File 9:')
    // The study calendar: today is studied, and the grid keeps seven columns
    // inside its card at any width.
    const cal = document.querySelector('.rien-cal-grid')
    if (!cal) throw new Error('no study calendar')
    const today = cal.querySelector('.rien-cal-day.is-today')
    if (!today?.classList.contains('is-studied')) throw new Error('today is not marked as studied')
    const firstRow = [...cal.children].slice(0, 7).map(c => c.getBoundingClientRect().top)
    if (new Set(firstRow).size !== 1) throw new Error('calendar weekdays wrapped')
    ;(today as HTMLElement).click()
    await waitText('minute')
    document.querySelector('.rien-cal')!.scrollIntoView({ block: 'center' })
    await screen('progress')
  })

  await step('Settings: new-word limit, and Liquid Glass and motion switch off and on', async () => {
    await goTo('/settings', 'New words')
    const root = document.documentElement
    await db.saveSettings({ liquidGlass: false, motion: false })
    await waitFor(() => !root.classList.contains('rien-glass') && !root.classList.contains('rien-motion'), 'glass and motion off')
    await screen('settings-plain')
    await db.saveSettings({ liquidGlass: true, motion: true })
    await waitFor(() => root.classList.contains('rien-glass'), 'glass back on')
    // Appearance overrides the phone's own setting either way.
    await db.saveSettings({ appearance: 'dark' })
    await waitFor(() => root.classList.contains('rien-dark'), 'dark on')
    await screen('settings-dark')
    await db.saveSettings({ appearance: 'light' })
    await waitFor(() => !root.classList.contains('rien-dark'), 'light on')
    await db.saveSettings({ appearance: 'system' })
    await screen('settings')
  })

  await step('Skill model: answers logged, built in the background thread', async () => {
    const attempts = await db.attemptsSince(new Date(0))
    const kinds = new Set(attempts.map(a => a.kind))
    for (const kind of ['fix-it', 'sound', 'builder', 'radio', 'picture', 'speed'] as const) {
      if (!kinds.has(kind)) throw new Error(`no ${kind} answers logged (have ${[...kinds].join(', ')})`)
    }
    // Rebuild from the log, and fail if the background thread could not start.
    const warn = console.warn
    let fellBack = false
    console.warn = (...args: unknown[]) => { if (String(args[0]).includes('main thread')) fellBack = true; warn(...args) }
    try {
      resetLearner()
      const learner = await useLearner()
      if (fellBack) throw new Error('the skill model was built on the main thread')
      const reviews = (await db.reviewsSince(new Date(0))).length
      if (learner.answers !== attempts.length + reviews) throw new Error(`model saw ${learner.answers} answers, log has ${attempts.length + reviews}`)
      const skills = weakSkills(learner, new Date())
      if (!skills.length) throw new Error('no skills reported')
      // Its self-check: every past answer predicted before learning from it.
      const { check } = learner
      if (check.n !== learner.answers - 10 || !(check.accuracy > 0 && check.accuracy <= 1)) throw new Error(`self-check: ${JSON.stringify(check).slice(0, 120)}`)
      await goTo('/progress', 'Days studied')
      await waitText('How well Rien knows you')
      await waitText('Skills')
      document.querySelector('.rien-calibration')?.scrollIntoView({ block: 'center' })
      await screen('progress-self-check')
      return `${attempts.length} attempts + ${reviews} reviews; self-check ${Math.round(check.accuracy * 100)}% on ${check.n}; weakest: ${skills.slice(0, 2).map(s => `${s.skill} ${Math.round(s.p * 100)}%`).join(', ')}; working at ${workingLevelOf(learner)}`
    }
    finally {
      console.warn = warn
    }
  })

  await step('Backup round trip through the storage layer', async () => {
    const before = await db.exportAll()
    await db.importAll(JSON.parse(JSON.stringify(before)))
    const after = await db.exportAll()
    const counts = (b: typeof before) => [b.cards, b.reviews, b.mistakes, b.sessions, b.grammar, b.bosses, b.talks, b.attempts].map(r => r.length).join('/')
    if (counts(before) !== counts(after)) throw new Error(`${counts(before)} before, ${counts(after)} after`)
    return `cards/reviews/mistakes/sessions/grammar/bosses/talks/attempts = ${counts(after)}`
  })

  await step('Sound stops when a sheet closes or the screen changes', async () => {
    // Counts calls to the voice's cancel() (web and iPhone; Android reads aloud
    // through the native plugin, which this cannot watch).
    const synth = window.speechSynthesis
    if (!synth) return 'skipped: no web voice here'
    let stops = 0
    const realCancel = synth.cancel.bind(synth)
    synth.cancel = () => { stops++; realCancel() }
    try {
      await goTo('/words', 'Tricky')
      document.querySelector<HTMLElement>('.rien-list-row')!.click()
      await waitFor(() => document.querySelector('.ios-sheet'), 'word sheet')
      let before = stops
      document.querySelector<HTMLElement>('.ios-sheet-close')!.click()
      await waitFor(() => stops > before, 'stop on sheet close')
      before = stops
      await goTo('/progress', 'Days studied')
      if (stops <= before) throw new Error('no stop on screen change')
      before = stops
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
      delete (document as { visibilityState?: string }).visibilityState
      if (stops <= before) throw new Error('no stop when the app goes to the background')
    }
    finally {
      synth.cancel = realCancel
    }
  })

  await step('Say It screen (native) or its notice (web)', async () => {
    await goTo('/games/say-it', 'Say It')
    await waitFor(() => text().includes('Read it aloud') || text().includes('Say It is in the Rien app'), 'Say It content')
    await screen('say-it')
    return text().includes('Read it aloud') ? 'sentence ready to read' : 'web notice shown'
  })

  await step('IELTS: reading, listening, writing, speaking and academic words', async () => {
    const ielts = await loadIelts()
    // Reading: every statement answered as the pack says, so all right.
    await goTo('/ielts/reading', 'Not given')
    const text = ielts.reading[0]!
    const LABEL = { 'true': 'True', 'false': 'False', 'not-given': 'Not given' } as const
    const items = [...document.querySelectorAll<HTMLElement>('.rien-tfng > li')]
    if (items.length !== text.statements.length) throw new Error(`${items.length} statements shown`)
    items.forEach((li, i) => [...li.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent!.trim() === LABEL[text.statements[i]!.answer])!.click())
    await sleep(150)
    await click('Check')
    await waitText(`${text.statements.length} / ${text.statements.length}`)
    await screen('ielts-reading')
    // Listening: the form filled from the pack's answers, in other accepted forms.
    await goTo('/ielts/listening', 'Form')
    const call = ielts.listening[0]!
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.rien-ielts-form input')]
    call.form.forEach((f, i) => setValue(inputs[i]!, (f.accept[0] ?? f.answer).toUpperCase()))
    await sleep(150)
    await click('Check')
    await waitText(`${call.form.length} / ${call.form.length}`)
    // Writing: a short essay gets the checklist.
    await goTo('/ielts/writing', 'Task 2')
    await click('Task 2')
    const essay = await waitFor(() => document.querySelector<HTMLTextAreaElement>('.rien-ielts-essay textarea'), 'essay box')
    setValue(essay, 'In my opinion, children should learn a foreign language early. However, it is not easy.\n\nFor example, young children copy sounds well, and as a result they speak more naturally.\n\nIn addition, schools need good teachers. Therefore it costs money.\n\nIn conclusion, I believe that the benefits are greater than the costs.')
    await sleep(150)
    await click('Check')
    await waitText('Checklist')
    await waitText('A conclusion')
    await screen('ielts-writing')
    // Speaking: Part 1 asks its first question; Part 2 shows the card and the minute to prepare.
    await goTo('/ielts/speaking', 'Parts 2 and 3')
    await click('Start Part 1')
    await waitText('question 1 of')
    await goTo('/ielts', 'Academic words')
    await goTo('/ielts/speaking', 'Parts 2 and 3')
    await click('Start Part 2')
    await waitText('You should say')
    await waitFor(() => /Prepare: 0:5\d|Prepare: 1:00/.test(pageText()), 'preparation minute running')
    await screen('ielts-speaking-card')
    // Academic words: ten go into her words.
    const before = await db.countCards()
    await goTo('/ielts', 'Academic words')
    await click('Add 10 to my words')
    await waitText('Added 10 words')
    if ((await db.countCards()) !== before + 10) throw new Error('academic words not added')
    await screen('ielts-hub')
    return `reading ${text.statements.length}/${text.statements.length}, form ${call.form.length}/${call.form.length}, essay checked, ${before + 10} words`
  })

  log(`DONE pass=${pass} fail=${fail}`)
}
