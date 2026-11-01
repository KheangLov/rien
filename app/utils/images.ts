// Shrinks a chosen photo to a small JPEG data URL (at most 360 px wide), so a
// picture per word fits easily in the phone's database and in backups.
export async function shrinkImage(file: File, max = 360, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  }
  finally {
    URL.revokeObjectURL(url)
  }
}
