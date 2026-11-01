import type { Pack } from '#shared/schemas/pack'

// The IELTS practice material from every pack (public/packs/ielts.json).
export async function loadIelts() {
  const packs: Pack[] = await usePacks()
  return {
    speaking: packs.flatMap(p => p.ieltsSpeaking),
    writing: packs.flatMap(p => p.ieltsWriting),
    reading: packs.flatMap(p => p.ieltsReading),
    listening: packs.flatMap(p => p.ieltsListening),
    academicWords: packs.flatMap(p => p.academicWords),
  }
}
