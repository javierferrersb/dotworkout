<img src="packages/pwa/public/icon-192.png" width="96" alt="" />

# dotworkout

[![CI](https://github.com/javierferrersb/dotworkout/actions/workflows/ci.yml/badge.svg)](https://github.com/javierferrersb/dotworkout/actions/workflows/ci.yml)

Read and write Apple `.workout` files in TypeScript. These are the custom
workouts the Workout app on an Apple Watch runs.

The format is undocumented. This repo works it out from 20 real exports, all of
which decode with zero unknown fields and re-encode byte for byte.
[`spec/FORMAT.md`](spec/FORMAT.md) has the details.

There is also a browser app for building workouts:
<https://workout.javierferrersb.dev>

## Packages

| Package | What it does |
|---|---|
| `@dotworkout/codec` | Decodes and encodes the binary format. Nothing else. |
| `@dotworkout/domain` | Builds and validates workouts. Uses the codec. |
| `@dotworkout/notation` | Parses sets written as text, like `8x50 on 1:00 Build`. Not published. |
| `@dotworkout/mcp` | MCP server, so agents can build workouts. |
| `@dotworkout/pwa` | The browser app. Runs entirely on the client. Not published. |

```bash
npm install @dotworkout/domain
```

That pulls in the codec. Install `@dotworkout/codec` on its own if all you want
is to read and write files.

## Writing a workout

```ts
import { swim } from "@dotworkout/domain";

const bytes = swim("Thursday threshold")
  .warmup(400)
  .repeat(8).of(50).rest(30).label("Build")
  .repeat(4).of(100).on("2:00")
  .cooldown(200)
  .toBytes();
```

`.on("2:00")` is the `DISTANCE_TIME` goal: leave every two minutes no matter how
fast you finish. Most swim sets are written this way. Only swimming offers it.

## Reading and editing one

```ts
import { decode, encode } from "@dotworkout/codec";
import { editStepAt, totalDistance } from "@dotworkout/domain";

const workout = decode(bytes);
const totals = totalDistance(workout.customWorkout!);

const edited = editStepAt(
  workout,
  "custom_workout.interval_blocks[0].interval_steps[0].workout_step",
  (step) => { step.displayName = "Build (fins)"; },
);

encode(edited);
```

Everything you did not touch comes back byte for byte.

## Notation

`@dotworkout/notation` parses sets written as text — `8x50 on 1:00 Build`. It is
not published, because nothing consumes it since the terminal composer was
removed. The grammar is in
[`packages/notation/README.md`](packages/notation/README.md).

## Building workouts with an agent

`@dotworkout/mcp` is an MCP server, so Claude and other agents can build these
files. It exposes five tools: list and describe activities, validate a workout,
write one to disk, and inspect an existing file.

The activity tools are the useful part. A model cannot write this format from
memory, and it has no idea which goals and alerts each sport offers — that came
off a real device and lives in `constraints/compatibility.json`. Asking gets you
a file the Watch accepts; guessing gets you one it rejects.

It needs [Claude Code](https://claude.com/claude-code) — the CLI, not the Claude
website. Register it once:

```bash
claude mcp add -s user dotworkout -- npx -y @dotworkout/mcp
```

Then ask, ending with **use dotworkout** so Claude reaches for the tools rather
than answering from memory:

> Build me a swimming pyramid workout and save it to my desktop. Use dotworkout.

> Make me a Norwegian 4×4 — four by four minutes in zone 4 with three minute
> jogs between — and put it on my desktop. Use dotworkout.

> What targets does an indoor cycle actually support? Build me a 45 minute
> session using them. Use dotworkout.

The tools, and the reason `-s user` matters, are in
[`packages/mcp/README.md`](packages/mcp/README.md).

## Commands

```bash
npm test
```

Builds the packages and runs the suite on Node's test runner. Also:

- `npm run build` — TypeScript only.
- `npm run generate` — regenerate the protobuf bindings from `proto/` and the
  compatibility data from `constraints/compatibility.json`. Both outputs are
  checked in, so a normal build needs neither protoc nor the buf CLI.
- `npm run check` — regenerate, then build and test.

## The conformance suite

For each of the 20 files in `testdata/`, three assertions:

1. `decode(bytes)` matches the paired `.json`
2. `encode(decode(bytes))` is byte-identical to the input
3. decoding produces zero unknown fields

The third one is the point. Protobuf keeps fields it does not recognise and
writes them back out, so nine of these files round-trip perfectly against a
schema that is missing fields. Byte-identical output is not evidence of a
correct schema. Checking for unknown fields is — and the check walks the whole
tree, since `SpeedAlert.speed_target` sits four levels down.

`packages/codec/test/unknown-fields.test.ts` is the control. It breaks the schema
at runtime in six of the ten ways the upstream schema was actually broken, and
checks that assertion 3 catches each one. Without that, a passing assertion 3
only proves the schema agrees with itself.

## Where the rules live

| Kind of rule | Lives in |
|---|---|
| Wire structure | `proto/`, as protovalidate options |
| Which goals and alerts each sport allows | `constraints/compatibility.json` |
| Everything else | `spec/FORMAT.md` |

The compatibility matrix is read at build time into
`packages/domain/src/generated/compatibility-data.ts`. It is never restated in
TypeScript or in prose. A test recomputes the source file's SHA-256 and fails if
the JSON changed without regenerating.

Entries carry a confidence level. Confirmed ones are enforced: a power alert on
a swim is an error. Unverified ones warn and are still allowed, because the
matrix came off one device on one day, and a combination nobody tested is not a
combination known to be illegal. Being too permissive costs you a file the Watch
declines to import; being too strict costs you a workout you cannot create at
all. `validateWorkout(msg, { downgradeToWarning })` takes a list of issue codes,
so you never have to edit the library when the matrix is wrong.

## What this does not do

- **Convert units.** 100 m written as miles is 0.06 mi, which is 96.6 m.
  Conversion loses data, so authored units are kept as they are. `toMeters()`
  exists for display and is never written back.
- **Count laps.** Pool length is chosen on the Watch when the workout starts and
  is not in the file.
- **Assume a container.** `decode()` branches on field 10 (`SingleGoalWorkout`)
  against field 11 (`CustomWorkout`) and fails with a clear message on anything
  else. Pacer and swim-bike-run workouts probably use further fields; when one
  turns up, the error asks for a corpus file.

## Still unknown

`spec/FORMAT.md` §9 lists what has not been verified. The two that would change
this library most:

- **Pacer and swim-bike-run containers.** Structure unknown. The decoder fails
  loudly rather than guess.
- **`PowerAlert.PowerBound.unit`.** Only ever seen as `1`, assumed to be watts.

Every question settled so far was settled by exporting another `.workout` from
the phone and adding it to `testdata/`.

## Credits

The protobuf schema started from
[changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT), which covers steps, blocks, activities, locations and the
time/distance/open goals. Ten fields and enum values were missing; those
corrections are listed in `spec/FORMAT.md` §8. No code was taken.

Not affiliated with Apple.

## Licence

MIT. See [LICENSE](LICENSE).
