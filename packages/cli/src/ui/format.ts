/**
 * Rendering a workout for the terminal.
 *
 * Deliberately renders from the *built protobuf message*, not from the parsed
 * notation. The preview you see is therefore derived from the same bytes the
 * file will contain — if the builder and the notation ever disagree, the
 * preview sides with the file, which is the honest direction.
 */

import {
  fromWorkoutGoal,
  formatDistance,
  formatDuration,
  totalDistance,
  type GoalSpec,
} from "@dotworkout/domain";
import {
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  IntervalBlock_IntervalStep_IntervalPurpose,
  type CustomWorkout,
  type WorkoutAlert,
  type WorkoutBinary,
  type WorkoutStep,
} from "@dotworkout/codec";
import { restText } from "../swimtime.js";
import { Painter, displayWidth, padEnd, padStart, truncate } from "./ansi.js";

export interface Row {
  readonly kind: "warmup" | "block" | "cooldown";
  readonly reps: number;
  /** What is being done: `50 m`, `1:00`, `open`. */
  readonly work: string;
  /** Modifiers: `on 1:00`, `rest :20`, `HR z3`. */
  readonly detail: string;
  readonly label: string;
  /** Contribution to total distance, or undefined for time/open steps. */
  readonly meters: number | undefined;
}

/** Flatten a workout into one row per block, plus warm up and cool down. */
export function summarize(workout: CustomWorkout): Row[] {
  const rows: Row[] = [];

  if (workout.warmup !== undefined) rows.push(bookendRow("warmup", workout.warmup));

  for (const block of workout.intervalBlocks) {
    const reps = block.iterations > 0 ? block.iterations : 1;
    const work = block.intervalSteps.find(
      (s) => s.purpose === IntervalBlock_IntervalStep_IntervalPurpose.WORK,
    );
    const rest = block.intervalSteps.find(
      (s) => s.purpose === IntervalBlock_IntervalStep_IntervalPurpose.RECOVERY,
    );

    // Recovery-only blocks are real (Minimal.workout, Activity_Cycle.workout),
    // so a block with no work step still has to render as something.
    if (work?.workoutStep === undefined) {
      const goal = rest?.workoutStep?.workoutGoal;
      rows.push({
        kind: "block",
        reps,
        work: goal === undefined ? "—" : describeGoal(fromWorkoutGoal(goal)),
        detail: "rest",
        label: rest?.workoutStep?.displayName ?? "",
        meters: undefined,
      });
      continue;
    }

    const goal = fromWorkoutGoal(work.workoutStep.workoutGoal!);
    const details: string[] = [];
    if (goal.kind === "distanceTime") details.push(`on ${formatDuration(goal.duration)}`);
    if (rest?.workoutStep?.workoutGoal !== undefined) {
      const restGoal = fromWorkoutGoal(rest.workoutStep.workoutGoal);
      if (restGoal.kind === "time") details.push(`rest ${restText(restGoal.duration)}`);
    }
    const alert = describeAlert(work.workoutStep.workoutAlert);
    if (alert !== undefined) details.push(alert);

    rows.push({
      kind: "block",
      reps,
      work: describeGoal(goal),
      detail: details.join("  "),
      label: work.workoutStep.displayName ?? "",
      meters: goalMeters(goal, reps),
    });
  }

  if (workout.cooldown !== undefined) rows.push(bookendRow("cooldown", workout.cooldown));
  return rows;
}

export interface TableOptions {
  readonly painter: Painter;
  readonly width: number;
  /** Highlight this row, used by the composer to mark the line being edited. */
  readonly activeIndex?: number;
}

