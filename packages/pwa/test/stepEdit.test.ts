import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import { capabilitiesOf, findActivity } from "../src/domain/activity.js";
import type { BlockDraft } from "../src/domain/block.js";
import {
  FieldError,
  changeGoal,
  changeKind,
  durationText,
  numberText,
  rangeEnds,
  readCount,
  readDistance,
  readDuration,
  readTarget,
  targetText,
  withBound,
  withReading,
  withTarget,
  withValue,
} from "../src/application/stepEdit.js";

const running = findActivity("RUNNING");
const runningCapabilities = capabilitiesOf(running);

const set: BlockDraft = {
  kind: "INTERVAL",
  goalKind: "DISTANCE",
  distance: { value: 400, unit: "m" },
  repetitions: 8,
  recovery: { value: 90, unit: "s" },
  alertMetric: "HEART_RATE",
  alert: { metric: "HEART_RATE", style: "ZONE", zone: 4 },
  label: "Tempo",
};

/**
 * The interview showed a stored distance as its bare number and read it back
 * in the sport's default unit, so reopening a 400 m run step and pressing
 * Enter turned it into 400 km. A field and its unit now travel separately.
 */
describe("a value reads back as it was typed", () => {
  it("keeps the unit that was typed, whatever the sport counts in", () => {
    deepStrictEqual(readDistance("400m", "km"), { value: 400, unit: "m" });
  });

  it("round-trips a distance through its field and unit picker", () => {
    const distance = { value: 400, unit: "m" as const };
    deepStrictEqual(readDistance(numberText(distance.value), distance.unit), distance);
  });

  it("accepts a decimal comma", () => {
    deepStrictEqual(readDistance("1,5", "km"), { value: 1.5, unit: "km" });
  });

  it("writes a time as a clock, and reads the clock back to the same time", () => {
    const rest = readDuration("90");
    strictEqual(durationText(rest), "1:30");
    strictEqual(durationText(readDuration(durationText(rest))), "1:30");
  });

  it("writes an hour-long step with hours", () => {
    strictEqual(durationText({ value: 75, unit: "min" }), "1:15:00");
  });

  it("round-trips a running pace instead of exposing metres per second", () => {
    const pace = readTarget("SPEED", "5:00", "RUNNING");
    strictEqual(targetText("SPEED", pace, "RUNNING"), "5:00");
  });

  it("round-trips a cycling speed in km/h", () => {
    const speed = readTarget("SPEED", "32.5", "CYCLING");
    strictEqual(targetText("SPEED", speed, "CYCLING"), "32.5");
  });
});

describe("a field refuses what it cannot take, naming what it wants", () => {
  const key = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return error instanceof FieldError ? error.key : "not a FieldError";
    }
    return "no error";
  };

  it("refuses a distance that is not a number", () => {
    strictEqual(
      key(() => readDistance("far", "m")),
      "field.error.distance",
    );
  });

  it("refuses a time of nothing", () => {
    strictEqual(
      key(() => readDuration("0:00")),
      "field.error.duration",
    );
  });

  it("refuses a fraction of a repetition", () => {
    strictEqual(
      key(() => readCount("2.5")),
      "field.error.count",
    );
  });

  it("refuses a pace that is not a clock", () => {
    throws(() => readTarget("SPEED", "fast", "RUNNING"), FieldError);
  });
});

describe("changing the goal keeps what still applies", () => {
  it("keeps the distance between a distance goal and a send-off", () => {
    const sendOff = changeGoal(set, "DISTANCE_TIME");
    deepStrictEqual(sendOff.distance, set.distance);
    deepStrictEqual(changeGoal(sendOff, "DISTANCE").distance, set.distance);
  });

  it("drops the distance for a time goal and keeps everything else", () => {
    const timed = changeGoal(set, "TIME");
    strictEqual(timed.distance, undefined);
    strictEqual(timed.repetitions, 8);
    deepStrictEqual(timed.recovery, set.recovery);
    deepStrictEqual(timed.alert, set.alert);
    strictEqual(timed.label, "Tempo");
  });

  it("drops the send-off when leaving the send-off goal", () => {
    const sendOff = {
      ...changeGoal(set, "DISTANCE_TIME"),
      sendOff: { value: 60, unit: "s" as const },
    };
    strictEqual(changeGoal(sendOff, "DISTANCE").sendOff, undefined);
  });

  it("is a no-op for the goal already chosen", () => {
    strictEqual(changeGoal(set, "DISTANCE"), set);
  });
});

describe("changing the kind keeps what still applies", () => {
  it("keeps the measurement, target and name when a set becomes a warm up", () => {
    const warmup = changeKind(set, "WARMUP", runningCapabilities);
    deepStrictEqual(warmup.distance, set.distance);
    deepStrictEqual(warmup.alert, set.alert);
    strictEqual(warmup.label, "Tempo");
    strictEqual(warmup.repetitions, undefined);
    strictEqual(warmup.recovery, undefined);
  });

  it("keeps only the time and name when a timed step becomes a rest", () => {
    const timed = { ...changeGoal(set, "TIME"), duration: { value: 120, unit: "s" as const } };
    deepStrictEqual(changeKind(timed, "RECOVERY", runningCapabilities), {
      kind: "RECOVERY",
      duration: { value: 120, unit: "s" },
      label: "Tempo",
    });
  });

  it("turns a rest into a timed step that keeps its time", () => {
    const rest: BlockDraft = { kind: "RECOVERY", duration: { value: 60, unit: "s" } };
    const step = changeKind(rest, "INTERVAL", runningCapabilities);
    strictEqual(step.goalKind, "TIME");
    deepStrictEqual(step.duration, rest.duration);
  });
});

describe("targets", () => {
  it("picks a reading and a style straight away, so the value field shows", () => {
    const paced = withTarget(set, "SPEED");
    strictEqual(paced.alertReading, "current");
    strictEqual(paced.alert, undefined);
  });

  it("keeps the value when the reading changes", () => {
    const paced = withValue(withTarget(set, "SPEED"), 3.5);
    const averaged = withReading(paced, "average");
    deepStrictEqual(averaged.alert, {
      metric: "SPEED",
      style: "VALUE",
      metersPerSecond: 3.5,
      reading: "average",
    });
  });

  it("builds a range once both ends are in, low to high whichever came first", () => {
    const base = { ...withTarget(set, "HEART_RATE"), alertStyle: "RANGE" as const };
    const half = withBound(base, "to", 150);
    strictEqual(half.alert, undefined);
    deepStrictEqual(withBound(half, "from", 165).alert, {
      metric: "HEART_RATE",
      style: "RANGE",
      from: 150,
      to: 165,
    });
  });

  it("reads both ends back from a range saved before the second end was stored", () => {
    const saved: BlockDraft = {
      ...set,
      alertStyle: "RANGE",
      alertFrom: 160,
      alert: { metric: "HEART_RATE", style: "RANGE", from: 140, to: 160 },
    };
    deepStrictEqual(rangeEnds(saved), { from: 160, to: 140 });
  });

  it("clears every target field when the target is removed", () => {
    const none = withTarget(set, "NONE");
    strictEqual(none.alertMetric, "NONE");
    strictEqual(none.alert, undefined);
  });
});
