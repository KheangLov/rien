import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Reverse of kheanglov.github.io. Apple does not allow changing the bundle ID
  // once the App Store Connect record exists, so confirm it before the first upload.
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
