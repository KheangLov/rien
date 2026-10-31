import { Capacitor } from '@capacitor/core'

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
