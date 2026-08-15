# Constraints

`compatibility.json` says which goals and alerts each sport allows. It is the
only place that information lives.

The `.workout` format does not encode any of it. You can put a power alert on a
swim step and get a well-formed file that the Watch may then refuse. Catching
that is the library's job, not the codec's.

## Why data instead of prose

The matrix comes from a UI that Apple can change whenever it likes, so it needs
versioning, dates, and a confidence level per entry. A markdown table carries
none of that. Keeping it as data also stops the validator and the docs drifting
apart: the table in `spec/FORMAT.md` §7 is generated from this file.

## Three kinds of rule

| Kind | Lives in | Example |
|---|---|---|
| Structural | protovalidate options in `proto/` | `iterations >= 1`; exactly one container field set |
| Compatibility | this file | swimming allows `DISTANCE_TIME`; HIIT has no distance goal |
| Reasoning and provenance | `spec/FORMAT.md` | why pace bounds read backwards |

## Location overrides

A sport can offer fewer targets indoors than out — an indoor run has no cadence
or power, because a treadmill cannot measure them. An entry may carry an
`indoor` block overriding `alerts`. Without one, the sport offers the same
targets in both places.

## Confidence levels

Every entry has a `confidence` field:

- **confirmed** — enforce it.
- **presumed** — allow, no warning.
- **unknown**, `alertsUnverified`, `customWorkoutUnverifiedActivities` — allow
  and warn. Never reject.

Never rejecting on an unverified entry is deliberate. Something nobody tested is
not something known to be illegal. If we wrongly allow a combination, the Watch
declines the file. If we wrongly forbid one, the user cannot build the workout at
all and has no way to tell why.
