# dotworkout

TypeScript library for reading and authoring Apple `.workout` files — the binary
format the iOS Workout app imports and syncs to Apple Watch.

Two packages, separately importable:

| Package | What it is |
|---|---|
| `@dotworkout/codec` | Decode/encode the wire format. No opinions, no validation, no unit conversion. |
| `@dotworkout/domain` | Authoring API oriented around swimming, plus validation. Depends on the codec. |

The format itself is documented in [`spec/FORMAT.md`](spec/FORMAT.md), which is
the source of truth for everything below.

## Quick start

```ts
import { swim } from "@dotworkout/domain";

const bytes = swim("Thursday threshold")
  .warmup(400)
  .repeat(8).of(50).rest(30).label("Build")
  .repeat(4).of(100).on("2:00")     // send-off: leave every 2:00
  .cooldown(200)
  .toBytes();
```

`.on()` is the `DISTANCE_TIME` goal — "8 × 50 on 1:00" means leave every 60
seconds regardless of finishing time. It is how essentially every swim set is
written, and the composer offers it for swimming only.

Reading and editing an existing file:

```ts
import { decode, encode } from "@dotworkout/codec";
import { editStepAt, totalDistance } from "@dotworkout/domain";

const workout = decode(bytes);
const totals = totalDistance(workout.customWorkout!);
// totals.byLabel → per-label breakdown; labels are where stroke lives

const edited = editStepAt(workout, "custom_workout.interval_blocks[0].interval_steps[0].workout_step",
  (step) => { step.displayName = "Build (fins)"; });
encode(edited);   // everything else is byte-for-byte what it was
```

## Commands

```bash
npm test
```

Builds both packages and runs the full suite. Other scripts:

- `npm run generate` — regenerate protobuf bindings from `proto/` and the
  compatibility data from `constraints/compatibility.json`. Both outputs are
  **checked in**, so an ordinary build needs neither protoc nor the buf CLI.
- `npm run build` — TypeScript only.
- `npm run check` — regenerate, then build and test.

Tests run on Node's built-in test runner (`node --test`), so the only
dependencies are the protobuf tooling and TypeScript.

## The conformance suite

`packages/codec/test/conformance.test.ts` asserts three things for each of the
20 real files in `testdata/`:

1. `decode(bytes)` deep-equals the paired `.json`
2. `encode(decode(bytes))` is byte-identical to the original
3. decoding yields **zero unknown fields**

Assertion 3 is the one that matters. Nine of these files round-trip
byte-identically against an *incomplete* schema, because protobuf runtimes
silently retain and re-emit fields they do not recognise — which is exactly how
ten real bugs hid in the upstream library this schema came from (spec §8).
Byte-identical round-tripping is not evidence of a complete schema; only the
absence of unknown fields is.

protobuf-es v2 stores unrecognised fields per-message on `$unknown` (v1's
`getUnknownFields()` was removed), so `findUnknownFields()` walks the whole tree
— every nested message, every element of every repeated field. Checking only the
root `WorkoutBinary` would miss all ten: `SpeedAlert.speed_target` sits four
levels down.

`packages/codec/test/unknown-fields.test.ts` is the negative control. It
reconstructs six of the ten historical schema gaps by editing descriptors at
runtime, then asserts for each that the file **still round-trips byte-identically
against the broken schema** while assertion 3 catches it. Without that, a green
assertion 3 only proves the schema agrees with itself.

## Where each rule lives

Three different sources of truth, deliberately kept apart:

| Kind of rule | Lives in | Example |
|---|---|---|
| Wire structure | `proto/` as protovalidate CEL options | `iterations >= 1`; `goal_type` matching its payload; range bounds ordered; exactly one container field |
| Sport compatibility | `constraints/compatibility.json` | which goals and alerts each sport offers |
| Everything else | `spec/FORMAT.md` | provenance, open questions |

The compatibility matrix is loaded at **build time** into
`packages/domain/src/generated/compatibility-data.ts` and is never restated in
TypeScript or in prose. A test recomputes the source file's SHA-256 and fails if
the JSON changed without regeneration, so the two cannot drift.

Confidence levels are honoured as `constraints/README.md` specifies:

- **confirmed** → enforce. A power alert on a swim is an error.
- **unverified / unknown** → allow, and warn. A heart-rate alert on a bike is a
  warning, never a rejection.

A combination nobody checked is not a combination known to be illegal. The cost
of wrongly allowing one is a file the Watch declines to import; the cost of
wrongly forbidding one is a workout the user cannot create at all. Every issue
also carries a stable `code`, and `validateWorkout(msg, { downgradeToWarning })`
demotes any of them — because the matrix was read off one device on one day, and
when it is wrong the way through must not be "edit the library".

## Deliberate non-features

- **No unit canonicalisation.** 100 m authored as miles becomes 0.06 mi, which
  is 96.6 m. Authored units survive untouched; `toMeters()` exists for display
  and is never written back.
- **No lap counts.** Pool length is chosen when the workout starts on the Watch
  and is not in the file, so laps are unknowable at authoring time.
- **No assumed container.** `decode()` branches on field 10
  (`SingleGoalWorkout`) vs field 11 (`CustomWorkout`) and fails with a clear
  message on anything else, rather than assuming field 11. Pacer and
  swim-bike-run workouts most likely occupy further sibling fields (spec §9);
  when one turns up, the error says so and asks for a corpus file.

## Open questions

`spec/FORMAT.md` §9 lists what is still unverified. The two that would most
change this library:

- **Pacer / swim-bike-run containers.** Structurally unknown. The decoder is
  written to fail loudly rather than guess.
- **`PowerAlert.PowerBound.unit`.** Observed only as `1`, presumed watts.

Every open question so far has been settled empirically by exporting a new
`.workout` file from the phone and adding it to `testdata/`. That remains the
way to settle the rest.
