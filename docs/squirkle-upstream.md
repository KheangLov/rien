# Squirkle UI issues found while building Rien

Drafts to file on [KheangLov/squirkle-ui](https://github.com/KheangLov/squirkle-ui), found with
`@squirkle-ui/ui`, `@squirkle-ui/nuxt`, `@squirkle-ui/charts` 0.1.1 and `@squirkle-ui/calendar` 0.1.2
on Nuxt 4.6.2, Vue 3.5, iOS 26 Safari and WKWebView. Each lists the workaround Rien uses today.
Fixed upstream so far: 10 (`@squirkle-ui/core` 0.1.2) and 12 (`@squirkle-ui/ui` 0.1.2).

## 1. Text fields at 14px make iPhones zoom in on focus

`--sq-text-md` is 14px, and `.sq-field__input input` uses it. iOS Safari and WKWebView zoom the
page when a field under 16px gets focus, and the page stays zoomed, cutting off the layout.

- Repro: any `SqTextField` on an iPhone; tap it.
- Rien: `.rien-shell.rien-shell input { font-size: max(16px, 1em) }` (two classes to beat
  `.sq-field__input input`, which loads later with the same specificity).
- Suggested fix: `font-size: max(16px, var(--sq-text-md))` on field inputs, or a documented token.

## 2. `SqTextField` does not pass input attributes through

`autocorrect`, `autocapitalize`, `spellcheck` and `enterkeyhint` set on `SqTextField` never
reach the inner `<input>` (the component renders a fixed attribute list). For a language-learning
app, iOS autocorrect silently fixes the very mistakes being practised.

- Rien: a `v-plain-input` directive that finds the inner input and sets the attributes.
- Suggested fix: forward these (or `inputAttrs`) to the `<input>`.

## 3. Nuxt module: runtime theme changes are overwritten, and `<html>` gets two theme classes

The plugin template calls `useHead({ style: [{ id: 'sq-theme-vars', innerHTML: getThemeCss() }],
htmlAttrs: { class: 'sq-theme--' + config.theme.name } })` once. On the client, `useTheme().setBrand()`
updates `#sq-theme-vars`, then the head manager writes the original CSS back. Switching to dark
leaves `<html class="sq-theme--dark sq-theme--light">`.

- Repro: in a Nuxt client plugin, `useTheme().setBrand('#0f766e')`; `--sq-primary` stays the default.
- Rien: brand colours passed through the module option `squirkle.theme.themes`.
- Suggested fix: make the head entries reactive (computed `innerHTML` and class), or skip them on the
  client and let `syncThemeToDocument` own the element.

## 4. `SqBarChart` axis labels show floating-point noise

With small values the ticks read `0.6000000000000001 min`, and the long label overflows the frame.

- Rien: `:format="v => \`${Number(v.toFixed(1))} min\`"`.
- Suggested fix: round tick values (or the default formatter) to the step's precision.

## 5. `SqCalendar` all-day events spill into the next day

An all-day event with `start: '2026-10-31'` and no `end` also renders on 1 November.

- Rien: sets `end` to the same date.
- Suggested fix: treat a missing `end` on an all-day event as the same day.

## 6. `SqCalendar` shows the view switch with a single view

`:views="['month']"` still renders a "Month" toggle.

- Suggested fix: hide the switch when `views.length < 2`.

## 7. `SqBtn` with `to` does not render a link

`<SqBtn to="/words">` renders a `<button>` that navigates by script, so there is no `href`
(no long-press preview, no open-in-new-tab, and screen readers announce a button).

- Suggested fix: render `<a href>` (or `NuxtLink`/`RouterLink` when present) when `to` or `href` is set.

## 8. Nested component folders and the Nuxt module

Not a Squirkle bug, but worth a docs note: `SqApp` is a named-area grid, so page content must be
inside `SqMain`, or it lands in the narrow `start` column and shrinks to its content.

## 9. `.sq-surface { position: relative }` overrides app positioning

Squirkle's stylesheet loads after the app's, so `.sq-surface { position: relative }` beats an app rule
of equal specificity such as `.my-sheet { position: fixed }`. Any squircle surface that needs `fixed`
or `absolute` (a bottom sheet, a sliding tab lens) silently falls back into the page flow.

- Rien: two-class selectors (`.ios-sheet.sq-surface`, `.rien-tabbar .rien-tab-lens`).
- Suggested fix: `:where(.sq-surface) { position: relative }` (zero specificity), or document it.

## 10. The SVG fallback draws a different shape from native `corner-shape` (Safari, iOS) — fixed in core 0.1.2

Native: `.sq-surface` gets `border-radius: r * (1 + smoothing); corner-shape: squircle`, a
superellipse filling a corner box of 1.6 × r. Fallback (`SqShape`, used wherever
`CSS.supports('corner-shape', 'squircle')` is false: every iPhone and Safari today, Safari 26.5
checked): `getSquirclePath` draws a Figma-style smoothed corner whose arc keeps radius r. Same
props, visibly different shape: on the iPhone it reads as an ordinary rounded rectangle, while
Chrome and Android show clear squircles.

- Rien: `patches/@squirkle-ui__core@0.1.1.patch` makes `getSquirclePath` draw the same superellipse
  as native (24 points per corner, corners scaled down together when they do not fit, like CSS).
  Checked by overlaying both in Chrome: no visible difference.
- Suggested fix: the same in `@squirkle-ui/core`, keeping the Figma path behind an option for anyone
  who wants it. Remove Rien's patch once a release has it.
- Fixed: `@squirkle-ui/core` 0.1.2 draws this superellipse by default (`geometry: 'css'`; the Figma
  shape is `geometry: 'figma'`). Rien's patch is gone.

## 11. `SqCalendar` month view does not fit a phone

At 390 px the toolbar (Today, arrows, title, view switch) wraps onto two lines, and month cells keep
a tall event height, so a month takes more than a screen. Rien replaced it with its own compact
month grid (`app/components/StudyCalendar.vue`) for showing study days.

- Suggested fix: a compact toolbar below ~480 px (title on its own row, icon-only Today), and a
  dense month mode (square cells, dots instead of event chips).

Related, found the same day: a clipped element that keeps its own `border-radius` shows that
circle, not the squircle (a circle corner sits inside a squircle corner of the same size, so the clip
never touches it). `SqShape` with `clip` on an element that paints its own background has this
problem. Rien sets the element's radius to half the squircle's corner while clipped
(`.rien-sq[data-sq-shape]:not(.sq-surface)` and `app/plugins/squircles.client.ts`).
- Suggested fix: `SqShape` sets the host's radius the same way while `clip` is on.

## 12. Icon aliases cannot replace built-in icon names — fixed in ui 0.1.2

`icons.aliases` applied only to `$name`, while Squirkle's own controls (clear buttons, chevrons, alerts,
checkboxes) ask for bare built-in names such as `close` and `chevronDown`, so an app could not draw them
from its own icon set.

- Rien: had `patches/@squirkle-ui__ui@0.1.1.patch`, now removed.
- Fixed: `@squirkle-ui/ui` 0.1.2 also applies an alias whose key is a bare built-in name.
