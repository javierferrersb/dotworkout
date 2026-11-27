---
name: apple-watch-workouts
description: Turn a training idea into a custom workout on the Apple Watch with the dotworkout tools. Use when someone asks for an interval session, a swim set, a tempo run, FTP intervals, a HIIT circuit or any structured workout for their Watch, or wants to read one back.
license: MIT
---

# Apple Watch workouts with dotworkout

The dotworkout tools build `.workout` files, the format the Workout app on the
Apple Watch uses for custom workouts. No model can write this format from
memory: it is undocumented binary, and what each sport accepts was read off a
real device. Let the tools do it.

## The one rule: show the link

`create_workout` returns a link. **The workout is inside the link**: it is
encoded in the part after `#w=`, so nothing is stored anywhere and the link is
the only copy. Opening it on the iPhone shows the workout with a **Save the workout**
button, and from there it goes to the Watch.

So every reply after `create_workout` must contain the full link, unchanged, on
its own line. Do not shorten it, retype it, put "[link]" in its place, or leave
it out because it is long. Do not try to rebuild the file from it either: one
dropped character and the Watch refuses the workout.

A good reply:

> Here's your Norwegian 4×4: a 10 minute warm up, four 4 minute intervals in
> zone 4 with 3 minute jogs, and a 5 minute cool down.
>
> Open this on your iPhone and tap Save the workout:
>
> https://workout.javierferrersb.dev/#w=…
>
> It opens in the Workout app from there. If it doesn't, save it to Files, open
> it, tap Share and choose Workout.

(Here the link is cut short with `…` only to keep this page readable. In a real
reply paste the whole link `create_workout` gave you, however long.)

A bad reply: "Done! Your workout is ready, open the link above." — the user sees
no link and the workout is gone.

When running locally (Claude Code, desktop), `create_workout` also prints a QR
code and takes an optional `outputPath` to write the file to disk. Show the QR
block as it is, inside a code block so it keeps its shape, and still give the
link.

## Workflow

1. **Check the sport.** Call `describe_activity` (one sport) or
   `list_activities` (all of them). Support differs per sport and per location:
   an indoor bike has no distance goal and no speed target, an indoor run has no
   power or cadence, and only swimming has send-offs.
2. **Write the plan as a spec** (format below). When the user gives zones,
   paces or watts, use them; when they don't, pick sensible defaults and say
   what you picked.
3. **Validate** with `validate_workout`. It names the step that is wrong. Fix and
   re-validate rather than guessing.
4. **Create** with `create_workout` and give the user the link.
5. To read a workout back (a link someone shared, or a file), use
   `inspect_workout`.

## The spec

```json
{
  "activity": "RUNNING",
  "location": "outdoor",
  "name": "Norwegian 4×4",
  "warmup": { "time": "10min", "alert": { "kind": "heartRateZone", "zone": 2 } },
  "blocks": [
    {
      "repeat": 4,
      "work": { "time": "4:00" },
      "rest": "3:00",
      "alert": { "kind": "heartRateZone", "zone": 4 }
    }
  ],
  "cooldown": { "time": "5min" }
}
```

- `activity`: one of the names `list_activities` returns, such as `RUNNING`,
  `CYCLING`, `SWIMMING`, `HIGH_INTENSITY_INTERVAL_TRAINING`, `ROWING`.
- `location`: `outdoor` or `indoor`, for sports offered both ways. It changes
  what is allowed. Pool swims are `outdoor` (Apple stores them that way).
- `blocks`: the main set, in order. Each block is `repeat` × `work`, with an
  optional `rest` after each repetition, an optional `alert` (target) on the
  work, and an optional `label`. A one-off step is a block with `repeat: 1`.
- `warmup` / `cooldown`: optional single steps that take the same `alert` and
  `label`.

### Goals: every step has one

| Goal     | Write                   | Notes                                     |
| -------- | ----------------------- | ----------------------------------------- |
| Time     | `{ "time": "4:00" }`    | `"4:00"`, `"90s"`, `"10min"`, `"1:15:00"` |
| Distance | `{ "distance": "5km" }` | `"400m"`, `"5km"`, `"1mi"`, `"200yd"`     |
| Open     | `{ "open": true }`      | No goal; the wearer ends the step         |
| Send-off | distance + `sendOff`    | Swimming only: `"sendOff": "1:45"`        |

Two traps:

- **A bare number is seconds or the sport's default unit.** `"10"` as a time is
  10 seconds; write `"10min"` or `"10:00"`. `"400"` as a running distance is
  400 **km**, because running, cycling, walking and hiking default to km;
  swimming and rowing default to metres. Always write the unit.
- `"1:00"` is one minute and `"1:00:00"` is one hour.

### Targets (`alert`)

| Kind             | Example                                                       |
| ---------------- | ------------------------------------------------------------- |
| `heartRateZone`  | `{ "kind": "heartRateZone", "zone": 4 }`                      |
| `heartRateRange` | `{ "kind": "heartRateRange", "from": 140, "to": 155 }`        |
| `pace`           | `{ "kind": "pace", "pace": "4:30/km" }`                       |
| `paceRange`      | `{ "kind": "paceRange", "from": "4:40/km", "to": "4:25/km" }` |
| `kmh`            | `{ "kind": "kmh", "kmh": 32 }`                                |
| `kmhRange`       | `{ "kind": "kmhRange", "from": 28, "to": 32 }`                |
| `power`          | `{ "kind": "power", "watts": 250 }`                           |
| `powerRange`     | `{ "kind": "powerRange", "from": 240, "to": 255 }`            |
| `cadence`        | `{ "kind": "cadence", "perMinute": 90 }`                      |
| `cadenceRange`   | `{ "kind": "cadenceRange", "from": 85, "to": 95 }`            |

Paces work in `/km` and `/mi`; the server converts them. Heart-rate zones are
the wearer's own zones on the Watch, so a zone is usually better than made-up
beats per minute.

What each sport takes (`list_activities` is the authority if this ever differs):

| Sport                                                          | Goals                          | Targets                           |
| -------------------------------------------------------------- | ------------------------------ | --------------------------------- |
| Running, outdoor                                               | distance, time, open           | heart rate, pace, cadence, power  |
| Running, indoor                                                | distance, time, open           | heart rate, pace                  |
| Cycling, outdoor                                               | distance, time, open           | heart rate, speed, cadence, power |
| Cycling, indoor                                                | time, open                     | heart rate, cadence, power        |
| Swimming                                                       | distance, send-off, time, open | heart rate                        |
| Rowing, outdoor                                                | distance, time, open           | heart rate                        |
| Rowing, indoor                                                 | time, open                     | heart rate                        |
| Walking, hiking                                                | distance, time, open           | heart rate                        |
| HIIT, strength, core, yoga, elliptical, stairs, cross training | time, open                     | heart rate                        |

### Labels

`label` is free text shown on the Watch during the step. Swimming has no stroke
field, so the stroke goes here: `"label": "free"`, `"kick"`, `"IM"`. For
strength work it names the exercise: `"label": "burpees"`.

## Examples

`references/examples.md` has a library of real workouts, each with the request,
the exact `create_workout` arguments and how to reply: Norwegian 4×4 (run and
bike), swim pyramid, send-off sets, IM, tempo runs, track 400s, mile repeats,
long runs, FTP 2×20, 30/30s, cadence drills, Tabata, rowing, walking and
strength circuits. There is also a list of mistakes the validator catches.
Every example there is checked by the dotworkout test suite.
