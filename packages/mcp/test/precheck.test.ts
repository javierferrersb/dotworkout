import { deepStrictEqual, ok } from "node:assert/strict";
import { describe, it } from "node:test";
import { precheck } from "../src/precheck.js";
import type { WorkoutSpec } from "../src/workout.js";

const spec = (over: Partial<WorkoutSpec>): WorkoutSpec =>
  ({
    activity: "SWIMMING",
    blocks: [{ repeat: 8, work: { distance: "50" } }],
    ...over,
  }) as WorkoutSpec;

describe("the matrix, checked against the request", () => {
  it("passes a swim built the way swimming works", () => {
    const result = precheck(
      spec({
        warmup: { distance: "400" },
        blocks: [{ repeat: 8, work: { distance: "50" }, sendOff: "1:00" }],
        cooldown: { distance: "200" },
      }),
    );
    deepStrictEqual(result.errors, []);
    deepStrictEqual(result.warnings, []);
  });

  it("refuses a send-off on a sport that has no send-off", () => {
    const result = precheck(
      spec({
        activity: "RUNNING",
        blocks: [{ repeat: 4, work: { distance: "400" }, sendOff: "2:00" }],
      }),
    );
    ok(
      result.errors.some((e) => e.includes("DISTANCE_TIME")),
      `expected a DISTANCE_TIME error, got ${JSON.stringify(result.errors)}`,
    );
  });

  it("refuses a distance goal on an indoor bike, which measures no distance", () => {
    const result = precheck(
      spec({
        activity: "CYCLING",
        location: "indoor",
        blocks: [{ repeat: 4, work: { distance: "1000" } }],
      }),
    );
    ok(
      result.errors.some((e) => e.includes("DISTANCE")),
      `expected a DISTANCE error, got ${JSON.stringify(result.errors)}`,
    );
  });

  it("allows a time goal on that same indoor bike", () => {
    const result = precheck(
      spec({
        activity: "CYCLING",
        location: "indoor",
        blocks: [{ repeat: 4, work: { time: "5:00" } }],
      }),
    );
    deepStrictEqual(result.errors, []);
  });

  it("refuses a power target on a swim", () => {
    const result = precheck(
      spec({
        blocks: [{ repeat: 4, work: { distance: "100" }, alert: { kind: "power", watts: 200 } }],
      }),
    );
    ok(
      result.errors.some((e) => e.includes("POWER")),
      `expected a POWER error, got ${JSON.stringify(result.errors)}`,
    );
  });

  it("allows a heart-rate target on a swim", () => {
    const result = precheck(
      spec({
        blocks: [
          { repeat: 4, work: { distance: "100" }, alert: { kind: "heartRateZone", zone: 3 } },
        ],
      }),
    );
    deepStrictEqual(result.errors, []);
  });

  it("names the block that is wrong, not just the workout", () => {
    const result = precheck(
      spec({
        blocks: [
          { repeat: 4, work: { distance: "100" } },
          { repeat: 4, work: { distance: "100" }, alert: { kind: "power", watts: 200 } },
        ],
      }),
    );
    ok(
      result.errors.some((e) => e.includes("block 2")),
      JSON.stringify(result.errors),
    );
  });

  it("checks the warm up and the cool down too, not only the sets", () => {
    const warm = precheck(
      spec({ warmup: { distance: "400", alert: { kind: "power", watts: 200 } } }),
    );
    ok(
      warm.errors.some((e) => e.includes("warmup")),
      JSON.stringify(warm.errors),
    );

    const cool = precheck(
      spec({ cooldown: { distance: "200", alert: { kind: "power", watts: 200 } } }),
    );
    ok(
      cool.errors.some((e) => e.includes("cooldown")),
      JSON.stringify(cool.errors),
    );
  });

  it("rejects a location the sport is not offered in", () => {
    const result = precheck(spec({ activity: "SWIMMING", location: "indoor" }));
    ok(result.errors.length > 0, "the matrix offers pool swimming in one location only");
  });

  it("says so plainly when the activity is not one we know", () => {
    const result = precheck(spec({ activity: "QUIDDITCH" as WorkoutSpec["activity"] }));
    deepStrictEqual(result.errors, ["Unknown activity QUIDDITCH"]);
  });
});
