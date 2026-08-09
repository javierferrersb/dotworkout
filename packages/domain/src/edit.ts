/**
 * Editing a decoded file without disturbing the rest of it.
 *
 * The guarantee: decode a real file, change one step, re-encode, and nothing
 * else moves — not the GUID, not the authored units, not a time goal stored in
 * MINUTES next to one stored in SECONDS.
 *
 * That holds structurally rather than by care. The builder emits protobuf
 * messages directly and these helpers mutate protobuf messages directly, so
 * there is no lossy domain representation in between for anything to fall out
 * of. What was decoded is what gets re-encoded, minus the one change asked for.
 */

import { clone } from "@bufbuild/protobuf";
import {
  WorkoutBinarySchema,
  readContainer,
  type WorkoutBinary,
  type WorkoutStep,
} from "@dotworkout/codec";
import { steps, type StepView } from "./inspect.js";

/**
 * Apply `mutate` to the steps matching `select`, on a copy.
 *
 * The input message is never touched. Returns the edited copy.
 *
 * ```ts
 * const edited = editSteps(decoded, (s) => s.label === "Build", (step) => {
 *   step.displayName = "Build (fins)";
 * });
 * ```
 */
export function editSteps(
  binary: WorkoutBinary,
  select: (step: StepView) => boolean,
  mutate: (step: WorkoutStep, view: StepView) => void,
): WorkoutBinary {
  const copy = clone(WorkoutBinarySchema, binary);
  const container = readContainer(copy);
  // A single-goal workout has one bare goal rather than steps, so it simply has
  // nothing to match. Selecting none of zero steps is the right answer, not an
  // error — this has to stay usable when sweeping a mixed set of files.
  if (container.kind !== "custom") return copy;

  for (const view of steps(container.workout)) {
    if (select(view)) mutate(view.step, view);
  }
  return copy;
}

/** Edit the single step at `path`, as reported by {@link StepView.path}. */
export function editStepAt(
  binary: WorkoutBinary,
  path: string,
  mutate: (step: WorkoutStep, view: StepView) => void,
): WorkoutBinary {
  let hit = false;
  const edited = editSteps(
    binary,
    (view) => view.path === path,
    (step, view) => {
      hit = true;
      mutate(step, view);
    },
  );
  if (!hit) throw new Error(`No step at ${path}`);
  return edited;
}

/**
 * Replace the workout name, leaving everything else alone.
 *
 * Note this does NOT change the GUID: renaming is an edit to an existing
 * workout, and the corpus shows the app keeping one GUID across successive
 * edits and re-exports. Use {@link import("./guid.js").newWorkoutGuid} and
 * {@link withGuid} deliberately when you mean a genuinely new workout.
 */
export function withName(binary: WorkoutBinary, name: string): WorkoutBinary {
  const copy = clone(WorkoutBinarySchema, binary);
  const container = readContainer(copy);
  container.workout.displayName = name;
  return copy;
}

/** Replace the GUID. Use when forking a workout into a genuinely new one. */
export function withGuid(binary: WorkoutBinary, guid: string): WorkoutBinary {
  const copy = clone(WorkoutBinarySchema, binary);
  copy.GUID = guid;
  return copy;
}
