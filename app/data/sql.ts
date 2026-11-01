import {
  backupSchema,
  bossResultSchema,
  cardSchema,
  grammarSchema,
  mistakeSchema,
  newWordSchema,
  reviewSchema,
  sessionSchema,
  settingsSchema,
  talkResultSchema,
  type CardRow,
  type MistakeType,
  type SessionRow,
  type Settings,
} from '#shared/schemas/db'
import { normalizeAnswer } from '#shared/utils/answer'
import { newFsrsState } from '#shared/utils/scheduler'
import { DuplicateWordError, type StudyRepository } from './repository'

export type SqlValue = string | number | null

// The few calls the repository needs, so the same SQL runs on the Capacitor
// plugin in the app and on node:sqlite in tests.
export interface SqlDriver {
  exec(sql: string): Promise<void>
  run(sql: string, params?: SqlValue[]): Promise<void>
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>
  transaction<T>(work: () => Promise<T>): Promise<T>
}

// Each row keeps its full record as JSON in `data`; the other columns exist
// only to be indexed or filtered. Add a new entry for each schema change.
const MIGRATIONS = [
  `
  CREATE TABLE cards (
    id TEXT PRIMARY KEY, due INTEGER NOT NULL, answer_key TEXT NOT NULL, book TEXT NOT NULL,
    file INTEGER NOT NULL, state INTEGER NOT NULL, created_at INTEGER NOT NULL, data TEXT NOT NULL
  );
  CREATE INDEX cards_due ON cards (due);
  CREATE INDEX cards_answer_key ON cards (answer_key);
  CREATE INDEX cards_book_file ON cards (book, file);
  CREATE INDEX cards_created ON cards (created_at);
  CREATE TABLE reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE INDEX reviews_card ON reviews (card_id);
  CREATE TABLE mistakes (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, item_id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE INDEX mistakes_at ON mistakes (at);
  CREATE INDEX mistakes_item ON mistakes (item_id);
  CREATE TABLE sessions (date TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY, data TEXT NOT NULL);
  CREATE TABLE grammar (item_id TEXT PRIMARY KEY, due INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE bosses (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, data TEXT NOT NULL);
  CREATE TABLE talks (id INTEGER PRIMARY KEY AUTOINCREMENT, talk_id TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
  `,
]

export const TABLES = ['cards', 'reviews', 'mistakes', 'sessions', 'settings', 'grammar', 'bosses', 'talks'] as const

async function migrate(driver: SqlDriver) {
  const [row] = await driver.all<{ user_version: number }>('PRAGMA user_version')
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    await driver.transaction(async () => {
      await driver.exec(MIGRATIONS[version]!)
      await driver.exec(`PRAGMA user_version = ${version + 1}`)
    })
  }
}

type DataRow = { data: string, id?: number }
const parseRows = <T>(rows: DataRow[], parse: (raw: unknown) => T): T[] =>
  rows.map(row => parse(row.id === undefined ? JSON.parse(row.data) : { ...JSON.parse(row.data), id: row.id }))
const json = (value: object) => JSON.stringify(value)

