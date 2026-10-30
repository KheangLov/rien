import { packIndexSchema, packSchema, type Pack } from '#shared/schemas/pack'

let loading: Promise<Pack[]> | undefined

// Loads every content pack listed in /packs/index.json. A pack that fails
// validation is skipped, so one typo cannot break a game.
async function loadPacks(): Promise<Pack[]> {
  const index = packIndexSchema.parse(await $fetch('/packs/index.json'))
  const packs = await Promise.all(index.packs.map(async (name) => {
    try {
      return packSchema.parse(await $fetch(`/packs/${name}`))
    }
    catch (error) {
      console.error(`[rien] skipped content pack ${name}`, error)
      return undefined
    }
  }))
  return packs.filter((pack): pack is Pack => pack !== undefined)
}

export function usePacks(): Promise<Pack[]> {
  loading ??= loadPacks().catch((error) => {
    loading = undefined
    throw error
  })
  return loading
}
