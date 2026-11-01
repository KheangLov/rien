import { Capacitor } from '@capacitor/core'
import { autoBackupDate, autoBackupName, staleAutoBackups } from '#shared/utils/backups'

// Saves a backup file. The web uses a download link; the iPhone app's web view
// ignores downloads, so there it writes the file and opens the share sheet
// (Save to Files, AirDrop, Messages).
export async function saveBackupFile(name: string, contents: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
    return
  }

  const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const { uri } = await Filesystem.writeFile({
    path: name,
    data: contents,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  await Share.share({ title: 'Rien backup', files: [uri] })
}

// Saves a backup file of everything (Settings, and the Today reminder on the
// web) and remembers when, for the reminder. Returns how many words it holds.
export async function exportBackup(now = new Date()): Promise<number> {
  const db = useDb()
  const backup = await db.exportAll()
  await saveBackupFile(`rien-backup-${now.toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2))
  await db.saveSettings({ lastBackupAt: now })
  return backup.cards.length
}

// --- Automatic copies in the Rien app (shared/utils/backups.ts) ---------------
// Kept in the app's own data folder, which the phone's backup (Google on
// Android, iCloud on iPhone) includes, so they leave the phone too.
const AUTO_DIR = 'backups'

async function filesystem() {
  return import('@capacitor/filesystem')
}

export async function saveAutoBackup(now = new Date()): Promise<void> {
  const db = useDb()
  const { Directory, Encoding, Filesystem } = await filesystem()
  const backup = await db.exportAll(now)
  await Filesystem.writeFile({
    path: `${AUTO_DIR}/${autoBackupName(now)}`,
    data: JSON.stringify(backup),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  })
  for (const name of staleAutoBackups((await listAutoBackups()).map(b => b.name))) {
    await Filesystem.deleteFile({ path: `${AUTO_DIR}/${name}`, directory: Directory.Data }).catch(() => {})
  }
  await db.saveSettings({ lastAutoBackupAt: now })
}

export async function listAutoBackups(): Promise<{ name: string, date: Date }[]> {
  if (!Capacitor.isNativePlatform()) return []
  const { Directory, Filesystem } = await filesystem()
  try {
    const { files } = await Filesystem.readdir({ path: AUTO_DIR, directory: Directory.Data })
    return files
      .flatMap(file => (autoBackupDate(file.name) ? [{ name: file.name, date: autoBackupDate(file.name)! }] : []))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
  }
  catch {
    // No copies yet.
    return []
  }
}

// Replaces everything with an automatic copy. Returns how many words it had.
export async function restoreAutoBackup(name: string): Promise<number> {
  const { Directory, Encoding, Filesystem } = await filesystem()
  const { data } = await Filesystem.readFile({ path: `${AUTO_DIR}/${name}`, directory: Directory.Data, encoding: Encoding.UTF8 })
  const { cards } = await useDb().importAll(JSON.parse(String(data)))
  return cards
}
