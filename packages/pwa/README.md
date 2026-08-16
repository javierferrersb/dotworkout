# @dotworkout/pwa

The browser app: <https://workout.javierferrersb.dev>. Builds Apple `.workout`
files on [`@dotworkout/domain`](https://www.npmjs.com/package/@dotworkout/domain).
Runs entirely on the client — not published to npm.

## What it is

Pick an activity, name the workout, then compose it block by block. Each block
asks one question at a time — goal, distance or time, alert, label — using only
the goals and alerts that activity actually supports, so there is nothing to
get wrong. The whole thing is keyboard-first: arrow keys move between
questions and blocks, Enter confirms, Tab skips an optional one, Escape
deselects. `unfinishedBlocks()` (from `src/domain/interview.ts`) catches a
block left half-answered before it silently becomes a different workout — a
send-off never entered composes to a plain distance goal, and the Watch would
accept that without complaint.

## Getting the file onto a phone

The browser has no way to hand a file to the Watch app directly, and the
machine you're composing on is rarely the one paired with it. So the finished
workout is encoded into the page's URL hash and offered as a QR code
(`src/application/share.ts`, `readWorkoutLink`/`workoutLink` from
`@dotworkout/domain`) — scan it and the composer reopens on the phone with the
workout already loaded, ready to download. Nothing is uploaded and no account
is involved; the workout travels inside the link itself.

## Everything else runs locally

The in-progress session (`src/application/sessionStore.ts`), theme, and locale
choice all live in `localStorage`. Nothing is sent anywhere until you choose to
share a link. This is also a PWA (`vite-plugin-pwa`): install it and it works
offline, including composing a new workout with no connection.

## Two languages

`src/i18n/` — English and Spanish, detected from `navigator.language` and
overridable in the menu. Every user-facing string goes through `t(key)`; there
is no hard-coded copy in components.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — production build.
- `npm run preview` — serve the production build locally.
- `npm run check` — `svelte-check` against `tsconfig.json`.

Tests live at the repo root and run with the rest of the monorepo:
`npm test`.

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten missing fields and enum values were added; see `spec/FORMAT.md` §8 in
the repo. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
