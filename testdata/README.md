# Conformance corpus

20 real exports from the iOS Workout app, each paired with its expected decoding
(protobuf JSON mapping, original field names).

Every implementation, in any language, must satisfy all three assertions for
every pair:

1. `decode(bytes)` equals the expected JSON
2. `encode(decode(bytes))` is byte-identical to the original
3. **decoding yields ZERO unknown fields**

Assertion 3 is not optional. Nine files here pass 1 and 2 against an incomplete
schema, because protobuf silently preserves unrecognised fields. Only assertion
3 catches it.

| File | Covers |
|---|---|
| `PoolSwim_2` | realistic 2000 m swim; named steps; 5 blocks |
| `Minimal` | no warm up/cool down; unpaired single-step blocks; default name |
| `Minimal_kilometers` `_miles` `_yards` | distance units 2/5/4; units authored, not normalised |
| `Probe_Time` | time goals in WORK position; MINUTES and SECONDS mixed |
| `Probe_Open` | OPEN goal in warm up, recovery and cool down |
| `Probe_Indoor` | LocationType INDOOR; ActivityType RUNNING |
| `ProbeAlertsRange` | HR range + pace range; alert_style RANGE |
| `Probe_Alerts_Zones` | pace single-target; alert_style VALUE |
| `Probe_Alert_Range_Zone_2_HR` | HR zone 2; alert_style ZONE |
| **`Swim_DistTime`** | **DISTANCE_TIME goal (type 5); work-only block** |
| `Swim_HR` | first alerts on a swim; HR range and HR zone 3 |
| `Run_Cadence` | cadence range + single target; TimeUnit = MINUTES |
| `Run_Power` | power range CURRENT and AVERAGE; power single target |
| `Run_Average` | AlertMetricEnum.AVERAGE for pace |
| `Activity_Cycle` | ActivityType CYCLING |
| `Cycle_Speed` | speed range CURRENT/AVERAGE + single target; km/h -> m/s |
| **`360_cal_cycling`** | **SingleGoalWorkout container (field 10); ENERGY goal (type 2)** |
| `Stress` | 1,574-char Unicode name with emoji; 15 blocks; 98 iterations |

`360_cal_cycling` is the only file using `WorkoutBinary` field 10 instead of
field 11 — decoders must branch on which is present.

`Minimal*` share one GUID and the three early alert files share another: the app
keeps a stable GUID per workout across edits and re-exports.
