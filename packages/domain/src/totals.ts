/**
 * Total-distance computation.
 *
 * Two constraints shape the return type:
 *
 * - **Authored units are never canonicalised** (spec/FORMAT.md §5). A workout
 *   mixing 400 m with 0.5 mi has no single exact total, so `byUnit` reports the
 *   authored units untouched and `meters` is offered separately as an explicitly
 *   derived figure for display. `meters` is never written back into a goal.
 * - **No lap counts.** Pool length is not in the file — it is chosen when the
 *   workout starts on the Watch — so laps are unknowable at authoring time
 *   (spec §3) and this module deliberately offers no way to compute them.
 */

import type { CustomWorkout } from "@dotworkout/codec";
import { steps, type StepView } from "./inspect.js";
import { toMeters, type Distance, type DistanceUnit } from "./units.js";

export interface DistanceTotal {
  /** Exact per-unit sums, in the units the workout was authored in. */
  readonly byUnit: readonly Distance[];
  /**
   * Derived total in metres, for display only.
   *
   * Exact when every contributing distance shares one unit. Across mixed units
   * it is a conversion, and converting is lossy in this format — 0.06 mi is
   * 96.6 m, not the 100 m the author probably meant.
   */
  readonly meters: number;
  /** True when more than one distance unit contributed, so `meters` is a conversion. */
  readonly mixedUnits: boolean;
}

export interface LabelledTotal {
  /**
   * The step's free-text label. There is no stroke field in the format — an
   * authoring UI's stroke picker writes into this label (spec §3) — so this is
   * the closest thing to a per-stroke breakdown the format supports.
   */
  readonly label: string;
  readonly total: DistanceTotal;
}

export interface WorkoutTotals {
  readonly total: DistanceTotal;
  /** Per-label breakdown, in first-appearance order. Empty when nothing is labelled. */
  readonly byLabel: readonly LabelledTotal[];
  /** Distance contributed by steps with no label. */
  readonly unlabelled: DistanceTotal;
}

/**
 * Sum the distance of every step, multiplied by its block's iterations.
 *
 * Time-goal and open-goal steps contribute nothing — their distance is not
 * knowable. `DISTANCE_TIME` send-offs contribute their distance.
 */
export function totalDistance(workout: CustomWorkout): WorkoutTotals {
  const all = steps(workout);
  const labels: string[] = [];
  const perLabel = new Map<string, Distance[]>();
  const unlabelled: Distance[] = [];
  const everything: Distance[] = [];

  for (const step of all) {
    const distance = stepDistance(step);
    if (distance === undefined) continue;

    everything.push(distance);
    const label = step.label;
    if (label === undefined || label === "") {
      unlabelled.push(distance);
      continue;
    }
    let bucket = perLabel.get(label);
    if (bucket === undefined) {
      bucket = [];
      perLabel.set(label, bucket);
      labels.push(label);
    }
    bucket.push(distance);
  }

  return {
    total: sum(everything),
    byLabel: labels.map((label) => ({ label, total: sum(perLabel.get(label) ?? []) })),
    unlabelled: sum(unlabelled),
  };
}

/**
 * The distance one step contributes across all its repetitions, or `undefined`
 * if the step has no distance.
 */
export function stepDistance(step: StepView): Distance | undefined {
  const goal = step.goal;
  const base =
    goal.kind === "distance"
      ? goal.distance
      : goal.kind === "distanceTime"
        ? goal.distance
        : undefined;
  if (base === undefined) return undefined;
  return { value: base.value * step.repetitions, unit: base.unit };
}

function sum(distances: readonly Distance[]): DistanceTotal {
  const perUnit = new Map<DistanceUnit, number>();
  const order: DistanceUnit[] = [];

  for (const distance of distances) {
    const running = perUnit.get(distance.unit);
    if (running === undefined) order.push(distance.unit);
    perUnit.set(distance.unit, (running ?? 0) + distance.value);
  }

  const byUnit = order.map((unit) => ({ value: round(perUnit.get(unit) ?? 0), unit }));
  return {
    byUnit,
    meters: round(byUnit.reduce((total, distance) => total + toMeters(distance), 0)),
    mixedUnits: byUnit.length > 1,
  };
}

/**
 * Clip the floating-point noise that accumulates when summing doubles — 0.1 + 0.2
 * should read as 0.3 in a UI, not 0.30000000000000004. Applied only to derived
 * totals; stored goal values are never touched.
 */
function round(value: number): number {
  return Number(value.toFixed(6));
}
