# Squirkle UI issues found while building Rien

Drafts to file on [KheangLov/squirkle-ui](https://github.com/KheangLov/squirkle-ui), found with
`@squirkle-ui/ui`, `@squirkle-ui/nuxt`, `@squirkle-ui/charts` 0.1.1 and `@squirkle-ui/calendar` 0.1.2
on Nuxt 4.6.2, Vue 3.5, iOS 26 Safari and WKWebView. Each lists the workaround Rien uses today.

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
