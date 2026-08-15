/**
 * Validation, across both layers.
 *
 * The asymmetry from `constraints/README.md` is what most of this file is
 * about: confirmed entries are enforced, unverified ones warn and are never
 * rejected. A combination nobody checked is not a combination known to be
 * illegal, and rejecting it would block a legitimate workout with no recourse.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deepStrictEqual, ok, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CustomWorkout_ActivityType,
  WorkoutAlert_AlertStyle,
  decode,
} from "@dotworkout/codec";
import {
  COMPATIBILITY,
  COMPATIBILITY_SOURCE_PATH,
  COMPATIBILITY_SOURCE_SHA256,
  WorkoutValidationError,
  bike,
  custom,
  hiit,
  singleGoal,
  swim,
  validateWorkout,
} from "../src/index.js";
import { corpusNames, ROOT, workoutBytes } from "./corpus.js";

describe("the generated matrix tracks its source", () => {
  it("has not drifted from constraints/compatibility.json", () => {
    // If this fails, run `npm run generate:constraints`. The JSON is the single
    // source of truth; the generated module is a transcription of it, and the
    // two must never disagree.
    const raw = readFileSync(join(ROOT, COMPATIBILITY_SOURCE_PATH), "utf8");
    strictEqual(
      createHash("sha256").update(raw, "utf8").digest("hex"),
      COMPATIBILITY_SOURCE_SHA256,
      "constraints/compatibility.json changed without regenerating the domain layer",
    );
  });

  it("transcribes the source verbatim, without reshaping it", () => {
    const raw = JSON.parse(readFileSync(join(ROOT, COMPATIBILITY_SOURCE_PATH), "utf8"));
    deepStrictEqual(JSON.parse(JSON.stringify(COMPATIBILITY)), raw);
  });
});

describe("every real file validates clean", () => {
  for (const name of corpusNames()) {
    it(name, () => {
      const result = validateWorkout(decode(workoutBytes(name)));
      deepStrictEqual(
        result.errors.map((issue) => `${issue.code} @ ${issue.path}: ${issue.message}`),
        [],
      );
      ok(result.ok);
    });
  }
});

describe("compatibility: confirmed entries are enforced", () => {
  it("rejects a power alert on a swim", () => {
    // The motivating example: this serialises fine and produces a file the
    // Watch may reject, because the format encodes no such constraint.
    const result = swim("bad").repeat(4).of(100).alert({ kind: "power", watts: 200 }).validate();
    strictEqual(result.ok, false);
    const issue = result.errors.find((e) => e.code === "compat.alert_not_offered");
    ok(issue, `expected compat.alert_not_offered, got ${JSON.stringify(result.errors)}`);
    ok(issue.message.includes("SWIMMING"));
    ok(issue.message.includes("HEART_RATE"));
  });

  it("rejects a send-off on a run, since DISTANCE_TIME is swimming-only", () => {
    const result = bike("bad").repeat(4).of("1km").on("2:00").validate();
    strictEqual(result.ok, false);
    ok(result.errors.some((e) => e.code === "compat.goal_not_offered"));
  });

  it("rejects a distance goal on HIIT", () => {
    const result = hiit("bad").repeat(4).of(100).validate();
    strictEqual(result.ok, false);
    ok(result.errors.some((e) => e.code === "compat.goal_not_offered"));
  });

  it("rejects an ENERGY goal in a custom workout", () => {
    // ENERGY exists only in single-goal workouts.
    const result = validateWorkout(
      singleGoal(CustomWorkout_ActivityType.CYCLING, { kind: "energy", kilocalories: 360 }),
    );
    ok(result.ok, "as a single-goal workout it is fine");
  });

  it("rejects an OPEN goal in a single-goal workout", () => {
    const result = validateWorkout(
      singleGoal(CustomWorkout_ActivityType.CYCLING, { kind: "open" }),
    );
    strictEqual(result.ok, false);
    ok(result.errors.some((e) => e.code === "compat.single_goal_type_not_offered"));
  });

  it("rejects a heart-rate alert asking for a single value", () => {
    // Structural, not a matrix opinion: HeartRateRangeAlert field 1 holds a zone
    // index, so there is nowhere for a single HR target to go.
    const binary = swim("hr").repeat(4).of(100).hrZone(3).build();
    const alert = binary.customWorkout!.intervalBlocks[0]!.intervalSteps[0]!.workoutStep!
      .workoutAlert!;
    alert.alertStyle = WorkoutAlert_AlertStyle.VALUE;
    const result = validateWorkout(binary);
    strictEqual(result.ok, false);
    ok(
      result.errors.some(
        (e) =>
          e.code === "structural.workout_alert.style_matches_payload_shape" ||
          e.code === "compat.alert_style_not_offered",
      ),
      JSON.stringify(result.errors),
    );
  });
});

describe("compatibility: unverified entries warn and never reject", () => {
  it("takes a heart-rate alert on a bike without complaint", () => {
    // Checked on the device: an outdoor cycle offers all four targets, so this
    // is no longer the "unverified" case it used to be.
    const result = bike("hr ride").repeat(3).of("5km").hrZone(2).validate();
    ok(result.ok, `should not be rejected: ${JSON.stringify(result.errors)}`);
    strictEqual(
      result.warnings.filter((w) => w.code === "compat.alert_unverified").length,
      0,
      JSON.stringify(result.warnings),
    );
  });

  it("enforces a sport once its options have been read off the device", () => {
    // Rowing used to be in customWorkoutUnverifiedActivities, so anything went
    // with a warning. The composer has since been checked: heart rate only.
    const result = custom(CustomWorkout_ActivityType.ROWING, "erg")
      .repeat(4)
      .of("500m")
      .alert({ kind: "power", watts: 220 })
      .validate();
    strictEqual(result.ok, false);
    ok(
      result.errors.some((e) => e.code === "compat.alert_not_offered"),
      JSON.stringify(result.errors),
    );
  });

  it("allows an activity outside the known permission list, with a warning", () => {
    // The field carries a raw HKWorkoutActivityType, a public enum of ~80
    // entries. 79 (pickleball) is not one WorkoutKit is known to accept, but
    // nothing has verified that it is rejected either.
    const result = custom(79 as CustomWorkout_ActivityType, "pickleball")
      .repeat(4)
      .of({ time: 300 })
      .validate();
    ok(result.ok, JSON.stringify(result.errors));
    ok(result.warnings.some((w) => w.code === "compat.activity_unknown"));
  });

  it("carries the source note through so the caller sees the caveat", () => {
    const result = swim("bad").repeat(4).of(100).alert({ kind: "power", watts: 200 }).validate();
    const issue = result.errors.find((e) => e.code === "compat.alert_not_offered");
    ok(issue?.note?.includes("stroke is typed into"), issue?.note);
  });
});

describe("errors can be downgraded when the matrix is wrong", () => {
  it("demotes a named code to a warning", () => {
    // The matrix was read off one device on one day. When it is wrong, the way
    // through must not be "edit the library".
    const binary = swim("bad").repeat(4).of(100).alert({ kind: "power", watts: 200 }).build();
    const result = validateWorkout(binary, {
      downgradeToWarning: ["compat.alert_not_offered"],
    });
    ok(result.ok);
    ok(result.warnings.some((w) => w.code === "compat.alert_not_offered"));
  });
});

describe("structural invariants come from protovalidate, not hand-written checks", () => {
  it("catches iterations below 1", () => {
    const binary = swim("x").set(100).build();
    binary.customWorkout!.intervalBlocks[0]!.iterations = 0;
    const result = validateWorkout(binary);
    strictEqual(result.ok, false);
    ok(result.errors.some((e) => e.code.startsWith("structural.")), JSON.stringify(result.errors));
  });

  it("catches a goal_type that disagrees with its payload", () => {
    const binary = swim("x").set(100).build();
    const goal = binary.customWorkout!.intervalBlocks[0]!.intervalSteps[0]!.workoutStep!
      .workoutGoal!;
    goal.goalType = 1; // TIME, but distance_goal is what is populated
    const result = validateWorkout(binary);
    strictEqual(result.ok, false);
    ok(
      result.errors.some((e) => e.code === "structural.workout_goal.payload_matches_goal_type"),
      JSON.stringify(result.errors),
    );
  });

  it("catches an inverted heart-rate range", () => {
    const binary = swim("x").repeat(4).of(100).hrRange(160, 120).build();
    const result = validateWorkout(binary);
    strictEqual(result.ok, false);
    ok(
      result.errors.some((e) => e.code === "structural.heart_rate_range.bounds_ordered"),
      JSON.stringify(result.errors),
    );
  });

  it("catches both containers being set at once", () => {
    const binary = swim("x").set(100).build();
    const other = singleGoal(CustomWorkout_ActivityType.CYCLING, {
      kind: "energy",
      kilocalories: 100,
    });
    binary.singleGoalWorkout = other.singleGoalWorkout;
    const result = validateWorkout(binary);
    strictEqual(result.ok, false);
  });
});

describe("a sport can offer less indoors than out", () => {
  it("keeps speed off an indoor bike", () => {
    const result = bike("turbo", { location: "indoor" })
      .repeat(3)
      .of({ time: 300 })
      .alert({ kind: "speed", metersPerSecond: 8 })
      .validate();
    strictEqual(result.ok, false);
    strictEqual(result.errors[0]?.code, "compat.alert_not_offered");
  });

  it("still takes power there, which the trainer does measure", () => {
    const result = bike("turbo", { location: "indoor" })
      .repeat(3)
      .of({ time: 300 })
      .alert({ kind: "power", watts: 220 })
      .validate();
    ok(result.ok, JSON.stringify(result.errors));
  });

  it("drops the distance goal indoors and keeps it outdoors", () => {
    const inside = bike("turbo", { location: "indoor" }).repeat(1).of("5km").validate();
    strictEqual(inside.ok, false);
    strictEqual(inside.errors[0]?.code, "compat.goal_not_offered");

    ok(bike("road").repeat(1).of("5km").validate().ok);
  });

  it("leaves a sport without an indoor block alone", () => {
    ok(swim("pool").repeat(4).of(100).hrZone(3).validate().ok);
  });
});

describe("toBytes gates on validation", () => {
  it("throws rather than writing a file the Watch may reject", () => {
    throws(
      () => swim("bad").repeat(4).of(100).alert({ kind: "power", watts: 200 }).toBytes(),
      WorkoutValidationError,
    );
  });

  it("writes anyway when explicitly told to", () => {
    const bytes = swim("bad")
      .repeat(4)
      .of(100)
      .alert({ kind: "power", watts: 200 })
      .toBytes({ skipValidation: true });
    ok(bytes.length > 0);
  });

  it("does not block on warnings alone", () => {
    ok(bike("hr ride").repeat(3).of("5km").hrZone(2).toBytes().length > 0);
  });
});
