# @dotworkout/pwa

The browser app: <https://workout.javierferrersb.dev>. Builds Apple `.workout`
files on [`@dotworkout/domain`](https://www.npmjs.com/package/@dotworkout/domain).
Runs entirely on the client — not published to npm.

## What it is

Pick an activity and the workout opens as a list of steps — warm up, sets,
rests, cool down — with a strip above it drawing the session's shape. Open a
step and its fields are all there at once: the goal, the distance with its
unit beside it, repeats, rest, target and name, offering only the goals and
targets that activity actually supports (`questionSequence()` in
`src/domain/interview.ts`). Edits keep every value that still applies
(`src/application/stepEdit.ts`), so switching a goal or a kind never throws
the rest of the step away, and deleting a step can be undone.

It stays keyboard-first: W, S, R and C add a step and land in its first empty
field, Enter moves to the next field and closes the step after the last, the
arrow keys move between steps, ⌘Z / Ctrl+Z undoes, ⌘S / Ctrl+S downloads.
`unfinishedBlocks()` catches a step left half-filled before it silently
becomes a different workout — a send-off never entered composes to a plain
distance goal, and the Watch would accept that without complaint — and
Download opens that step at the missing field instead of saving it.

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
