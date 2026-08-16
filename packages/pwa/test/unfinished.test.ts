import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { decode, encode } from "@dotworkout/codec";
import { capabilitiesOf, findActivity } from "../src/domain/activity.js";
import type { BlockDraft } from "../src/domain/block.js";
import { unfinishedBlocks } from "../src/domain/interview.js";
import { compose } from "../src/application/workoutComposition.js";

const swimming = findActivity("SWIMMING");
const capabilities = capabilitiesOf(swimming);

const unfinished = (blocks: readonly BlockDraft[]) =>
  unfinishedBlocks(blocks, swimming, capabilities).map((entry) => [entry.index, entry.question.id]);

const sendOffSet: BlockDraft = {
  kind: "INTERVAL",
  goalKind: "DISTANCE_TIME",
  distance: { value: 50, unit: "m" },
  sendOff: { value: 60, unit: "s" },
  repetitions: 8,
};

/**
 * A set that asks for a send-off and never gets one composes to a plain
 * distance goal. The Watch accepts that and runs it, so nothing downstream can
 * tell the author they did not get the workout they asked for.
 */
describe("a send-off with no time is caught before it is saved", () => {
  it("composes to a distance goal, silently, which is the whole problem", () => {
    const { sendOff, ...withoutSendOff } = sendOffSet;
    strictEqual(sendOff?.value, 60, "the fixture really does carry one");

    const workout = decode(
      encode(compose({ title: "probe", activity: swimming, blocks: [withoutSendOff] })),
    );
    const goal =
      workout.customWorkout?.intervalBlocks[0]?.intervalSteps[0]?.workoutStep?.workoutGoal;
    strictEqual(goal?.goalType, 3, "a distance goal, not the send-off that was asked for");
  });

  it("is reported as unfinished, naming the question that is missing", () => {
    const { sendOff, ...withoutSendOff } = sendOffSet;
    strictEqual(sendOff?.value, 60, "the fixture really does carry one");
    deepStrictEqual(unfinished([withoutSendOff]), [[0, "sendOff"]]);
  });

  it("is not reported once the send-off is there", () => {
    deepStrictEqual(unfinished([sendOffSet]), []);
    const workout = decode(
      encode(compose({ title: "probe", activity: swimming, blocks: [sendOffSet] })),
    );
    const goal =
      workout.customWorkout?.intervalBlocks[0]?.intervalSteps[0]?.workoutStep?.workoutGoal;
    strictEqual(goal?.goalType, 5, "DISTANCE_TIME");
  });
});

describe("unfinished blocks in general", () => {
  it("says nothing about a workout that is complete", () => {
    deepStrictEqual(
      unfinished([
        { kind: "WARMUP", goalKind: "DISTANCE", distance: { value: 400, unit: "m" } },
        sendOffSet,
        { kind: "COOLDOWN", goalKind: "DISTANCE", distance: { value: 200, unit: "m" } },
      ]),
      [],
    );
  });

  it("catches a goal with no measurement", () => {
    deepStrictEqual(unfinished([{ kind: "INTERVAL", goalKind: "DISTANCE", repetitions: 4 }]), [
      [0, "distance"],
    ]);
  });

  it("catches a block with no goal at all", () => {
    deepStrictEqual(unfinished([{ kind: "INTERVAL" }]), [[0, "goal"]]);
  });

  it("reports every unfinished block, at its own index", () => {
    deepStrictEqual(
      unfinished([
        { kind: "WARMUP", goalKind: "DISTANCE", distance: { value: 400, unit: "m" } },
        { kind: "INTERVAL", goalKind: "DISTANCE", repetitions: 4 },
        sendOffSet,
        { kind: "INTERVAL" },
      ]),
      [
        [1, "distance"],
        [3, "goal"],
      ],
    );
  });

  it("does not mind an optional question going unanswered", () => {
    deepStrictEqual(unfinished([{ ...sendOffSet, recovery: undefined, label: undefined }]), []);
  });

  it("treats a skipped question as answered, because the author said so", () => {
    const skipped: BlockDraft = {
      kind: "INTERVAL",
      goalKind: "DISTANCE",
      repetitions: 4,
      skipped: ["distance"],
    };
    deepStrictEqual(unfinished([skipped]), []);
  });
});
