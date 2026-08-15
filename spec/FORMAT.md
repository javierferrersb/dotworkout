# Apple `.workout` binary format

Reverse-engineered specification. Verified against **20 real files** produced by
the iOS Workout app, all of which decode with **zero unknown fields** and
re-encode **byte-identically**.

Base schema from [changeforan/DotnetWorkoutKit](https://github.com/changeforan/DotnetWorkoutKit)
(MIT). Ten corrections were required — see §8.

---

## 1. Container

```protobuf
WorkoutBinary {
  string            GUID                = 9;
  SingleGoalWorkout single_goal_workout = 10;
  CustomWorkout     custom_workout      = 11;
  uint32            version             = 1000;   // observed: 1
  uint32            format              = 1002;   // observed: 5
}
```

Plain protobuf. No header, magic bytes, compression, or framing.

**Fields 10 and 11 are mutually exclusive** in every observation — a file holds
either a single-goal workout or a custom one. Apple's WorkoutKit also defines
pacer and swim-bike-run workouts, which likely occupy further sibling fields
that this corpus has never seen. **A decoder must therefore branch on which
field is present rather than assuming field 11.**

**GUID is a stable workout identity, not a per-export nonce.** Four files
exported from one workout after only changing display units share
`EB04F3B5-…`; three files exported across successive edits share `4004C7EB-…`.
Generators must mint a fresh UUIDv4 per workout.

---

## 2. `SingleGoalWorkout` (field 10)

```protobuf
SingleGoalWorkout {
  ActivityType    activity_type = 1;
  LocationType    location_type = 2;
  optional string display_name  = 3;   // PRESUMED — never observed
  WorkoutGoal     goal          = 4;
}
```

The simple non-custom workouts: one activity, one goal, no warm up, blocks, or
cool down. Field 4 is a bare `WorkoutGoal`, **not** a `WorkoutStep`.

Field 3 as `display_name` is inferred by analogy with `CustomWorkout`; the one
observed file has no name. Treat as unconfirmed.

These are trivial to create on-device and are of limited product value, but they
are the **only** place the `ENERGY` goal type appears.

---

## 3. `CustomWorkout` (field 11)

```protobuf
CustomWorkout {
  ActivityType           activity_type   = 1;
  LocationType           location_type   = 2;
  optional string        display_name    = 3;
  optional WorkoutStep   warmup          = 4;
  repeated IntervalBlock interval_blocks = 5;
  optional WorkoutStep   cooldown        = 6;
}
```

### `activity_type` is `HKWorkoutActivityType`, verbatim

**Confirmed against Apple's documented HealthKit enum: 14 of 14 values match
exactly.** This field is not a WorkoutKit invention — it carries the raw
`HKWorkoutActivityType` value, a public enum of ~80 entries. Populate the full
enum from Apple's documentation rather than reverse-engineering it.

The 14 values in the reference schema are a **permission list, not a value
list** — the subset WorkoutKit accepts for custom workouts. The field could
presumably hold `pickleball = 79`; the composer just won't produce one. That
distinction belongs in the validation layer, not the codec.

Relevant values: CROSS_TRAINING 11, **CYCLING 13**, ELLIPTICAL 16,
FUNCTIONAL_STRENGTH_TRAINING 20, HIKING 24, ROWING 35, **RUNNING 37**,
STAIR_CLIMBING 44, **SWIMMING 46**, TRADITIONAL_STRENGTH_TRAINING 50,
WALKING 52, YOGA 57, CORE_TRAINING 59, HIGH_INTENSITY_INTERVAL_TRAINING 63.
Observed: 13, 37, 46.

`LocationType`: INDOOR 2, OUTDOOR 3. Both observed.

Warm up and cool down are genuinely optional — omitted from the wire, not
written as empty messages.

**Pool length is not in this file.** It is chosen when starting the workout on
the Watch. Swim distances are authored in absolute units and converted to laps
on-device, so a generator cannot display lap counts.

**Pool swims store as OUTDOOR**, and open water swim is not offered as a
separate activity in the composer.

**Stroke is not a field.** There is no stroke selector; users type the stroke
into the step's free-text `display_name`. A good authoring UI should offer a
stroke picker that *writes into the label*.

---

## 4. Blocks and steps

```protobuf
IntervalBlock {
  repeated IntervalStep interval_steps = 1;
  uint32                iterations     = 2;

  IntervalStep { IntervalPurpose purpose      = 1;  // WORK 1, RECOVERY 2
                 WorkoutStep     workout_step = 2; }
}

WorkoutStep {
  WorkoutGoal           workout_goal  = 1;
  optional WorkoutAlert workout_alert = 2;
  optional string       display_name  = 3;
}
```

**Blocks need not be work/recovery pairs.** Observed: work-only
(`Swim_DistTime` block A), recovery-only (`Minimal`, `Activity_Cycle`), and
standard pairs. Parsers must not assume pairing.

**Iterations.** The UI allows 2–98 for a repeating block, but a block holding a
single unrepeated step is written with `iterations: 1`. So 1 is valid on the
wire even though the picker's minimum is 2. `Stress.workout` confirms 98 encodes
fine, as do 15 blocks in one workout.

---

## 5. Goals

```protobuf
WorkoutGoal {
  GoalType         goal_type          = 1;
  TimeGoal         time_goal          = 2;   // when TIME
  EnergyGoal       energy_goal        = 3;   // when ENERGY
  DistanceGoal     distance_goal      = 4;   // when DISTANCE
  DistanceTimeGoal distance_time_goal = 5;   // when DISTANCE_TIME
                                             // OPEN carries no payload
  message DistanceTimeGoal {
    DistanceGoal distance = 1;
    TimeGoal     time     = 2;
  }
}
```

`GoalType`: TIME 1, **ENERGY 2**, DISTANCE 3, OPEN 4, **DISTANCE_TIME 5**.

Distance units: METERS 1, KILOMETERS 2, FEET 3, YARDS 4, MILES 5 — all observed.
Time units: SECONDS 1, MINUTES 2, HOURS 3. Energy: KILOCALORIES 1.
Values are IEEE-754 doubles.

### `DISTANCE_TIME` — the swim send-off interval

Swimming offers a combined "Distance · Time" goal ("50 m on 1:00"): leave every
60 seconds regardless of finishing time. This is the idiom nearly every swim set
is written in, and it is **entirely absent from the reference library**.

It uses `goal_type = 5` and a dedicated field 5 carrying both quantities — it
does *not* populate `time_goal` and `distance_goal` together. Offered only for
swimming; not for running, cycling, or HIIT.

### `ENERGY` — single-goal workouts only

`goal_type = 2` with `energy_goal { KILOCALORIES, 360.0 }`. The custom-workout
composer never offers it; it appears only in simple goal workouts (field 10).

### Units are authored data, not normalised

The stored unit is whichever the workout was authored in:

| File | Stored as | True distance |
|---|---|---|
| `Minimal` | METERS 100 | 100 m |
| `Minimal_kilometers` | KILOMETERS 0.1 | 100 m |
| `Minimal_miles` | MILES 0.06 | 96.6 m |
| `Minimal_yards` | YARDS 100 | 91.4 m |

**Switching display units is lossy** — the value is rounded into the new unit. A
round-tripping library must preserve the unit, not canonicalise to metres.

Time units are inconsistent *within a single file*: `Probe_Time` stores its warm
up as MINUTES 5 but its cool down as SECONDS 120; `Swim_DistTime` stores 1:00
and 2:00 as SECONDS but 3:00 as MINUTES 3. Preserve what you read.

---

## 6. Alerts

```protobuf
WorkoutAlert {
  AlertMetricEnum     alert_metric           = 1;
  AlertStyle          alert_style            = 2;
  SpeedAlert          speed_alert            = 4;
  CadenceAlert        cadence_alert          = 5;
  PowerAlert          power_alert            = 6;
  HeartRateRangeAlert heart_rate_range_alert = 7;
}
```

### `alert_style` (field 2) is the payload discriminator

Named `unknown` in the reference schema. It selects the payload shape:

| Value | Style | Payload |
|---|---|---|
| 1 | VALUE | single target |
| 2 | RANGE | explicit lower/upper bounds |
| 3 | ZONE | zone index; bounds resolved on-device |

### Every alert type shares one field layout

Consistent across all four — and **field 1 was missing from the reference
schema in every case**:

| Alert | field 1 | field 2 |
|---|---|---|
| `SpeedAlert` | `speed_target` (VALUE) | `speed_range_alert` (RANGE) |
| `CadenceAlert` | `cadence_target` (VALUE) | `cadence_range_alert` (RANGE) |
| `PowerAlert` | `power_target` (VALUE) | `power_range_alert` (RANGE) |
| `HeartRateRangeAlert` | `heart_rate_zone` (ZONE) | `heart_rate_range` (RANGE) |

Heart rate is the exception: field 1 holds a zone index rather than a single
target, because its picker offers zones instead of single values. Zones store
only the index — bpm boundaries live on-device and track the user's own HR data,
so the same file means different bpm for different users.

### `AlertMetricEnum`

AVERAGE 1, CURRENT 2, CADENCE 3, POWER_CURRENT 4, COUNT_PER_MINUTE 5,
POWER_AVERAGE 6. All observed.

The current/average axis is **per-metric, not universal** — confirmed in the UI:

| Metric | Enum value(s) | Current/average toggle |
|---|---|---|
| Speed/pace | AVERAGE 1, CURRENT 2 | yes |
| Cadence | CADENCE 3 | no |
| Power | POWER_CURRENT 4, POWER_AVERAGE 6 | yes |
| Heart rate | COUNT_PER_MINUTE 5 | no |

### Speed is always metres per second

Both running pace and cycling speed use the identical `SpeedAlert` encoding.
Display units are purely a UI concern:

| Input | Displayed as | Stored (m/s) |
|---|---|---|
| 5'30"/km | pace | 3.030303… |
| 5'00"/km | pace | 3.333333… |
| 25 km/h | speed | 6.944444… |
| 30 km/h | speed | 8.333333… |
| 28 km/h | speed | 7.777777… |

`lower_bound` is the **slower** value (lower m/s). For pace this reads backwards
relative to how it is displayed — a common source of inverted-range bugs.

### The `TimeUnit` submessage is a real denominator

Present in speed and cadence bounds; not a constant:

- Speed bounds: `{unit: 1 (SECONDS), value: 1.0}` → metres per **second**
- Cadence bounds: `{unit: 2 (MINUTES), value: 1.0}` → counts per **minute**

It reuses `TimeUnitType`, matching how each metric is displayed.

### Power

`PowerBound {uint32 unit = 1; double power = 2;}`, unit observed only as 1,
presumed watts.

---

## 7. Sport/target compatibility

**The format encodes no constraints.** Nothing prevents writing a power alert
onto a swim step; it would serialise fine and the Watch might reject or ignore
it. Validation belongs in the library's domain layer, using this matrix.

**The matrix lives in `constraints/compatibility.json`, not here.** That file is
the single source of truth: the validator reads it. This table is a summary of
it, kept in step by hand; the JSON carries the dating and per-entry confidence a
markdown table cannot.

| Sport | Goal types | Alert types |
|---|---|---|
| Pool swim | Time, Distance, Open, **Distance · Time** | Heart rate |
| Running, outdoor | Distance, Time, Open | Pace, Heart rate, Cadence, Power |
| Running, indoor | Distance, Time, Open | Pace, Heart rate |
| Cycling, outdoor | Time, Distance, Open | Speed, Heart rate, Cadence, Power |
| HIIT | Time, Open | Heart rate |
| *(single-goal workouts)* | Distance, Time, **Energy** | n/a |

**Targets vary by location, not only by sport.** An indoor run drops cadence and
power. Entries carry an optional `indoor` block overriding the alert list;
without one, a sport offers the same targets wherever it is done. Indoor cycle
has not been checked.

Unverified entries must be **allowed with a warning**, never rejected. A
combination that was never checked is not a combination known to be illegal, and
rejecting it would block a legitimate workout with no recourse.

This matrix cannot be derived from files — a file proves a combination is legal,
but nothing except the UI proves one is forbidden.

---

## 8. Corrections to the reference schema

`changeforan/DotnetWorkoutKit` is accurate for steps, blocks, activities,
locations, and the time/distance/open goals, and its CI compares byte-for-byte
against real WorkoutKit output. Ten corrections, all worth upstreaming:

1. **`WorkoutBinary` field 10 missing** — the entire `SingleGoalWorkout` container.
2. **`GoalType.ENERGY = 2` missing.**
3. **`WorkoutGoal` field 3 missing** — the `EnergyGoal` payload.
4. **`GoalType.DISTANCE_TIME = 5` missing** — swim send-offs unsupported.
5. **`WorkoutGoal` field 5 missing** — the `DistanceTimeGoal` payload.
6. **`HeartRateRangeAlert` field 1 missing** — zone alerts lost the zone.
7. **`SpeedAlert` field 1 missing** — single-target pace/speed lost the target.
8. **`CadenceAlert` field 1 missing** — single-target cadence lost the target.
9. **`PowerAlert` field 1 missing** — single-target power lost the target.
10. **`WorkoutAlert.unknown` mis-named** — it is the style discriminator.

> **Why these were invisible.** Nine of the ten affected files round-tripped
> **byte-identically** against the broken schema, because protobuf runtimes
> retain unrecognised fields and re-emit them verbatim. **Round-trip fidelity is
> not sufficient evidence that a schema is complete.** The conformance suite
> must additionally assert that decoding yields **no unknown fields**
> (`DiscardUnknownFields()` in Python, `getUnknownFields()` in protobuf-es).
> Without that assertion this corpus reports 20 green passes with ten real gaps.
>
> The single exception was `360_cal_cycling.workout`, whose entire container
> field was unmodelled — that one failed loudly.

---

## 9. Still unverified

- **Pacer and swim-bike-run workouts** — WorkoutKit defines them; they likely
  occupy further `WorkoutBinary` sibling fields. Never observed. This is the
  largest remaining structural unknown.
- **`SingleGoalWorkout.display_name` (field 3)** — inferred by analogy, never seen.
- **Cycling's full alert list** — only Speed confirmed; HR/cadence/power likely.
- **Activity enums other than 13, 37, 46** in practice, and whether goal options
  change for sports where distance is meaningless (strength training, yoga).
- **`PowerBound.unit`** — observed only as 1.
- **Whether `version`/`format` ever differ from 1/5** — only an Apple format
  revision would tell. Handle unexpected values gracefully.
- **Upper limits** on block count (15 confirmed fine) and total file size.

### Resolved

Name length and Unicode: `Stress.workout` carries a 1,574-character name
(2,069 UTF-8 bytes) with emoji, `ø`, `à`, and `l·l`, encoded as ordinary UTF-8
with no escaping or truncation. Iterations 2–98 confirmed. Calorie goals located.
Cycling speed confirmed identical to running pace encoding.
