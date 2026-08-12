import assert from "node:assert/strict";
import { test } from "node:test";
import { decode } from "@dotworkout/codec";
import { steps, totalDistance, validateWorkout } from "@dotworkout/domain";
import { buildWorkout } from "../src/workout.js";

test("a swim spec becomes a valid workout", () => {
  const bytes = buildWorkout({
    activity: "SWIMMING",
    name: "Thursday threshold",
    warmup: { distance: "400" },
    blocks: [
      { repeat: 8, work: { distance: "50" }, sendOff: "1:00", label: "Build" },
      { repeat: 4, work: { distance: "100" }, rest: ":20", label: "pull" },
    ],
    cooldown: { distance: "200" },
  }).toBytes();

  const binary = decode(bytes);
  const custom = binary.customWorkout;
  assert.ok(custom !== undefined);
  assert.equal(custom.displayName, "Thursday threshold");
  assert.equal(totalDistance(custom).total.byUnit[0]?.value, 1400);
  assert.deepEqual(
    steps(custom)
      .map((s) => s.label)
      .filter((l) => l !== undefined && l !== ""),
    ["Build", "pull"],
  );
});

test("authored units survive", () => {
  const bytes = buildWorkout({
    activity: "SWIMMING",
    blocks: [{ repeat: 1, work: { distance: "100 yd" } }],
  }).toBytes();

  const total = totalDistance(decode(bytes).customWorkout!).total;
  assert.equal(total.byUnit[0]?.unit, "yd");
  assert.equal(total.byUnit[0]?.value, 100);
});

test("an alert the sport does not offer is an error", () => {
  const binary = buildWorkout({
    activity: "SWIMMING",
    blocks: [{ repeat: 1, work: { distance: "100" }, alert: { kind: "power", watts: 250 } }],
  }).build();

  const result = validateWorkout(binary);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0]?.code, "compat.alert_not_offered");
});

test("an unverified combination warns but is allowed", () => {
  const binary = buildWorkout({
    activity: "CYCLING",
    blocks: [{ repeat: 1, work: { time: "10:00" }, alert: { kind: "power", watts: 250 } }],
  }).build();

  const result = validateWorkout(binary);
  assert.equal(result.ok, true);
  assert.ok(result.warnings.length > 0);
});