/** Render the row table. Returns one string per terminal line. */
export function renderRows(rows: readonly Row[], options: TableOptions): string[] {
  const { painter: p, width } = options;
  if (rows.length === 0) {
    return [p.paint("  nothing yet — type a set below, or ? for help", "dim")];
  }

  const numberWidth = String(rows.length).length;
  const repsWidth = Math.max(...rows.map((r) => repsText(r).length), 2);
  const workWidth = Math.max(...rows.map((r) => displayWidth(r.work)), 4);
  const detailWidth = Math.max(...rows.map((r) => displayWidth(r.detail)), 0);
  const totalWidth = Math.max(...rows.map((r) => displayWidth(distanceText(r))), 5);

  // The label is the only field that can be arbitrarily long — Stress.workout
  // has a 1,574 character one — so it takes the leftover width, but only as
  // much as it actually needs. Padding an empty label column to full width
  // would shove the distances off to the right of an expanse of nothing.
  const fixed = 2 + numberWidth + 2 + repsWidth + 1 + workWidth + 2 + detailWidth + 2 + totalWidth;
  const natural = Math.max(0, ...rows.map((r) => displayWidth(r.label)));
  const labelWidth = Math.min(natural, Math.max(0, width - fixed - 2));

  return rows.map((row, index) => {
    const active = options.activeIndex === index;
    const number = padStart(String(index + 1), numberWidth);
    const reps = padStart(repsText(row), repsWidth);
    const work = padEnd(row.work, workWidth);
    const detail = padEnd(row.detail, detailWidth);
    const label = padEnd(truncate(row.label, labelWidth), labelWidth);
    const total = padStart(distanceText(row), totalWidth);

    const line =
      `${p.paint(number, active ? "brightCyan" : "gray")}  ` +
      `${p.paint(reps, "dim")} ` +
      `${p.paint(work, row.kind === "block" ? "bold" : "white")}  ` +
      `${p.paint(detail, "cyan")}  ` +
      (labelWidth > 0 ? `${p.paint(label, "yellow")}  ` : "") +
      `${p.paint(total, "dim")}`;

    return active ? `${p.paint(p.glyph("▸", ">"), "brightCyan")} ${line}` : `  ${line}`;
  });
}

/** The footer: total distance, then the per-label breakdown if there is one. */
export function renderTotals(workout: CustomWorkout, painter: Painter, width: number): string[] {
  const totals = totalDistance(workout);
  const out: string[] = [];

  out.push(painter.paint(painter.glyph("─", "-").repeat(Math.max(10, width - 2)), "dim"));

  const headline = totals.total.mixedUnits
    ? // Mixed units are shown as authored, with the conversion flagged as
      // approximate — converting is lossy in this format, so the sum in metres
      // is a convenience and not the truth.
      totals.total.byUnit.map(quantity).join(" + ") +
      painter.paint(`  ≈ ${meters(totals.total.meters)}`, "dim")
    : totals.total.byUnit.length === 0
      ? painter.paint("no distance", "dim")
      : quantity(totals.total.byUnit[0]!);

  out.push(`  ${painter.paint("total", "bold")}  ${painter.paint(headline, "brightGreen", "bold")}`);

  if (totals.byLabel.length > 0) {
    // Labels are the only per-stroke breakdown the format can express — there
    // is no stroke field, so this is grouped on the free-text step name.
    // Labels are user text of any length (Stress.workout has a 1,574 character
    // one), so each is clipped before it can push the line past the width.
    const parts = totals.byLabel.map(
      (entry) =>
        `${painter.paint(truncate(entry.label, 24), "yellow")} ${painter.paint(meters(entry.total.meters), "dim")}`,
    );
    out.push(...wrapJoin(parts, painter.paint(" · ", "dim"), width - 4).map((line) => `  ${line}`));
  }

  // Deliberately no lap count: pool length is chosen when the workout starts on
  // the Watch and is not in the file, so laps are unknowable here.
  return out;
}

