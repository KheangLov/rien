import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Reverse of kheanglov.github.io, confirmed 2026-10-31. Apple does not allow
  // changing the bundle ID once the App Store Connect record exists.
  appId: 'io.github.kheanglov.rien',
  appName: 'Rien',
  // The static build from `pnpm build:ios` or `pnpm build:android`.
  webDir: '.output/public',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    // Shrink the web view when the keyboard opens, so the pinned Check button
    // sits above the keyboard instead of behind it.
    Keyboard: {
      resize: 'native',
      // Android: still shrink the web view when it draws under the status bar.
      resizeOnFullScreen: true,
    },
    // Android: edge to edge like the iPhone app; env(safe-area-inset-*) works.
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
    },
  },
}

export default config
