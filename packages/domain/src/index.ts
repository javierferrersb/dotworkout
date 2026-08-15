/**
 * `@dotworkout/domain` — an authoring API for Apple `.workout` files, oriented
 * around swimming.
 *
 * ```ts
 * import { swim } from "@dotworkout/domain";
 *
 * const bytes = swim("Thursday threshold")
 *   .warmup(400)
 *   .repeat(8).of(50).rest(30).label("Build")
 *   .repeat(4).of(100).on("2:00")     // send-off: leave every 2:00
 *   .cooldown(200)
 *   .toBytes();
 * ```
 *
 * This package sits on `@dotworkout/codec`, which remains usable on its own if
 * all you want is to decode and re-encode files.
 *
 * Three things this layer will not do, each for a reason recorded in
 * `spec/FORMAT.md`:
 *
 * - **Canonicalise units.** 100 m authored as miles is 0.06 mi, which is 96.6 m.
 *   Conversion is lossy, so authored units survive untouched.
 * - **Report lap counts.** Pool length is chosen when the workout starts on the
 *   Watch and is not in the file, so laps are unknowable at authoring time.
 * - **Reject unverified combinations.** The compatibility matrix was read off
 *   one device on one day. Entries marked unverified warn; they never block.
 */

export {
  swim,
  run,
  bike,
  hiit,
  custom,
  singleGoal,
  WorkoutBuilder,
  PendingRepeat,
  SetBuilder,
  type WorkoutOptions,
  type SingleGoalOptions,
  type StepInput,
  type StepExtras,
} from "./builder.js";

export {
  toWorkoutGoal,
  fromWorkoutGoal,
  type GoalSpec,
} from "./goals.js";

export {
  toWorkoutAlert,
  alertKind,
  paceToMetersPerSecond,
  speedToMetersPerSecond,
  type AlertKind,
  type AlertSpec,
  type PowerMetric,
  type SpeedMetric,
} from "./alerts.js";

export {
  steps,
  labelledSteps,
  type Purpose,
  type StepPosition,
  type StepView,
} from "./inspect.js";

export {
  totalDistance,
  stepDistance,
  type DistanceTotal,
  type LabelledTotal,
  type WorkoutTotals,
} from "./totals.js";

export {
  validateWorkout,
  assertValidWorkout,
  WorkoutValidationError,
  type Issue,
  type Severity,
  type ValidateOptions,
  type ValidationResult,
} from "./validate.js";

export { editSteps, editStepAt, withName, withGuid } from "./edit.js";

export { newWorkoutGuid } from "./guid.js";

export {
  parseDistance,
  parseDuration,
  toMeters,
  toSeconds,
  formatDistance,
  formatDuration,
  distanceUnitToProto,
  distanceUnitFromProto,
  timeUnitToProto,
  timeUnitFromProto,
  UnitParseError,
  type Distance,
  type DistanceInput,
  type DistanceUnit,
  type Duration,
  type DurationInput,
  type TimeUnit,
} from "./units.js";

export { SPORTS, findSport, showsPace, type Sport } from "./sports.js";

export {
  capabilitiesFor,
  alertShapeFor,
  resolveEntry,
  type SportCapabilities,
  type AlertShape,
  type WorkoutLocation,
  type GoalName,
  type AlertMetricName,
  type AlertStyleName,
} from "./capabilities.js";

export {
  COMPATIBILITY,
  COMPATIBILITY_SOURCE_PATH,
  COMPATIBILITY_SOURCE_SHA256,
} from "./generated/compatibility-data.js";
