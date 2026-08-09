/**
 * Round-trip safety when editing a real file.
 *
 * The guarantee under test: decode a real file, change one step, re-encode, and
 * nothing else moves. Not the GUID, not the authored units, not a time goal
 * stored in MINUTES beside one stored in SECONDS.
 */

import { deepStrictEqual, notStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { decode, encode, toJsonObject } from "@dotworkout/codec";
import { editStepAt, editSteps, totalDistance, withGuid, withName } from "../src/index.js";
import { corpusNames, expectedJson, workoutBytes } from "./corpus.js";

const TARGET = "custom_workout.interval_blocks[0].interval_steps[0].workout_step";

describe("editing one step perturbs nothing else", () => {
  it("changes exactly one JSON path", () => {
    const original = decode(workoutBytes("PoolSwim_2"));
    const edited = editStepAt(original, TARGET, (step) => {
      step.displayName = "Build (fins)";
    });

    const before = expectedJson("PoolSwim_2");
    const after = toJsonObject(edited) as Record<string, unknown>;

    deepStrictEqual(differingPaths(before, after), [
      "custom_workout.interval_blocks[0].interval_steps[0].workout_step.display_name",
    ]);
  });

  it("leaves the input message untouched", () => {
    const original = decode(workoutBytes("PoolSwim_2"));
    const snapshot = toJsonObject(original);
    editStepAt(original, TARGET, (step) => {
      step.displayName = "mutated";
    });
    deepStrictEqual(toJsonObject(original), snapshot);
  });

  it("keeps the file byte-identical when the edit is a no-op", () => {
    for (const name of corpusNames()) {
      const bytes = workoutBytes(name);
      const untouched = editSteps(decode(bytes), () => false, () => {});
      strictEqual(
        Buffer.from(encode(untouched)).toString("hex"),
        Buffer.from(bytes).toString("hex"),
        `${name} changed under a no-op edit`,
      );
    }
  });

  it("preserves mixed time units elsewhere in the file", () => {
    // Probe_Time stores its warm up as MINUTES 5 and its cool down as SECONDS
    // 120. An edit to one must not normalise the other.
    const original = decode(workoutBytes("Probe_Time"));
    const edited = withName(original, "renamed");
    const after = toJsonObject(edited) as Record<string, unknown>;
    deepStrictEqual(differingPaths(expectedJson("Probe_Time"), after), [
      "custom_workout.display_name",
    ]);
  });

  it("keeps the GUID across a rename, since renaming is an edit not a new workout", () => {
    const original = decode(workoutBytes("PoolSwim_2"));
    strictEqual(withName(original, "renamed").GUID, original.GUID);
    notStrictEqual(withGuid(original, "00000000-0000-4000-8000-000000000000").GUID, original.GUID);
  });
});

describe("reading real files", () => {
  it("computes a per-label breakdown of a real swim", () => {
    const workout = decode(workoutBytes("PoolSwim_2")).customWorkout!;
    const totals = totalDistance(workout);

    // Labels are where stroke lives — there is no stroke field in the format.
    deepStrictEqual(
      totals.byLabel.map((entry) => entry.label),
      [
        "Build",
        "Sprint power",
        "Pull strength (pullboy + paddles)",
        "Pull volume (pullboy only)",
        "Backstroke",
      ],
    );
    ok(totals.total.meters > 0);
    strictEqual(
      totals.total.meters,
      totals.byLabel.reduce((sum, entry) => sum + entry.total.meters, 0) +
        totals.unlabelled.meters,
    );
  });

  it("reports mixed units without collapsing them", () => {
    // Minimal_miles stores its distance in MILES. Nothing converts it in place.
    const workout = decode(workoutBytes("Minimal_miles")).customWorkout!;
    const totals = totalDistance(workout);
    for (const entry of totals.total.byUnit) {
      strictEqual(entry.unit, "mi");
    }
  });
});

/** Dotted paths whose leaf values differ between two decoded JSON trees. */
function differingPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    const out: string[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      out.push(...differingPaths(before[i], after[i], `${prefix}[${i}]`));
    }
    return out;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const out: string[] = [];
    for (const key of [...keys].sort()) {
      out.push(...differingPaths(before[key], after[key], prefix === "" ? key : `${prefix}.${key}`));
    }
    return out;
  }
  return Object.is(before, after) ? [] : [prefix];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
