<img src="packages/pwa/public/icon-192.png" width="96" alt="" />

# dotworkout

[![CI](https://github.com/javierferrersb/dotworkout/actions/workflows/ci.yml/badge.svg)](https://github.com/javierferrersb/dotworkout/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dotworkout/mcp?label=%40dotworkout%2Fmcp)](https://www.npmjs.com/package/@dotworkout/mcp)

An MCP server that lets Claude, ChatGPT and other agents build custom Apple
Watch workouts. Describe the session in plain language and get back a
`.workout` file the Workout app actually accepts.

> Make me a Norwegian 4×4 — four by four minutes in zone 4 with three minute
> jogs between. Use dotworkout.

## Connect it

**Hosted**, for anything that cannot run a process — a phone, ChatGPT, or Claude
in a browser. Add this as a custom connector; there is nothing to install and no
account to make:

```
https://mcp.javierferrersb.dev/mcp
```

In Claude that is Settings → Connectors → Add custom connector. In ChatGPT it is
Settings → Apps → Advanced → Developer mode.

**Local**, for [Claude Code](https://claude.com/claude-code) and other clients
that can spawn one. `npx` fetches it on first run:

```bash
claude mcp add -s user dotworkout -- npx -y @dotworkout/mcp
```

`-s user` registers it everywhere rather than in the current directory only.

## Ask for a workout

End the request with **use dotworkout** so the model reaches for the tools
rather than answering from memory:

> Build me a swimming pyramid workout and save it to my desktop. Use dotworkout.

> 8×50 on 1:00 with the last four as build, then 4×100 on 2:00. Use dotworkout.

> What targets does an indoor cycle actually support? Build me a 45 minute
> session using them. Use dotworkout.

All fourteen activities the Workout app offers custom workouts for — swimming,
running, cycling, rowing, HIIT, strength, yoga and the rest — with warm ups,
cool downs, repeats, time and distance goals, and heart-rate, pace, power and
cadence alerts.

## Getting it onto your Watch

Hosted, the server returns a link with the workout encoded inside it. Open it on
your iPhone and the composer loads it, ready to download; it lands in the
Workout app and syncs to the Watch. Nothing is uploaded and nothing is stored —
the link _is_ the workout.

Run locally, it writes the file to a path you give it and prints a QR code that
opens the same link on your phone.

## Why it works

A model cannot write this format from memory. It is undocumented binary
protobuf, and nothing says which goals and alerts each sport allows — ask for a
power target on a swim and the Watch rejects the file. So the server gives the
agent the real answers instead of letting it guess:

| Tool                | Does                                                      |
| ------------------- | --------------------------------------------------------- |
| `list_activities`   | Every activity with the goals and alerts it supports      |
| `describe_activity` | One activity in detail, including unverified combinations |
| `validate_workout`  | Check a workout and say exactly what is wrong             |
| `create_workout`    | Build a `.workout` file                                   |
| `inspect_workout`   | Decode an existing workout and describe it                |

The activity rules were read off a real device and live in
[`constraints/compatibility.json`](constraints/compatibility.json). The format
itself was worked out from 20 real exports, all of which decode with zero
unknown fields and re-encode byte for byte — details in
[`spec/FORMAT.md`](spec/FORMAT.md).

Every tool, the client quirks, and how to host your own copy on Cloudflare's
free plan are in [`packages/mcp/README.md`](packages/mcp/README.md).

## Using the libraries directly

The server sits on two TypeScript packages you can use on their own.

| Package                | What it does                                                             |
| ---------------------- | ------------------------------------------------------------------------ |
| `@dotworkout/mcp`      | The MCP server.                                                          |
| `@dotworkout/domain`   | Builds and validates workouts. Uses the codec.                           |
| `@dotworkout/codec`    | Decodes and encodes the binary format. Nothing else.                     |
| `@dotworkout/notation` | Parses sets written as text, like `8x50 on 1:00 Build`. Not published.   |
| `@dotworkout/pwa`      | The composer the links open. Runs entirely on the client. Not published. |

```bash
npm install @dotworkout/domain
```

That pulls in the codec. Install `@dotworkout/codec` on its own if all you want
is to read and write files.

### Writing a workout

```ts
import { swim } from "@dotworkout/domain";

const bytes = swim("Thursday threshold")
  .warmup(400)
  .repeat(8)
  .of(50)
  .rest(30)
  .label("Build")
  .repeat(4)
  .of(100)
  .on("2:00")
  .cooldown(200)
  .toBytes();
```

`.on("2:00")` is the `DISTANCE_TIME` goal: leave every two minutes no matter how
fast you finish. Most swim sets are written this way. Only swimming offers it.

### Reading and editing one

```ts
import { decode, encode } from "@dotworkout/codec";
import { editStepAt, totalDistance } from "@dotworkout/domain";

const workout = decode(bytes);
const totals = totalDistance(workout.customWorkout!);

const edited = editStepAt(
  workout,
  "custom_workout.interval_blocks[0].interval_steps[0].workout_step",
  (step) => {
    step.displayName = "Build (fins)";
  },
);

encode(edited);
```

Everything you did not touch comes back byte for byte.

### The composer

The links open a browser composer at <https://workout.javierferrersb.dev>. You
can build workouts there by hand too, though the agent is the better way in.
Details in [`packages/pwa/README.md`](packages/pwa/README.md).

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

| Kind of rule                             | Lives in                           |
| ---------------------------------------- | ---------------------------------- |
| Wire structure                           | `proto/`, as protovalidate options |
| Which goals and alerts each sport allows | `constraints/compatibility.json`   |
| Everything else                          | `spec/FORMAT.md`                   |

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
