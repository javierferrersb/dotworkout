/**
 * `dotworkout show <file>` — decode an existing .workout and print it.
 *
 * This is the command that makes the library falsifiable by hand: point it at a
 * file exported from the phone and see whether this codebase understands it.
 */

import { readFileSync } from "node:fs";
import {
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  UnknownFieldsError,
  UnsupportedContainerError,
  decode,
  findUnknownFields,
  readContainer,
  toJsonObject,
  WorkoutBinarySchema,
} from "@dotworkout/codec";
import {
  formatDistance,
  formatDuration,
  fromWorkoutGoal,
  validateWorkout,
} from "@dotworkout/domain";
import type { WorkoutGoal } from "@dotworkout/codec";
import { Painter, detectCapabilities } from "../ui/ansi.js";
import { renderHeader, renderRows, renderTotals, summarize } from "../ui/format.js";

export interface ShowOptions {
  readonly json: boolean;
}

export function show(path: string, options: ShowOptions): number {
  const caps = detectCapabilities();
  const painter = new Painter(caps);
  const width = Math.max(48, caps.columns);

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(path));
  } catch (error) {
    process.stderr.write(`cannot read ${path}: ${(error as Error).message}\n`);
    return 66; // EX_NOINPUT
  }

  let binary;
  try {
    binary = decode(bytes);
  } catch (error) {
    if (error instanceof UnknownFieldsError) {
      // The interesting failure. This means the file contains something proto/
      // does not model, which is a finding worth capturing as a corpus entry —
      // not a bug in the file.
      process.stderr.write(
        `${painter.paint("unknown fields", "red", "bold")} — this file contains data the schema does not model.\n\n`,
      );
      for (const finding of error.findings) {
        process.stderr.write(
          `  ${finding.path}\n` +
            `    field ${finding.fieldNumber} · ${finding.wireTypeName} · ${finding.byteLength} bytes\n`,
        );
      }
      process.stderr.write(
        `\nThis is worth adding to testdata/ — see spec/FORMAT.md §9.\n`,
      );
      return 65; // EX_DATAERR
    }
    process.stderr.write(`cannot decode ${path}: ${(error as Error).message}\n`);
    return 65;
  }

  let container;
  try {
    container = readContainer(binary);
  } catch (error) {
    if (error instanceof UnsupportedContainerError) {
      process.stderr.write(`${painter.paint("unrecognised workout type", "red", "bold")}\n\n${error.message}\n`);
      return 65;
    }
    throw error;
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(toJsonObject(binary), null, 2)}\n`);
    return 0;
  }

  const out: string[] = [""];

  if (container.kind === "singleGoal") {
    // Field 10: one activity, one goal, no blocks — nothing to tabulate, but it
    // still deserves reading like a workout rather than like a JSON dump.
    const workout = container.workout;
    const activity = CustomWorkout_ActivityType[workout.activityType] ?? `activity ${workout.activityType}`;
    const location = CustomWorkout_LocationType[workout.locationType] ?? "";
    const title = workout.displayName ?? "simple workout";

    const meta = painter.paint(
      `${activity.toLowerCase().replace(/_/g, " ")} · ${location.toLowerCase()}`,
      "dim",
    );
    const gap = Math.max(1, width - title.length - meta.length + 8);
    out.push(`  ${painter.paint(title, "bold", "brightCyan")}${" ".repeat(gap)}${meta}`);
    out.push("");
    out.push(
      `  ${painter.paint("goal", "dim")}   ${painter.paint(describeSingleGoal(workout.goal), "bold")}`,
    );
    out.push(
      `  ${painter.paint("note", "dim")}   ${painter.paint("a single-goal workout — no warm up, blocks or cool down", "dim")}`,
    );
  } else {
    out.push(renderHeader(container.workout.displayName ?? "untitled", container.workout, painter, width));
    out.push("");
    out.push(...renderRows(summarize(container.workout), { painter, width }));
    out.push(...renderTotals(container.workout, painter, width));
  }

  out.push("");
  out.push(`  ${painter.paint("GUID", "dim")}  ${painter.paint(binary.GUID, "dim")}`);
  out.push(
    `  ${painter.paint("wire", "dim")}  ${painter.paint(`version ${binary.version} · format ${binary.format} · ${bytes.length} bytes · field ${container.fieldNumber}`, "dim")}`,
  );

  // Zero unknown fields is the assertion that actually proves the schema is
  // complete for this file, so it is worth saying out loud.
  const unknown = findUnknownFields(WorkoutBinarySchema, binary);
  out.push(
    `  ${painter.paint("schema", "dim")}  ${
      unknown.length === 0
        ? painter.paint(`${painter.glyph("✓", "+")} no unknown fields`, "green")
        : painter.paint(`${unknown.length} unknown fields`, "red")
    }`,
  );

  const validation = validateWorkout(binary);
  if (validation.errors.length > 0) {
    out.push(`  ${painter.paint("invalid", "red")}`);
    for (const issue of validation.errors) {
      out.push(`    ${painter.paint(issue.code, "red")} ${issue.message}`);
    }
  }
  for (const warning of validation.warnings) {
    out.push(`  ${painter.paint("warning", "yellow")}  ${painter.paint(warning.message, "dim")}`);
  }

  out.push("");
  process.stdout.write(`${out.join("\n")}\n`);
  return 0;
}

/**
 * ENERGY appears only in single-goal workouts — the custom-workout composer
 * never offers it — so this is the one place a kcal goal can show up.
 */
function describeSingleGoal(goal: WorkoutGoal | undefined): string {
  if (goal === undefined) return "none";
  const spec = fromWorkoutGoal(goal);
  switch (spec.kind) {
    case "distance":
      return formatDistance(spec.distance);
    case "time":
      return formatDuration(spec.duration);
    case "energy":
      return `${spec.kilocalories.toLocaleString("en-US")} kcal`;
    case "distanceTime":
      return `${formatDistance(spec.distance)} on ${formatDuration(spec.duration)}`;
    case "open":
      return "open";
  }
}
