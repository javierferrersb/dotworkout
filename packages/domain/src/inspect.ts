/**
 * Read-side walking of a decoded workout.
 *
 * Everything downstream — totals, validation, summaries — goes through
 * {@link steps} so there is exactly one place that knows a workout's steps live
 * in three different shapes: an optional warm up, the steps inside repeated
 * blocks, and an optional cool down.
 *
 * Blocks are NOT assumed to be work/recovery pairs. `spec/FORMAT.md` §4:
 * work-only (`Swim_DistTime` block A) and recovery-only (`Minimal`,
 * `Activity_Cycle`) blocks both occur in the corpus.
 */

import {
  IntervalBlock_IntervalStep_IntervalPurpose,
  type CustomWorkout,
  type WorkoutAlert,
  type WorkoutStep,
} from "@dotworkout/codec";
import { fromWorkoutGoal, type GoalSpec } from "./goals.js";

export type Purpose = "work" | "recovery" | "unspecified";

export type StepPosition =
  | { readonly kind: "warmup" }
  | { readonly kind: "cooldown" }
  | {
      readonly kind: "block";
      readonly blockIndex: number;
      readonly stepIndex: number;
      readonly purpose: Purpose;
    };

export interface StepView {
  readonly position: StepPosition;
  /**
   * Dotted path using proto field names, matching the `testdata/*.json` shape
   * and the paths the codec's unknown-field walker reports.
   */
  readonly path: string;
  readonly step: WorkoutStep;
  readonly goal: GoalSpec;
  readonly label: string | undefined;
  readonly alert: WorkoutAlert | undefined;
  /**
   * How many times this step is actually performed — the enclosing block's
   * `iterations`, or 1 for a warm up or cool down.
   */
  readonly repetitions: number;
}

/** Every step in a custom workout, in the order they are performed. */
export function steps(workout: CustomWorkout): StepView[] {
  const out: StepView[] = [];

  if (workout.warmup !== undefined) {
    out.push(view(workout.warmup, { kind: "warmup" }, "custom_workout.warmup", 1));
  }

  workout.intervalBlocks.forEach((block, blockIndex) => {
    // iterations 1 is valid on the wire even though the picker's minimum is 2:
    // a single unrepeated step is written as iterations: 1 (spec §4). Treat a
    // missing or zero value as 1 rather than dropping the step entirely.
    const repetitions = block.iterations > 0 ? block.iterations : 1;
    block.intervalSteps.forEach((intervalStep, stepIndex) => {
      if (intervalStep.workoutStep === undefined) return;
      out.push(
        view(
          intervalStep.workoutStep,
          { kind: "block", blockIndex, stepIndex, purpose: readPurpose(intervalStep.purpose) },
          `custom_workout.interval_blocks[${blockIndex}].interval_steps[${stepIndex}].workout_step`,
          repetitions,
        ),
      );
    });
  });

  if (workout.cooldown !== undefined) {
    out.push(view(workout.cooldown, { kind: "cooldown" }, "custom_workout.cooldown", 1));
  }

  return out;
}

/** The steps that carry a non-empty label. Stroke lives in the label (spec §3). */
export function labelledSteps(workout: CustomWorkout): StepView[] {
  return steps(workout).filter((s) => s.label !== undefined && s.label !== "");
}

function view(
  step: WorkoutStep,
  position: StepPosition,
  path: string,
  repetitions: number,
): StepView {
  return {
    position,
    path,
    step,
    goal: fromWorkoutGoal(
      step.workoutGoal ??
        (() => {
          throw new Error(`${path} has no workout_goal`);
        })(),
    ),
    label: step.displayName,
    alert: step.workoutAlert,
    repetitions,
  };
}

function readPurpose(purpose: IntervalBlock_IntervalStep_IntervalPurpose): Purpose {
  switch (purpose) {
    case IntervalBlock_IntervalStep_IntervalPurpose.WORK:
      return "work";
    case IntervalBlock_IntervalStep_IntervalPurpose.RECOVERY:
      return "recovery";
    default:
      return "unspecified";
  }
}
