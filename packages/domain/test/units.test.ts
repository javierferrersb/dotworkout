/**
 * Unit handling.
 *
 * The rule under test throughout: authored units are preserved, never
 * canonicalised. `spec/FORMAT.md` §5 — 100 m authored as miles becomes 0.06 mi,
 * which is 96.6 m, so a library that "helpfully" normalises to metres silently
 * changes the workout.
 */

import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import { WorkoutGoal_GoalType } from "@dotworkout/codec";
import {
  formatDuration,
  fromWorkoutGoal,
  parseDistance,
  parseDuration,
  toMeters,
  toSeconds,
  toWorkoutGoal,
  UnitParseError,
} from "../src/index.js";

describe("parseDistance", () => {
  it("applies the default unit only to bare numbers", () => {
    deepStrictEqual(parseDistance(400), { value: 400, unit: "m" });
    deepStrictEqual(parseDistance(400, "yd"), { value: 400, unit: "yd" });
    deepStrictEqual(parseDistance("400"), { value: 400, unit: "m" });
  });

  it("keeps an explicitly written unit, whatever the default is", () => {
    deepStrictEqual(parseDistance("0.5mi", "m"), { value: 0.5, unit: "mi" });
    deepStrictEqual(parseDistance("1.2 km", "yd"), { value: 1.2, unit: "km" });
    deepStrictEqual(parseDistance("100 yards", "m"), { value: 100, unit: "yd" });
  });

  it("rejects nonsense rather than guessing", () => {
    throws(() => parseDistance("400 furlongs"), UnitParseError);
    throws(() => parseDistance("lots"), UnitParseError);
    throws(() => parseDistance(0), UnitParseError);
    throws(() => parseDistance(-50), UnitParseError);
  });
});

describe("parseDuration", () => {
  it("reads clock notation as seconds, matching how the app stores it", () => {
    // Swim_DistTime stores 1:00 and 2:00 as SECONDS 60 and 120.
    deepStrictEqual(parseDuration("1:00"), { value: 60, unit: "s" });
    deepStrictEqual(parseDuration("2:00"), { value: 120, unit: "s" });
    deepStrictEqual(parseDuration(":20"), { value: 20, unit: "s" });
    deepStrictEqual(parseDuration("1:30:00"), { value: 5400, unit: "s" });
  });

  it("preserves an explicit minutes or hours unit instead of expanding it", () => {
    // Probe_Time stores its warm up as MINUTES 5, not SECONDS 300.
    deepStrictEqual(parseDuration("5min"), { value: 5, unit: "min" });
    deepStrictEqual(parseDuration("1h"), { value: 1, unit: "h" });
    deepStrictEqual(parseDuration("90s"), { value: 90, unit: "s" });
  });

  it("treats a bare number as seconds", () => {
    deepStrictEqual(parseDuration(30), { value: 30, unit: "s" });
  });

  it("rejects nonsense", () => {
    throws(() => parseDuration("1:2:3:4"), UnitParseError);
    throws(() => parseDuration("soon"), UnitParseError);
    throws(() => parseDuration(0), UnitParseError);
  });
});

describe("unit preservation through a goal round-trip", () => {
  it("keeps 5 minutes as MINUTES rather than 300 seconds", () => {
    const goal = toWorkoutGoal({ kind: "time", duration: parseDuration("5min") });
    deepStrictEqual(goal.timeGoal, { $typeName: "WorkoutGoal.TimeGoal", unitType: 2, unitValue: 5 });
    deepStrictEqual(fromWorkoutGoal(goal), { kind: "time", duration: { value: 5, unit: "min" } });
  });

  it("keeps 0.5 miles as MILES rather than 804.672 metres", () => {
    const goal = toWorkoutGoal({ kind: "distance", distance: parseDistance("0.5mi") });
    strictEqual(goal.goalType, WorkoutGoal_GoalType.DISTANCE);
    strictEqual(goal.distanceGoal?.unitType, 5);
    strictEqual(goal.distanceGoal?.unitValue, 0.5);
    deepStrictEqual(fromWorkoutGoal(goal), {
      kind: "distance",
      distance: { value: 0.5, unit: "mi" },
    });
  });

  it("keeps both quantities of a send-off in their authored units", () => {
    const goal = toWorkoutGoal({
      kind: "distanceTime",
      distance: parseDistance(100),
      duration: parseDuration("2:00"),
    });
    strictEqual(goal.goalType, WorkoutGoal_GoalType.DISTANCE_TIME);
    // Field 5 carries both. It does NOT populate time_goal and distance_goal.
    strictEqual(goal.timeGoal, undefined);
    strictEqual(goal.distanceGoal, undefined);
    strictEqual(goal.distanceTimeGoal?.distance?.unitValue, 100);
    strictEqual(goal.distanceTimeGoal?.time?.unitValue, 120);
  });
});

describe("derived conversions", () => {
  it("converts only for display, using exact definitions", () => {
    strictEqual(toMeters({ value: 1, unit: "mi" }), 1609.344);
    strictEqual(toMeters({ value: 1, unit: "yd" }), 0.9144);
    strictEqual(toMeters({ value: 1.2, unit: "km" }), 1200);
    strictEqual(toSeconds({ value: 5, unit: "min" }), 300);
  });

  it("demonstrates the loss the format warns about", () => {
    // spec §5: 100 m authored as miles becomes 0.06 mi, which is 96.6 m.
    const asMiles = Number((toMeters({ value: 100, unit: "m" }) / 1609.344).toFixed(2));
    strictEqual(asMiles, 0.06);
    strictEqual(Math.round(toMeters({ value: asMiles, unit: "mi" }) * 10) / 10, 96.6);
  });
});

describe("formatDuration", () => {
  it("renders whole-second durations as clock time", () => {
    strictEqual(formatDuration({ value: 120, unit: "s" }), "2:00");
    strictEqual(formatDuration({ value: 90, unit: "s" }), "1:30");
    strictEqual(formatDuration({ value: 30, unit: "s" }), "30s");
    strictEqual(formatDuration({ value: 5, unit: "min" }), "5min");
  });
});
