/**
 * The authoring API, including the exact chain from the brief:
 *
 * ```ts
 * swim("Thursday threshold")
 *   .warmup(400)
 *   .repeat(8).of(50).rest(30).label("Build")
 *   .repeat(4).of(100).on("2:00")
 *   .cooldown(200)
 * ```
 */

import { deepStrictEqual, match, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  IntervalBlock_IntervalStep_IntervalPurpose,
  WorkoutAlert_AlertStyle,
  WorkoutGoal_GoalType,
  decode,
  encode,
  readContainer,
} from "@dotworkout/codec";
import { singleGoal, steps, swim, totalDistance, bike, run } from "../src/index.js";

function built() {
  return swim("Thursday threshold")
    .warmup(400)
    .repeat(8)
    .of(50)
    .rest(30)
    .label("Build")
    .repeat(4)
    .of(100)
    .on("2:00")
    .cooldown(200)
    .build();
}

describe("the target chain", () => {
  it("produces the workout it reads like", () => {
    const binary = built();
    const container = readContainer(binary);
    strictEqual(container.kind, "custom");
    const workout = container.workout;

    strictEqual(workout.displayName, "Thursday threshold");
    strictEqual(workout.activityType, CustomWorkout_ActivityType.SWIMMING);
    // Pool swims store as OUTDOOR (spec §3), counter-intuitive but observed.
    strictEqual(workout.locationType, CustomWorkout_LocationType.OUTDOOR);

    strictEqual(workout.warmup?.workoutGoal?.distanceGoal?.unitValue, 400);
    strictEqual(workout.cooldown?.workoutGoal?.distanceGoal?.unitValue, 200);
    strictEqual(workout.intervalBlocks.length, 2);

    const [build, sendOff] = workout.intervalBlocks;
    strictEqual(build?.iterations, 8);
    strictEqual(build?.intervalSteps.length, 2);
    strictEqual(build?.intervalSteps[0]?.purpose, IntervalBlock_IntervalStep_IntervalPurpose.WORK);
    strictEqual(build?.intervalSteps[0]?.workoutStep?.displayName, "Build");
    strictEqual(build?.intervalSteps[0]?.workoutStep?.workoutGoal?.distanceGoal?.unitValue, 50);
    strictEqual(
      build?.intervalSteps[1]?.purpose,
      IntervalBlock_IntervalStep_IntervalPurpose.RECOVERY,
    );
    strictEqual(build?.intervalSteps[1]?.workoutStep?.workoutGoal?.timeGoal?.unitValue, 30);

    strictEqual(sendOff?.iterations, 4);
  });

  it("writes .on() as a DISTANCE_TIME send-off, not a time goal beside a distance goal", () => {
    // spec §5: goal_type 5 carries both quantities in a dedicated payload.
    const goal =
      built().customWorkout?.intervalBlocks[1]?.intervalSteps[0]?.workoutStep?.workoutGoal;
    strictEqual(goal?.goalType, WorkoutGoal_GoalType.DISTANCE_TIME);
    strictEqual(goal.timeGoal, undefined);
    strictEqual(goal.distanceGoal, undefined);
    strictEqual(goal.distanceTimeGoal?.distance?.unitValue, 100);
    strictEqual(goal.distanceTimeGoal?.time?.unitValue, 120);
  });

  it("round-trips through the codec unchanged", () => {
    const binary = built();
    const bytes = encode(binary);
    // Strict decode: the builder must not emit anything the schema cannot model.
    deepStrictEqual(decode(bytes), binary);
  });

  it("mints a fresh UUIDv4 per workout", () => {
    // The GUID is a stable per-workout identity, so two separately authored
    // workouts must not collide on import.
    const a = built().GUID;
    const b = built().GUID;
    match(a, /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
    strictEqual(a === b, false);
  });

  it("reuses a GUID only when explicitly asked", () => {
    const guid = "EB04F3B5-6C4E-4F8F-BB9D-276D50D7E2A8";
    strictEqual(swim("x", { guid }).set(100).build().GUID, guid);
  });
});

describe("builder surface", () => {
  it("accepts a time-goal or open step where a distance would go", () => {
    const workout = swim("mixed")
      .warmup({ time: "5min" })
      .repeat(2)
      .of({ open: true })
      .rest(":20")
      .build().customWorkout;

    strictEqual(workout?.warmup?.workoutGoal?.timeGoal?.unitType, 2); // MINUTES, preserved
    strictEqual(
      workout?.intervalBlocks[0]?.intervalSteps[0]?.workoutStep?.workoutGoal?.goalType,
      WorkoutGoal_GoalType.OPEN,
    );
    strictEqual(
      workout?.intervalBlocks[0]?.intervalSteps[1]?.workoutStep?.workoutGoal?.timeGoal?.unitValue,
      20,
    );
  });

  it("supports recovery-only blocks", () => {
    // Minimal and Activity_Cycle both contain one, so this has to be expressible.
    const block = swim("rest only").recovery(30).build().customWorkout?.intervalBlocks[0];
    strictEqual(block?.intervalSteps.length, 1);
    strictEqual(block?.intervalSteps[0]?.purpose, IntervalBlock_IntervalStep_IntervalPurpose.RECOVERY);
  });

  it("writes iterations 1 for a single unrepeated set", () => {
    // The picker offers 2-98, but 1 is what the wire uses for one-off steps.
    strictEqual(swim("single").set(400).build().customWorkout?.intervalBlocks[0]?.iterations, 1);
  });

  it("uses the sport's natural default unit for bare numbers", () => {
    strictEqual(swim("s").set(400).build().customWorkout?.intervalBlocks[0]
      ?.intervalSteps[0]?.workoutStep?.workoutGoal?.distanceGoal?.unitType, 1); // METERS
    strictEqual(bike("b").set(40).build().customWorkout?.intervalBlocks[0]
      ?.intervalSteps[0]?.workoutStep?.workoutGoal?.distanceGoal?.unitType, 2); // KILOMETERS
  });

  it("puts heart-rate zones on the step, with the ZONE style", () => {
    const alert = swim("z").repeat(4).of(100).hrZone(3).build().customWorkout
      ?.intervalBlocks[0]?.intervalSteps[0]?.workoutStep?.workoutAlert;
    strictEqual(alert?.alertStyle, WorkoutAlert_AlertStyle.ZONE);
    strictEqual(alert?.heartRateRangeAlert?.heartRateZone?.zone, 3);
    strictEqual(alert?.heartRateRangeAlert?.heartRateRange, undefined);
  });

  it("refuses .on() where there is no distance to send off", () => {
    throws(
      () => swim("bad").repeat(4).of({ time: 60 }).on("2:00"),
      /turns a distance into a send-off/,
    );
  });

  it("refuses a non-positive repeat count", () => {
    throws(() => swim("bad").repeat(0), RangeError);
    throws(() => swim("bad").repeat(2.5), RangeError);
  });
});

describe("single-goal workouts", () => {
  it("builds the one shape that can carry an ENERGY goal", () => {
    // ENERGY appears only here; the custom-workout composer never offers it.
    const binary = singleGoal(CustomWorkout_ActivityType.CYCLING, {
      kind: "energy",
      kilocalories: 360,
    });
    const container = readContainer(binary);
    strictEqual(container.kind, "singleGoal");
    strictEqual(container.fieldNumber, 10);
    strictEqual(container.workout.goal?.goalType, WorkoutGoal_GoalType.ENERGY);
    strictEqual(container.workout.goal?.energyGoal?.unitValue, 360);
    strictEqual(binary.customWorkout, undefined);
  });
});

describe("totals feed off the built workout", () => {
  it("counts iterations and groups by label", () => {
    const workout = swim("labelled")
      .warmup(400)
      .repeat(8)
      .of(50)
      .rest(30)
      .label("Build")
      .repeat(4)
      .of(100)
      .on("2:00")
      .label("Pull")
      .cooldown(200)
      .build().customWorkout!;

    const totals = totalDistance(workout);
    // 400 + 8x50 + 4x100 + 200 = 1400
    strictEqual(totals.total.meters, 1400);
    deepStrictEqual(totals.total.byUnit, [{ value: 1400, unit: "m" }]);
    strictEqual(totals.total.mixedUnits, false);
    deepStrictEqual(
      totals.byLabel.map((entry) => [entry.label, entry.total.meters]),
      [
        ["Build", 400],
        ["Pull", 400],
      ],
    );
    strictEqual(totals.unlabelled.meters, 600); // warm up + cool down
  });

  it("walks warm up, blocks and cool down in performance order", () => {
    const workout = swim("order").warmup(400).repeat(2).of(50).cooldown(100).build().customWorkout!;
    deepStrictEqual(
      steps(workout).map((s) => s.position.kind),
      ["warmup", "block", "cooldown"],
    );
  });
});

describe("other sports", () => {
  it("builds a run without swimming-specific idioms", () => {
    const binary = run("Tempo").warmup({ time: "10min" }).repeat(3).of("1km").rest(90).build();
    strictEqual(binary.customWorkout?.activityType, CustomWorkout_ActivityType.RUNNING);
    strictEqual(
      binary.customWorkout?.intervalBlocks[0]?.intervalSteps[0]?.workoutStep?.workoutGoal
        ?.distanceGoal?.unitType,
      2, // KILOMETERS, as written
    );
  });
});

describe("warm ups and cool downs carry targets", () => {
  // The Watch accepts them: ProbeAlertsRange, Swim_HR and
  // Probe_Alert_Range_Zone_2_HR all came off the device with an alert on their
  // warm up. The authoring API used to drop it silently.
  it("keeps a heart-rate range on the warm up", () => {
    const workout = run("hr warm up")
      .warmup("1km", { alert: { kind: "heartRateRange", from: 120, to: 140 } })
      .set("5km")
      .build().customWorkout!;

    const alert = workout.warmup?.workoutAlert;
    strictEqual(alert?.alertStyle, WorkoutAlert_AlertStyle.RANGE);
    strictEqual(alert?.heartRateRangeAlert?.heartRateRange?.lowerBound?.value, 120);
    strictEqual(alert?.heartRateRangeAlert?.heartRateRange?.upperBound?.value, 140);
  });

  it("keeps a zone on the cool down", () => {
    const workout = swim("zone cool down")
      .set(100)
      .cooldown(200, { alert: { kind: "heartRateZone", zone: 2 } })
      .build().customWorkout!;

    const alert = workout.cooldown?.workoutAlert;
    strictEqual(alert?.alertStyle, WorkoutAlert_AlertStyle.ZONE);
    strictEqual(alert?.heartRateRangeAlert?.heartRateZone?.zone, 2);
  });

  it("survives a round trip", () => {
    const bytes = run("round trip")
      .warmup("1km", { alert: { kind: "heartRateZone", zone: 3 }, label: "easy" })
      .set("5km")
      .toBytes();

    const warmup = decode(bytes).customWorkout?.warmup;
    strictEqual(warmup?.displayName, "easy");
    strictEqual(warmup?.workoutAlert?.heartRateRangeAlert?.heartRateZone?.zone, 3);
  });

  it("still validates against the sport", () => {
    const result = swim("bad")
      .warmup(200, { alert: { kind: "power", watts: 250 } })
      .set(100)
      .validate();
    strictEqual(result.ok, false);
    strictEqual(result.errors[0]?.code, "compat.alert_not_offered");
  });
});

describe("a send-off on a warm up or a cool down", () => {
  it("survives, rather than being quietly dropped to a plain distance", () => {
    const workout = swim("edges")
      .warmup(50, { sendOff: "1:00", label: "Easy" })
      .repeat(8)
      .of(50)
      .cooldown(200, { sendOff: "4:00" })
      .build();

    const custom = workout.customWorkout;
    strictEqual(custom?.warmup?.workoutGoal?.goalType, WorkoutGoal_GoalType.DISTANCE_TIME);
    strictEqual(custom?.warmup?.workoutGoal?.distanceTimeGoal?.time?.unitValue, 60);
    strictEqual(custom?.cooldown?.workoutGoal?.goalType, WorkoutGoal_GoalType.DISTANCE_TIME);
    strictEqual(custom?.cooldown?.workoutGoal?.distanceTimeGoal?.time?.unitValue, 240);
  });

  it("keeps the label and the target alongside it", () => {
    const custom = swim("edges")
      .warmup(50, { sendOff: "1:00", label: "Easy", alert: { kind: "heartRateZone", zone: 2 } })
      .repeat(4)
      .of(100)
      .build().customWorkout;

    strictEqual(custom?.warmup?.displayName, "Easy");
    strictEqual(custom?.warmup?.workoutAlert?.alertStyle, WorkoutAlert_AlertStyle.ZONE);
    strictEqual(custom?.warmup?.workoutGoal?.goalType, WorkoutGoal_GoalType.DISTANCE_TIME);
  });

  it("leaves a warm up without one as a plain distance", () => {
    const custom = swim("edges").warmup(400).repeat(4).of(100).build().customWorkout;
    strictEqual(custom?.warmup?.workoutGoal?.goalType, WorkoutGoal_GoalType.DISTANCE);
  });

  it("refuses a send-off on a goal that is not a distance", () => {
    throws(() => swim("edges").warmup({ time: "10:00" }, { sendOff: "1:00" }), /send-off/);
    throws(() => swim("edges").cooldown({ open: true }, { sendOff: "1:00" }), /send-off/);
  });
});
