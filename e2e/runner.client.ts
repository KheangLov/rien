// End-to-end run through the real screens, included only in builds made with
// RIEN_E2E=1 (see nuxt.config.ts). It clicks and types like a person would,
// works out the right answers from the content packs, and logs each step as
// "[e2e] PASS …" or "[e2e] FAIL …", ending with "[e2e] DONE pass=… fail=…".
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

// Asks the host script for a screenshot, and also records any text field
// smaller than 16px (iOS zooms the page when one gets focus).
async function screen(name: string) {
  const small = [...document.querySelectorAll<HTMLElement>('input, textarea, select')]
    .filter(el => Number.parseFloat(getComputedStyle(el).fontSize) < 16)
  if (small.length) throw new Error(`${small.length} text field(s) under 16px on ${name}`)
  log(`SCREEN ${name}`)
  await sleep(1500)
}
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

const waitText = (needle: string, timeout?: number) =>
  waitFor(() => text().includes(needle), `"${needle}"`, timeout)

function button(label: string, root: ParentNode = document): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>('button, a')]
    .find(b => b.textContent?.trim().startsWith(label) && !(b as HTMLButtonElement).disabled)
}

async function click(label: string, root?: ParentNode) {
  ;(await waitFor(() => button(label, root), `button "${label}"`)).click()
  await sleep(250)
}

