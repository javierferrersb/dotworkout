/**
 * The notation grammar is the CLI's primary interface, so it is tested harder
 * than anything else in the package — including the cases where it must
 * *refuse* to guess.
 */

import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import { NotationError } from "../src/notation/tokenize.js";
import { parseLine, tryParseLine, type ParsedLine } from "../src/notation/parse.js";
import { applyLines, describeLine } from "../src/notation/apply.js";

function set(line: string) {
  const parsed = parseLine(line);
  strictEqual(parsed.kind, "set");
  return parsed as Extract<ParsedLine, { kind: "set" }>;
}

describe("sets", () => {
  it("parses a bare distance as one repetition", () => {
    const parsed = set("400");
    strictEqual(parsed.reps, 1);
    deepStrictEqual(parsed.work, { kind: "distance", distance: { value: 400, unit: "m" } });
  });

  it("parses repetitions", () => {
    for (const text of ["8x50", "8X50", "8×50", "8 x 50"]) {
      const parsed = set(text);
      strictEqual(parsed.reps, 8, text);
      deepStrictEqual(parsed.work, { kind: "distance", distance: { value: 50, unit: "m" } }, text);
    }
  });

  it("parses a send-off", () => {
    for (const text of ["8x50 on 1:00", "8x50 @1:00", "8x50 @ 1:00"]) {
      const parsed = set(text);
      deepStrictEqual(parsed.sendOff, { value: 60, unit: "s" }, text);
      strictEqual(parsed.rest, undefined, text);
    }
  });

  it("parses rest, in all the spellings people type", () => {
    for (const text of ["8x50 rest :20", "8x50 rest 20", "8x50 r:20", "8x50 r 20"]) {
      const parsed = set(text);
      deepStrictEqual(parsed.rest, { value: 20, unit: "s" }, text);
      strictEqual(parsed.sendOff, undefined, text);
    }
  });

  it("keeps send-off and rest distinct — they are different workouts", () => {
    strictEqual(set("8x50 on 1:00").rest, undefined);
    strictEqual(set("8x50 rest 1:00").sendOff, undefined);
  });

  it("treats leftover words as the label, since the format has no stroke field", () => {
    strictEqual(set("4x100 pull").label, "pull");
    strictEqual(set("4x100 pull rest :20").label, "pull");
    strictEqual(set("8x50 build fast").label, "build fast");
    strictEqual(set("4x100 Pull Buoy").label, "Pull Buoy", "original case is preserved");
  });

  it("parses a time-based set", () => {
    const parsed = set("4x1:00");
    strictEqual(parsed.reps, 4);
    deepStrictEqual(parsed.work, { kind: "time", duration: { value: 60, unit: "s" } });
  });

  it("parses an open set", () => {
    deepStrictEqual(set("open").work, { kind: "open" });
    strictEqual(set("3xopen").reps, 3);
  });

  it("preserves authored distance units", () => {
    deepStrictEqual(set("100y").work, { kind: "distance", distance: { value: 100, unit: "yd" } });
    deepStrictEqual(set("1.5k").work, { kind: "distance", distance: { value: 1.5, unit: "km" } });
    deepStrictEqual(set("0.5mi").work, { kind: "distance", distance: { value: 0.5, unit: "mi" } });
  });

  it("parses a heart-rate zone", () => {
    deepStrictEqual(set("8x50 z3").alert, { kind: "heartRateZone", zone: 3 });
    strictEqual(set("8x50 z3").label, undefined, "the zone is not swept into the label");
  });

  it("accepts modifiers in any order", () => {
    const a = set("8x50 pull on 1:00 z2");
    const b = set("8x50 z2 on 1:00 pull");
    strictEqual(a.label, b.label);
    deepStrictEqual(a.sendOff, b.sendOff);
    deepStrictEqual(a.alert, b.alert);
  });
});

describe("warm up and cool down", () => {
  it("accepts the keyword on either side", () => {
    for (const text of ["400 warmup", "warmup 400", "wu 400", "400 wu"]) {
      const parsed = parseLine(text);
      strictEqual(parsed.kind, "warmup", text);
    }
    for (const text of ["200 cooldown", "cd 200", "200 c/d"]) {
      strictEqual(parseLine(text).kind, "cooldown", text);
    }
  });

  it("accepts a time-based warm up", () => {
    const parsed = parseLine("warmup 10:00");
    strictEqual(parsed.kind, "warmup");
    deepStrictEqual(
      parsed.kind === "warmup" ? parsed.work : undefined,
      { kind: "time", duration: { value: 600, unit: "s" } },
    );
  });

  it("keeps extra words as the label", () => {
    const parsed = parseLine("400 warmup easy free");
    strictEqual(parsed.kind === "warmup" ? parsed.label : undefined, "easy free");
  });
});

