import { registerPlugin } from '@capacitor/core'
import type { Settings } from '#shared/schemas/db'

// Android only (android/…/RienLookPlugin.java): her look for the parts Android
// draws itself, and the screen a long-press shortcut asked for.
export const RienLook = registerPlugin<{
  // Her Appearance, for the system's own splash screen at launch.
  setAppearance: (options: { appearance: Settings['appearance'] }) => Promise<void>
  // The home-screen icon's colour, switched when she next leaves the app.
  setLauncherIcon: (options: { accent: Settings['accent'] }) => Promise<void>
  // The route of the shortcut that started the app, once.
  takeLaunchRoute: () => Promise<{ route?: string | null }>
}>('RienLook')
