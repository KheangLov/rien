import { addCollection } from '@squirkle-ui/ui'
import solar from '~/assets/icons/solar.json'

// Solar icons for SqIcon, registered from a bundled subset so they work offline
// (Squirkle's icon API is off: squirkle.icons.api = false). Built by
// scripts/build-icons.mjs. Solar by 480 Design, CC BY 4.0.
export default defineNuxtPlugin(() => {
  addCollection(solar)
})