describe("standalone rest", () => {
  it("parses a recovery-only block", () => {
    // Minimal.workout and Activity_Cycle.workout each contain one, so this has
    // to be expressible.
    for (const text of ["rest :30", "rest 30", "r:30"]) {
      const parsed = parseLine(text);
      strictEqual(parsed.kind, "rest", text);
      deepStrictEqual(parsed.kind === "rest" ? parsed.duration : undefined, {
        value: 30,
        unit: "s",
      });
    }
  });
});

describe("refusing to guess", () => {
  it("reads a bare number as distance, never as seconds", () => {
    // The one hard rule: guessing wrong here silently produces a completely
    // different workout, so times must carry a colon or a unit.
    deepStrictEqual(set("30").work, { kind: "distance", distance: { value: 30, unit: "m" } });
    deepStrictEqual(set(":30").work, { kind: "time", duration: { value: 30, unit: "s" } });
    deepStrictEqual(set("30s").work, { kind: "time", duration: { value: 30, unit: "s" } });
  });

  it("rejects a send-off on a time-based set", () => {
    throws(() => parseLine("4x1:00 on 2:00"), NotationError);
  });

  it("rejects a set with nothing to measure", () => {
    throws(() => parseLine("pull"), NotationError);
    throws(() => parseLine("8x"), NotationError);
  });

  it("rejects an incomplete modifier", () => {
    throws(() => parseLine("8x50 on"), NotationError);
    throws(() => parseLine("8x50 rest"), NotationError);
  });

  it("rejects zero repetitions", () => {
    throws(() => parseLine("0x50"), NotationError);
  });
});

describe("errors point at the problem", () => {
  it("carries an offset and length into the line", () => {
    const line = "8x50 on banana";
    const error = tryParseLine(line);
    ok(error instanceof NotationError, "expected a NotationError");
    strictEqual(line.slice(error.offset, error.offset + error.length), "banana");
    strictEqual(error.caret(), "        ^^^^^^");
  });

  it("suggests a fix", () => {
    const error = tryParseLine("8x50 on");
    ok(error instanceof NotationError);
    ok(error.hint !== undefined && error.hint.length > 0);
  });

  it("never throws from tryParseLine", () => {
    for (const junk of ["", "   ", "???", "8x", "on on on", "🏊"]) {
      const result = tryParseLine(junk);
      ok(result instanceof NotationError || typeof result === "object");
    }
  });
});

describe("echo back what was understood", () => {
  it("describes a send-off in plain English", () => {
    strictEqual(describeLine(parseLine("8x50 on 1:00")), "8 × 50 m · leaving every 1:00");
  });

  it("describes rest, label and zone", () => {
    strictEqual(
      describeLine(parseLine("4x100 pull rest :20 z3")),
      // `:20`, not `20s` — the echo matches the swim idiom the table uses.
      "4 × 100 m · :20 rest · HR zone 3 · “pull”",
    );
  });

  it("describes a warm up", () => {
    strictEqual(describeLine(parseLine("400 warmup")), "warm up 400 m");
  });
});

describe("building a real workout from notation", () => {
  it("produces the same thing as the fluent API", () => {
    const lines = ["400 warmup", "8x50 on 1:00 Build", "4x100 pull rest :20", "200 cooldown"].map(
      parseLine,
    );
    const binary = applyLines(lines, { name: "Thursday threshold" }).build();
    const workout = binary.customWorkout!;

    strictEqual(workout.displayName, "Thursday threshold");
    strictEqual(workout.warmup?.workoutGoal?.distanceGoal?.unitValue, 400);
    strictEqual(workout.cooldown?.workoutGoal?.distanceGoal?.unitValue, 200);
    strictEqual(workout.intervalBlocks.length, 2);

    const sendOff = workout.intervalBlocks[0]!;
    strictEqual(sendOff.iterations, 8);
    const goal = sendOff.intervalSteps[0]!.workoutStep!.workoutGoal!;
    strictEqual(goal.goalType, 5, "DISTANCE_TIME");
    strictEqual(goal.distanceTimeGoal?.time?.unitValue, 60);
    strictEqual(sendOff.intervalSteps[0]!.workoutStep!.displayName, "Build");

    const pull = workout.intervalBlocks[1]!;
    strictEqual(pull.iterations, 4);
    strictEqual(pull.intervalSteps.length, 2, "work + rest");
    strictEqual(pull.intervalSteps[1]!.workoutStep!.workoutGoal!.timeGoal?.unitValue, 20);
  });

  it("passes validation and encodes", () => {
    const lines = ["400 warmup", "8x50 on 1:00", "200 cd"].map(parseLine);
    const builder = applyLines(lines, { name: "ok" });
    strictEqual(builder.validate().ok, true);
    ok(builder.toBytes().length > 0);
  });
});

function ok(value: unknown, message?: string): asserts value {
  strictEqual(Boolean(value), true, message);
}