export async function openSqlRepository(driver: SqlDriver): Promise<StudyRepository> {
  await migrate(driver)

  const cards = (sql: string, params: SqlValue[] = []) =>
    driver.all<DataRow>(`SELECT data FROM cards ${sql}`, params).then(rows => parseRows(rows, raw => cardSchema.parse(raw)))
  const count = async (sql: string, params: SqlValue[] = []) =>
    (await driver.all<{ n: number }>(sql, params))[0]?.n ?? 0

  const putCard = (card: CardRow) => driver.run(
    `INSERT OR REPLACE INTO cards (id, due, answer_key, book, file, state, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [card.id, card.due.getTime(), card.answerKey, card.book, card.file, card.fsrs.state, card.createdAt.getTime(), json(card)],
  )
  const addReview = (review: { id?: number, cardId: string, at: Date }) => driver.run(
    `INSERT INTO reviews (id, card_id, at, data) VALUES (?, ?, ?, ?)`,
    [review.id ?? null, review.cardId, review.at.getTime(), json({ ...review, id: undefined })],
  )
  const addMistake = (mistake: { id?: number, type: MistakeType, itemId: string, at: Date }) => driver.run(
    `INSERT INTO mistakes (id, type, item_id, at, data) VALUES (?, ?, ?, ?, ?)`,
    [mistake.id ?? null, mistake.type, mistake.itemId, mistake.at.getTime(), json({ ...mistake, id: undefined })],
  )
  const putGrammar = (row: { itemId: string, due: Date }) => driver.run(
    `INSERT OR REPLACE INTO grammar (item_id, due, data) VALUES (?, ?, ?)`,
    [row.itemId, row.due.getTime(), json(row)],
  )
  const putSession = (row: SessionRow) => driver.run(
    `INSERT OR REPLACE INTO sessions (date, data) VALUES (?, ?)`, [row.date, json(row)])
  const addBoss = (row: { id?: number, at: Date }) => driver.run(
    `INSERT INTO bosses (id, at, data) VALUES (?, ?, ?)`, [row.id ?? null, row.at.getTime(), json({ ...row, id: undefined })])
  const addTalk = (row: { id?: number, talkId: string, at: Date }) => driver.run(
    `INSERT INTO talks (id, talk_id, at, data) VALUES (?, ?, ?, ?)`,
    [row.id ?? null, row.talkId, row.at.getTime(), json({ ...row, id: undefined })])

  async function getSettings(): Promise<Settings> {
    const [row] = await driver.all<DataRow>(`SELECT data FROM settings WHERE key = 'settings'`)
    return settingsSchema.parse(row ? JSON.parse(row.data) : {})
  }

  async function sessions() {
    return parseRows(await driver.all<DataRow>(`SELECT data FROM sessions`), raw => sessionSchema.parse(raw))
  }

  return {
    getSettings,

    async saveSettings(patch) {
      const next = settingsSchema.parse({ ...(await getSettings()), ...patch })
      await driver.run(`INSERT OR REPLACE INTO settings (key, data) VALUES ('settings', ?)`, [json(next)])
      return next
    },

    async addWord(input, now = new Date()) {
      const word = newWordSchema.parse(input)
      const answerKey = normalizeAnswer(word.answer)
      const [existing] = await cards(`WHERE answer_key = ? LIMIT 1`, [answerKey])
      if (existing) throw new DuplicateWordError(existing)

      const fsrs = newFsrsState(now)
      const card = cardSchema.parse({
        id: crypto.randomUUID(),
        type: 'word',
        ...word,
        answerKey,
        fsrs,
        due: fsrs.due,
        createdAt: now,
      })
      await putCard(card)
      return card
    },

    async setCardImage(id, image) {
      const [card] = await cards(`WHERE id = ?`, [id])
      if (card) await putCard(cardSchema.parse({ ...card, image }))
    },

    async deleteCard(id) {
      await driver.transaction(async () => {
        await driver.run(`DELETE FROM cards WHERE id = ?`, [id])
        await driver.run(`DELETE FROM reviews WHERE card_id = ?`, [id])
        await driver.run(`DELETE FROM mistakes WHERE item_id = ?`, [id])
      })
    },

    recentCards: limit => cards(`ORDER BY created_at DESC LIMIT ?`, [limit]),
    dueCards: (now, limit) => cards(`WHERE due <= ? ORDER BY due LIMIT ?`, [now.getTime(), limit]),
    countDue: now => count(`SELECT COUNT(*) AS n FROM cards WHERE due <= ?`, [now.getTime()]),
    countCards: () => count(`SELECT COUNT(*) AS n FROM cards`),
    // FSRS state 2 is Review: past the learning steps.
    countLearned: () => count(`SELECT COUNT(*) AS n FROM cards WHERE state = 2`),
    cardsInFile: (book, file) => cards(`WHERE book = ? AND file = ?`, [book, file]),
    allCards: () => cards(`ORDER BY created_at DESC`),
    async countIntroducedSince(since) {
      return (await cards('')).filter(card => card.introducedAt && card.introducedAt >= since).length
    },

    async saveAnswer({ card, review, mistake }) {
      await driver.transaction(async () => {
        await putCard(card)
        await addReview(review)
        if (mistake) await addMistake(mistake)
      })
    },

    async grammarStates() {
      return parseRows(await driver.all<DataRow>(`SELECT data FROM grammar`), raw => grammarSchema.parse(raw))
    },

    async saveGrammarAnswer(row, mistake) {
      await driver.transaction(async () => {
        await putGrammar(row)
        if (mistake) await addMistake(mistake)
      })
    },

    async mistakeCounts(since) {
      const rows = await driver.all<{ type: MistakeType, n: number }>(
        `SELECT type, COUNT(*) AS n FROM mistakes WHERE at >= ? GROUP BY type`, [since.getTime()])
      return Object.fromEntries(rows.map(r => [r.type, r.n]))
    },

    async saveMistake(mistake) {
      await addMistake(mistakeSchema.parse(mistake))
    },

    async mistakesSince(since) {
      const rows = await driver.all<DataRow>(`SELECT id, data FROM mistakes WHERE at >= ? ORDER BY at`, [since.getTime()])
      return parseRows(rows, raw => mistakeSchema.parse(raw))
    },

    async saveBossResult(result) {
      await addBoss(bossResultSchema.parse(result))
    },

    async bossResults() {
      const rows = await driver.all<DataRow>(`SELECT id, data FROM bosses ORDER BY at DESC`)
      return parseRows(rows, raw => bossResultSchema.parse(raw))
    },

    async saveTalk(result) {
      await addTalk(talkResultSchema.parse(result))
    },

    async talkResults() {
      const rows = await driver.all<DataRow>(`SELECT id, data FROM talks ORDER BY at DESC`)
      return parseRows(rows, raw => talkResultSchema.parse(raw))
    },

    async recordActivity(date, game, minutes, score) {
      await driver.transaction(async () => {
        const [row] = await driver.all<DataRow>(`SELECT data FROM sessions WHERE date = ?`, [date])
        const current = row ? sessionSchema.parse(JSON.parse(row.data)) : { date, games: [], minutes: 0, rounds: [] }
        await putSession({
          date,
          games: [...current.games, game],
          minutes: Math.round((current.minutes + Math.max(0, minutes)) * 10) / 10,
          rounds: [...current.rounds, ...(score ? [{ game, ...score }] : [])],
        })
      })
    },

    async studyDays() {
      return (await sessions()).filter(row => row.games.length > 0).map(row => row.date)
    },

    sessions,

    async gamesOn(date) {
      const [row] = await driver.all<DataRow>(`SELECT data FROM sessions WHERE date = ?`, [date])
      return row ? sessionSchema.parse(JSON.parse(row.data)).games : []
    },

    async exportAll(now = new Date()) {
      const all = async <T>(table: string, parse: (raw: unknown) => T, withId = false) =>
        parseRows(await driver.all<DataRow>(`SELECT ${withId ? 'id, ' : ''}data FROM ${table}`), parse)
      return {
        app: 'rien' as const,
        version: 1 as const,
        exportedAt: now,
        cards: await all('cards', raw => cardSchema.parse(raw)),
        reviews: await all('reviews', raw => reviewSchema.parse(raw), true),
        mistakes: await all('mistakes', raw => mistakeSchema.parse(raw), true),
        sessions: await sessions(),
        grammar: await all('grammar', raw => grammarSchema.parse(raw)),
        bosses: await all('bosses', raw => bossResultSchema.parse(raw), true),
        talks: await all('talks', raw => talkResultSchema.parse(raw), true),
        settings: await getSettings(),
      }
    },

    async importAll(raw) {
      const backup = backupSchema.parse(raw)
      await driver.transaction(async () => {
        for (const table of TABLES) await driver.run(`DELETE FROM ${table}`)
        for (const card of backup.cards) await putCard(card)
        for (const review of backup.reviews) await addReview(review)
        for (const mistake of backup.mistakes) await addMistake(mistake)
        for (const session of backup.sessions) await putSession(session)
        for (const row of backup.grammar) await putGrammar(row)
        for (const boss of backup.bosses) await addBoss(boss)
        for (const talk of backup.talks) await addTalk(talk)
        await driver.run(`INSERT INTO settings (key, data) VALUES ('settings', ?)`, [json(backup.settings)])
      })
      return { cards: backup.cards.length }
    },
  }
}
