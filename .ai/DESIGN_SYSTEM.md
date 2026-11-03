# Design system

**Purpose:** the single source for tokens, components and Figma mapping. **Read when:** any UI task.

## Token sources
- Squirkle theme in `nuxt.config.ts` (`squirkle.theme`) generates the `--sq-*` variables; no runtime `setBrand()`.
- Rien variables in `app/assets/css/main.css` (only app stylesheet).
- Accent palettes ("her colour") in `app/utils/accents.ts:13-22`; `accentCss()` builds light and dark rules.
- Splash colours in `scripts/brand.ts:6-7`.

## Tokens (groups, naming pattern, path; big scales not listed value by value)
| Token | Value | Theme | Defined in | Figma variable |
| --- | --- | --- | --- | --- |
| `--sq-primary`, `--sq-on-primary` | `#0f766e` / `#f8fafc` light; `#2dd4bf` dark | both | `nuxt.config.ts` | — |
| `--sq-surface`, `--sq-surface-raised`, `--sq-background`, `--sq-border` | `#fcfcfd` / `#fdfdfe` light | both | `nuxt.config.ts` | — |
| `--sq-r`, `--sq-bg`, `--sq-bd`, `--sq-bw`, `--sq-shadow` | per element; `--sq-r` set by `app/components/Squircle.vue` | both | `app/assets/css/main.css` | — |
| `--rien-font`, `--rien-tap` (44px) | system font stack with Khmer fallbacks | both | `app/assets/css/main.css` | — |
| `--rien-tabbar-h` | 56px / 66px | both | `app/assets/css/main.css` | — |
| `--rien-glass-*` (bg, strong, edge, shadow) | Liquid Glass | light + dark override | `app/assets/css/main.css` | — |
| `--ios-separator`, `--ios-fill`, `--ios-secondary`, `--ios-tertiary` | iOS system greys | light + dark | `app/assets/css/main.css` | — |
| `--rien-brand`, `--rien-tint-1..3`, `--rien-logo-*` | 8 accent palettes | light + dark | `app/utils/accents.ts` | — |

Spacing, font sizes and easings are literal values (no spacing or type tokens).

## Theming
- `app/plugins/appearance.client.ts` is the single driver: toggles `html.rien-dark`, `html.rien-glass`, `html.rien-motion`, Squirkle theme classes, `color-scheme`, the theme-color meta and the accent style.
- Settings (`shared/schemas/db.ts:215-221`): appearance system/light/dark, accent (8 colours, default teal), liquidGlass (on), motion (on; off under prefers-reduced-motion).
- Dark styles use `html.rien-dark X` selectors. Theme changes animate with a View Transition circle reveal.
- Page transitions: `app/middleware/transition.global.ts` (push, pop, modal, dismiss, fade). Haptics: `app/composables/useHaptics.ts`.
- Layout: one column, `.rien-page` max 560px, portrait only, safe-area insets on `.rien-shell`; no width breakpoints.

## Components (reusable only)
| Component | Path | Key props / variants | Figma component |
| --- | --- | --- | --- |
| IosGroup | `app/components/ios/IosGroup.vue` | header, footer; slot of rows | — |
| IosRow | `app/components/ios/IosRow.vue` | label, subtitle, value, icon, to, chevron, tint primary/danger | — |
| IosPicker | `app/components/ios/IosPicker.vue` | label, modelValue, options; native select wheel | — |
| IosSwitch | `app/components/ios/IosSwitch.vue` | modelValue, label | — |
| IosSegmented | `app/components/ios/IosSegmented.vue` | modelValue, options, label | — |
| IosSheet | `app/components/ios/IosSheet.vue` | open, title; emits close; drag down to close | — |
| Squircle | `app/components/Squircle.vue` | tag, radius (24), clip, surface | — |
| ActionBar | `app/components/ActionBar.vue` | fixed (teleports to body) | — |
| PageHeader | `app/components/PageHeader.vue` | title, subtitle, back; collapsing large title | — |
| RienIcon | `app/components/RienIcon.vue` | name, size (24), weight | — |
| FishSprite | `app/components/tank/FishSprite.vue` | species, stage, health, width, silhouette | — |
| RuleVisual | `app/components/learn/RuleVisual.vue` | type, when | — |
| StudyCalendar | `app/components/StudyCalendar.vue` | days, today | — |
| Squirkle | `Sq*` from `@squirkle-ui/ui` | most used: SqBtn, SqCard, SqCardText, SqAlert, SqCardActions | — |

## Icons, assets, i18n
- Icons: Solar subset built by `scripts/build-icons.mjs` (`pnpm icons`) into `app/assets/icons/solar.json`, registered in `app/plugins/icons.client.ts`; use `RienIcon`. Custom `rien-fish` icon drawn in Solar style. Credit (CC BY 4.0) in `README.md` and the Me screen.
- Word pictures are small JPEG data URLs; grammar pictures come from `RuleVisual`.
- i18n: none; English strings inline; Khmer only in the font stack.

## Rules
- DS-1 · MUST · REVIEW · Never hardcode a color, size, radius, shadow or font when a token exists; no exact match → nearest token, flagged in the prompt.
- DS-1a · MUST · REVIEW · Illustration SVG (`app/components/tank/`, `app/components/learn/`) may use a fixed literal palette; parts that follow the accent or theme use `--sq-primary` or `--rien-tint-*`; soft whites only (P-1).
- DS-2 · MUST · REVIEW · Reuse or extend an existing component before creating one; a new one is justified in the plan.
- DS-3 · MUST · REVIEW · New tokens only when the approved prompt lists them.

## Figma
- Follow the connected Figma server's own instructions first; some servers require a session call or a design-to-code skill before any fetch.
- Fetch only the node in the given URL: metadata for big frames, then design context per child node, variables once, one screenshot per frame.
- Design-context output is a reference in another stack: translate it to this project's components, tokens and inline strings; never paste it.
- States and breakpoints the design doesn't show are questions or `ASSUMPTION:` lines in the prompt.
- Confirmed mappings are added to the tables above after each Figma task.
