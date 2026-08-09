import { isFieldSet } from "@bufbuild/protobuf";
import { WireType } from "@bufbuild/protobuf/wire";
import { UnsupportedContainerError } from "./errors.js";
import {
  WorkoutBinarySchema,
  type CustomWorkout,
  type SingleGoalWorkout,
  type WorkoutBinary,
} from "./schema.js";

/** Field number of `WorkoutBinary.single_goal_workout`. */
export const SINGLE_GOAL_WORKOUT_FIELD = 10;
/** Field number of `WorkoutBinary.custom_workout`. */
export const CUSTOM_WORKOUT_FIELD = 11;

/**
 * Which workout container a decoded file actually carries.
 *
 * Discriminated so callers are forced to handle both. Assuming field 11 is the
 * mistake `spec/FORMAT.md` §1 warns about, and it is not hypothetical:
 * `360_cal_cycling.workout` is a field 10 file, and it is the one corpus entry
 * that failed loudly against the incomplete upstream schema.
 */
export type WorkoutContainer =
  | { readonly kind: "singleGoal"; readonly fieldNumber: 10; readonly workout: SingleGoalWorkout }
  | { readonly kind: "custom"; readonly fieldNumber: 11; readonly workout: CustomWorkout };

/**
 * Branch on whichever container field is present.
 *
 * @throws {UnsupportedContainerError} if neither field 10 nor field 11 is set.
 *   That most likely means a pacer or swim-bike-run workout occupying a sibling
 *   field this corpus has never seen (spec §9). Failing here is deliberate: a
 *   silent fallback to field 11 would report an empty custom workout instead.
 */
export function readContainer(binary: WorkoutBinary): WorkoutContainer {
  const hasSingleGoal = isFieldSet(binary, field(SINGLE_GOAL_WORKOUT_FIELD));
  const hasCustom = isFieldSet(binary, field(CUSTOM_WORKOUT_FIELD));

  if (hasSingleGoal && hasCustom) {
    // Never observed — fields 10 and 11 are mutually exclusive in all 20 files.
    // The structural rule is enforced by protovalidate; here we just refuse to
    // guess which one the Watch would honour.
    throw new UnsupportedContainerError([SINGLE_GOAL_WORKOUT_FIELD, CUSTOM_WORKOUT_FIELD]);
  }
  if (hasSingleGoal) {
    return {
      kind: "singleGoal",
      fieldNumber: SINGLE_GOAL_WORKOUT_FIELD,
      workout: binary.singleGoalWorkout!,
    };
  }
  if (hasCustom) {
    return { kind: "custom", fieldNumber: CUSTOM_WORKOUT_FIELD, workout: binary.customWorkout! };
  }

  throw new UnsupportedContainerError(candidateContainerFields(binary));
}

/**
 * Top-level unknown fields that could plausibly be an unmodelled sibling
 * container: length-delimited (so, a submessage) and numbered near 10/11 rather
 * than up in the 1000s where `version` and `format` live.
 */
export function candidateContainerFields(binary: WorkoutBinary): number[] {
  return (binary.$unknown ?? [])
    .filter((u) => u.wireType === WireType.LengthDelimited && u.no < 1000)
    .map((u) => u.no)
    .sort((a, b) => a - b);
}

function field(fieldNumber: number) {
  const desc = WorkoutBinarySchema.fields.find((f) => f.number === fieldNumber);
  if (desc === undefined) {
    throw new Error(`WorkoutBinary has no field ${fieldNumber}`);
  }
  return desc;
}
