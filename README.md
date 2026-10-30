# Rien (រៀន)

Daily English practice for ACE General English, Level 6 to Level 12.
Client-only Nuxt 4 PWA with Squirkle UI. Everything is stored on the device.

## Setup

```bash
nvm use            # Node 26.13.0 (see .nvmrc); minimum ^24.22.1 || >=26.12.1
pnpm install       # pnpm 11; install scripts and fresh releases are restricted in pnpm-workspace.yaml
pnpm dev           # http://localhost:3000
pnpm generate      # static build in .output/public
pnpm preview       # serve the static build
pnpm audit         # fails on high-severity advisories
```

## Day 1 phone check

1. Deploy `.output/public` to any static HTTPS host.
2. On her iPhone, open it in Safari, then Share → Add to Home Screen.
3. Open it once online, then in Airplane Mode: it should still open.
4. Open **Speech test** in Safari and again from the Home Screen, then send the copied report.
