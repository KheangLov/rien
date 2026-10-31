import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Reverse of kheanglov.github.io, confirmed 2026-10-31. Apple does not allow
  // changing the bundle ID once the App Store Connect record exists.
  appId: 'io.github.kheanglov.rien',
  appName: 'Rien',
  // The static build from `pnpm build:ios`.
  webDir: '.output/public',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
    },
  },
}

export default config