async function startActivity(title: string, label = 'Start') {
  const card = await waitFor(() => [...document.querySelectorAll('.sq-card')]
    .find(c => c.querySelector('strong')?.textContent?.trim() === title), `card "${title}"`)
  await click(label, card)
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

async function typeAnswer(value: string) {
  setValue(await waitFor(() => document.querySelector<HTMLInputElement>('main form input'), 'answer field'), value)
  await sleep(100)
}

async function goTo(path: string, ready: string) {
  await navigateTo(path)
  await waitText(ready)
  await sleep(300)
}

// Answers for the question types, from the packs.
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

async function answerSound() {
  await click('Play')
  ;(await waitFor(() => document.querySelector<HTMLButtonElement>('.rien-pair button:not([disabled])'), 'sound choice')).click()
  await sleep(300)
}

async function answerWord(wrongFirst: Record<string, string>) {
  const cue = (await waitFor(() => document.querySelector('.rien-cue'), 'word cue')).textContent!.trim()
  const word = WORDS.find(w => w.meaning === cue)
  if (!word) throw new Error(`unknown cue "${cue}"`)
  const answer = wrongFirst[word.answer] ?? word.answer
  delete wrongFirst[word.answer]
  await typeAnswer(answer)
  await click('Check')
  return word.answer
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

  await step('Today page loads with an empty streak', async () => {
    await goTo('/', 'days in a row')
    if ((await db.countCards()) !== 0) throw new Error('expected a fresh install')
  })

  await step('Add three words', async () => {
    await goTo('/add-words', 'Add a word')
    await screen('add-words')
    for (const word of WORDS) {
      await fill('English word', word.answer)
      await fill('Meaning in English', word.meaning)
      if (word.khmer) await fill('Khmer hint', word.khmer)
      if (word.example) await fill('Example sentence', word.example)
      await click('Save word')
      await waitText(`Saved “${word.answer}”`)
    }
    return `${await db.countCards()} saved`
  })

  await step('A duplicate word is refused', async () => {
    await fill('English word', 'Borrow')
    await fill('Meaning in English', 'again')
    await click('Save word')
    await waitText('is already in your words')
    await fill('English word', '')
    await fill('Meaning in English', '')
  })

  await step('Word Recall: typo, dropped ending, retry', async () => {
    await goTo('/', 'words to review')
    await startActivity('Word Recall')
    const wrongFirst: Record<string, string> = { borrow: 'borow', walked: 'walk' }
    const seen: string[] = []
    for (let i = 0; i < 6 && !text().includes('Round done'); i++) {
      const answered = await answerWord(wrongFirst)
      if (answered === 'walked' && !seen.includes('walked')) {
        await waitText('Check the ending: -ed')
        await screen('word-recall-ending')
      }
      if (answered === 'borrow' && !seen.includes('borrow')) await waitText('Nearly')
      seen.push(answered)
      await click('Next')
    }
    await waitText('Round done')
    return text().match(/\d+ \/ \d+ right first time/)?.[0]
  })

  await step('Fix It: a full round', async () => {
    await goTo('/', 'Fix It')
    await startActivity('Fix It')
    for (let i = 0; i < 8; i++) {
      await answerFixIt(packs)
      await click('Next')
    }
    await waitText('Round done')
    return text().match(/\d+ \/ \d+/)?.[0]
  })

  await step('Final Sound Hunter: a full round', async () => {
    await goTo('/', 'Final Sound Hunter')
    await startActivity('Final Sound Hunter')
    for (let i = 0; i < 10; i++) {
      await answerSound()
      await click('Next')
    }
    await waitText('Round done')
    return text().match(/\d+ \/ \d+ heard right/)?.[0]
  })

  await step('Sentence Builder: a full round, one wrong try first', async () => {
    await goTo('/', 'Sentence Builder')
    await startActivity('Sentence Builder')
    const items = builderCards(packs)
    for (let i = 0; i < 6; i++) {
      const tiles = await waitFor(() => {
        const found = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Words to place"] .rien-token')]
        return found.length ? found : undefined
      }, 'tiles')
      const key = (words: string[]) => words.map(w => w.toLowerCase()).sort().join(' ')
      const shown = tiles.map(t => t.textContent!.trim())
      const item = items.find(c => key(c.text.replace(/[.?!]$/, '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'-]/gu, ''))) === key(shown))
      if (!item) throw new Error(`no sentence for tiles ${shown.join(' ')}`)
      if (i === 0) {
        // Place in the shuffled order (always wrong), then fix it.
        for (const tile of [...tiles]) tile.click()
        await click('Check')
        await waitText('Not quite')
        await screen('sentence-builder-retry')
        for (const tile of [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Your sentence"] .rien-token')]) {
          tile.click()
          await sleep(30)
        }
        await waitFor(() => document.querySelectorAll('[aria-label="Your sentence"] .rien-token').length === 0, 'tiles back in the pool')
        await sleep(200)
      }
      const order = item.text.replace(/[.?!]$/, '').split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase())
      for (const word of order) {
        const tile = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Words to place"] .rien-token')]
          .find(t => t.textContent!.trim().toLowerCase() === word)
        if (!tile) throw new Error(`no tile "${word}"`)
        tile.click()
        await sleep(30)
      }
      await click('Check')
      await waitText(i === 0 ? 'Correct on the second try' : 'Correct')
      await click('Next')
    }
    await waitText('Round done')
    return text().match(/\d+ \/ \d+ built/)?.[0]
  })

  await step('Gap Radio: fill the gaps, one missed', async () => {
    await goTo('/', 'Gap Radio')
    await startActivity('Gap Radio')
    const title = (await waitFor(() => document.querySelector('.rien-cue'), 'title')).textContent!.trim()
    const radio = packs.flatMap(p => p.radio).find(r => r.title === title)
    if (!radio) throw new Error(`no text "${title}"`)
    await click('Play')
    const shown = (await waitFor(() => document.querySelector('.rien-radio'), 'radio text')).textContent!.replace(/\s+/g, ' ')
    if (!shown.includes(radio.text.split(/\s+/).slice(0, 3).join(' '))) throw new Error(`words run together: "${shown.slice(0, 60)}"`)
    await screen('gap-radio')
    const answers = radioAnswers(radioTokens(radio.text))
    const inputs = [...document.querySelectorAll<HTMLInputElement>('.rien-gap')]
    if (inputs.length !== answers.length) throw new Error(`${inputs.length} gaps on screen, ${answers.length} expected`)
    const before = (await db.mistakeCounts(new Date(0))).listening ?? 0
    inputs.forEach((input, i) => setValue(input, i === 0 ? 'zzz' : answers[i]!))
    await sleep(100)
    await click('Check')
    await waitText(`${answers.length - 1} of ${answers.length} right`)
    await screen('gap-radio-checked')
    const after = (await db.mistakeCounts(new Date(0))).listening ?? 0
    if (after !== before + 1) throw new Error(`expected one new listening mistake, got ${after - before}`)
    await click('Done')
    return `${answers.length - 1} of ${answers.length} right, 1 listening mistake saved`
  })

  await step('File Boss: all 15 questions', async () => {
    await goTo('/', 'File 7 Boss')
    await click('Start File Boss')
    await waitText('questions mixing')
    const kinds: string[] = []
    for (let i = 0; i < 15; i++) {
      await waitFor(() => document.querySelector('.rien-sentence, .rien-pair, main form input'), 'question')
      if (document.querySelector('.rien-sentence')) {
        kinds.push('fix')
        await answerFixIt(packs)
      }
      else if (document.querySelector('.rien-pair')) {
        kinds.push('sound')
        await answerSound()
      }
      else {
        kinds.push('word')
        await answerWord({})
      }
      await click('Next')
    }
    await waitFor(() => text().includes('File beaten') || text().includes('Good try'), 'boss result')
    return `${text().match(/\d+ \/ 15/)?.[0]} (${kinds.filter(k => k === 'word').length} words, ${kinds.filter(k => k === 'fix').length} grammar, ${kinds.filter(k => k === 'sound').length} sounds)`
  })

  await step('Couple Talk: start, timer ends, save', async () => {
    await goTo('/', 'Couple Talk')
    await click('Start Couple Talk')
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

  await step('Today shows the streak and finished activities', async () => {
    await goTo('/', 'days in a row')
    await waitText('1 day in a row')
    const done = (text().match(/Done today/g) ?? []).length
    // Word Recall, Fix It, Final Sound Hunter, Sentence Builder and Gap Radio (Say It is not played).
    if (done < 5) throw new Error(`only ${done} activities marked done today`)
    await waitText('Done this week')
    await screen('today-after')
    return `${done} activities done today`
  })

  await step('Progress page shows totals and the File Boss result', async () => {
    await goTo('/progress', 'Weak spots')
    await screen('progress')
    await waitText('3 words saved')
    await waitText('File 7:')
    return text().match(/Weak spots.{0,120}/)?.[0]
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
