// End-to-end run through the real screens, included only in builds made with
// RIEN_E2E=1 (see nuxt.config.ts). It taps and types like a person would,
// works out the right answers from the content packs, and logs each step as
// "[e2e] PASS …" or "[e2e] FAIL …", ending with "[e2e] DONE pass=… fail=…".
// "[e2e] SCREEN name" asks the host script for a screenshot.
// The same build runs in the iOS simulator and in Chrome.
import { defineNuxtPlugin, navigateTo } from '#app'
import type { Pack } from '#shared/schemas/pack'
import { normalizeAnswer } from '#shared/utils/answer'
import { builderCards } from '#shared/utils/builder'
import { radioAnswers, radioTokens } from '#shared/utils/radio'
import { useDb } from '~/composables/useDb'
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

// Case-insensitive: some headings are styled in capitals, which innerText reports.
const waitText = (needle: string, timeout?: number) =>
  waitFor(() => text().toLowerCase().includes(needle.toLowerCase()), `"${needle}"`, timeout)

// Fails if any text field is under 16px (iOS zooms the page when one gets focus)
// or the page is wider than the screen, then asks for a screenshot.
async function screen(name: string) {
  const small = [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
    .filter(el => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
  if (small.length) throw new Error(`${small.length} text field(s) under 16px on ${name}`)
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    throw new Error(`${name} is wider than the screen (${document.documentElement.scrollWidth} > ${window.innerWidth})`)
  }
  log(`SCREEN ${name}`)
  await sleep(1500)
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
  if (!shownText.includes(radio.text.split(/\s+/).slice(0, 3).join(' '))) throw new Error('words run together')
  await click('Play')
  const answers = radioAnswers(radioTokens(radio.text))
  const inputs = [...document.querySelectorAll<HTMLInputElement>('.rien-gap')]
  if (inputs.length !== answers.length) throw new Error(`${inputs.length} gaps on screen, ${answers.length} expected`)
  inputs.forEach((input, i) => setValue(input, missOne && i === 0 ? 'zzz' : answers[i]!))
  await sleep(100)
  await click('Check')
  await waitText(`${missOne ? answers.length - 1 : answers.length} of ${answers.length} right`)
  await screen('gap-radio-checked')
  await click('Done')
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

  log(`START ${navigator.userAgent}`)
  const packs = await usePacks()

  await step('Today loads, fresh, with the tab bar and a session plan', async () => {
    await goTo('/', 'Today’s session')
    if ((await db.countCards()) !== 0) throw new Error('expected a fresh install')
    const tabs = [...document.querySelectorAll('.rien-tab')].map(t => t.textContent!.trim())
    if (tabs.join(',') !== 'Today,Words,Tank,Progress,Me') throw new Error(`tabs: ${tabs.join(',')}`)
    if (!document.querySelector('.rien-tab-lens')) throw new Error('no tab lens')
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
    await screen('words-detail')
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
    await waitFor(() => button('Feed it') || button('Bring it back') || text().includes('Award:'), 'fish card')
    await screen('tank')
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
    await goTo('/games/gap-radio', 'Listen, then type')
    await playRadio(packs, true)
    const after = (await db.mistakeCounts(new Date(0))).listening ?? 0
    if (after <= before) throw new Error('no listening mistake saved')
  })

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

  await step('Couple Talk: start, timer ends, save', async () => {
    // The Start button sits in the pinned bar (teleported outside <main>).
    await goTo('/games/couple-talk', 'Take turns')
    await click('Start 10 minutes')
    await waitFor(() => document.querySelector('.rien-timer')?.textContent?.startsWith('9:5'), 'timer running')
    const realNow = Date.now.bind(Date)
    Date.now = () => realNow() + 11 * 60_000
    try {
      await waitText('Time!')
    }
    finally {
      Date.now = realNow
    }
    await click('We’re done')
    await waitText('Nice talk')
  })

  await step('Progress tab shows totals and the File Boss result', async () => {
    await goTo('/progress', 'Weak spots')
    await waitText('3 words saved')
    await waitText('File 9:')
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
    await screen('settings')
  })

  await step('Backup round trip through the storage layer', async () => {
    const before = await db.exportAll()
    await db.importAll(JSON.parse(JSON.stringify(before)))
    const after = await db.exportAll()
    const counts = (b: typeof before) => [b.cards, b.reviews, b.mistakes, b.sessions, b.grammar, b.bosses, b.talks].map(r => r.length).join('/')
    if (counts(before) !== counts(after)) throw new Error(`${counts(before)} before, ${counts(after)} after`)
    return `cards/reviews/mistakes/sessions/grammar/bosses/talks = ${counts(after)}`
  })

  await step('Say It screen (native) or its notice (web)', async () => {
    await goTo('/games/say-it', 'Say It')
    await waitFor(() => text().includes('Read it aloud') || text().includes('Say It is in the iPhone app'), 'Say It content')
    await screen('say-it')
    return text().includes('Read it aloud') ? 'sentence ready to read' : 'web notice shown'
  })

  log(`DONE pass=${pass} fail=${fail}`)
}