export function renderHeader(
  name: string,
  workout: CustomWorkout | undefined,
  painter: Painter,
  width: number,
): string {
  const right =
    workout === undefined
      ? ""
      : painter.paint(
          `${activityName(workout.activityType)} · ${locationName(workout.locationType)}`,
          "dim",
        );

  // The title is user text and can be any length, so it yields to the metadata
  // rather than pushing the line past the terminal width. An overflowing line
  // soft-wraps, and a wrapped line breaks the composer's repaint bookkeeping.
  const budget = Math.max(8, width - displayWidth(right) - 4);
  const title = truncate(name === "" ? "untitled" : name, budget);
  const left = painter.paint(title, "bold", "brightCyan");

  const gap = Math.max(1, width - displayWidth(left) - displayWidth(right) - 3);
  return `  ${left}${" ".repeat(gap)}${right}`;
}

function bookendRow(kind: "warmup" | "cooldown", step: WorkoutStep): Row {
  const goal = fromWorkoutGoal(step.workoutGoal!);
  const alert = describeAlert(step.workoutAlert);
  return {
    kind,
    reps: 1,
    work: describeGoal(goal),
    detail: alert ?? (kind === "warmup" ? "warm up" : "cool down"),
    label: step.displayName ?? "",
    meters: goalMeters(goal, 1),
  };
}

function repsText(row: Row): string {
  if (row.kind !== "block") return "";
  return row.reps === 1 ? "" : `${row.reps}×`;
}

function distanceText(row: Row): string {
  return row.meters === undefined ? "" : meters(row.meters);
}

function describeGoal(goal: GoalSpec): string {
  switch (goal.kind) {
    case "distance":
      return formatDistance(goal.distance);
    case "distanceTime":
      return formatDistance(goal.distance);
    case "time":
      return formatDuration(goal.duration);
    case "energy":
      return `${goal.kilocalories} kcal`;
    case "open":
      return "open";
  }
}

function goalMeters(goal: GoalSpec, reps: number): number | undefined {
  const distance = goal.kind === "distance" ? goal.distance : goal.kind === "distanceTime" ? goal.distance : undefined;
  if (distance === undefined) return undefined;
  const per: Record<string, number> = { m: 1, km: 1000, ft: 0.3048, yd: 0.9144, mi: 1609.344 };
  return distance.value * (per[distance.unit] ?? 1) * reps;
}

function describeAlert(alert: WorkoutAlert | undefined): string | undefined {
  if (alert === undefined) return undefined;
  const zone = alert.heartRateRangeAlert?.heartRateZone?.zone;
  if (zone !== undefined) return `HR z${zone}`;
  const range = alert.heartRateRangeAlert?.heartRateRange;
  if (range !== undefined) {
    return `HR ${range.lowerBound?.value ?? "?"}–${range.upperBound?.value ?? "?"}`;
  }
  if (alert.speedAlert !== undefined) return "pace";
  if (alert.powerAlert !== undefined) return "power";
  if (alert.cadenceAlert !== undefined) return "cadence";
  return "alert";
}

function meters(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-US")} m`;
}

/** Like the domain's formatDistance, but with thousands separators for reading. */
function quantity(distance: { value: number; unit: string }): string {
  const rounded = Math.round(distance.value * 10000) / 10000;
  return `${rounded.toLocaleString("en-US")} ${distance.unit}`;
}


/**
 * Flow parts across as many lines as needed.
 *
 * Returns real separate lines rather than one string with newlines in it — the
 * composer counts array entries to know how far to move the cursor back up, so
 * a smuggled `\n` would desynchronise the repaint.
 */
function wrapJoin(parts: readonly string[], separator: string, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const part of parts) {
    const candidate = current === "" ? part : current + separator + part;
    if (displayWidth(candidate) > width && current !== "") {
      lines.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * Enum names come from the generated bindings rather than a local lookup —
 * the numbers live in proto/ and nowhere else should restate them. An
 * unmodelled value renders as its raw number instead of being hidden.
 */
function activityName(value: number): string {
  return CustomWorkout_ActivityType[value]?.toLowerCase().replace(/_/g, " ") ?? `activity ${value}`;
}

function locationName(value: number): string {
  return CustomWorkout_LocationType[value]?.toLowerCase() ?? `location ${value}`;
}
