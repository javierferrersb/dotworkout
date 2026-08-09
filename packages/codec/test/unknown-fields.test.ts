/**
 * Negative controls for conformance assertion 3.
 *
 * Each case here re-creates one of the ten corrections listed in
 * `spec/FORMAT.md` §8 by deleting the field from the schema at runtime, then
 * asserts both halves of the claim that motivates the whole suite:
 *
 *   - assertion 2 (byte-identical round-trip) STILL PASSES against the broken
 *     schema, because protobuf retains and re-emits what it does not recognise;
 *   - assertion 3 (zero unknown fields) CATCHES it.
 *
 * If a case here ever stops failing on the broken schema, the unknown-field
 * walker has gone blind and the conformance suite is no longer load-bearing.
 */

import { deepStrictEqual, notDeepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import { fromBinary, toBinary } from "@bufbuild/protobuf";
import {
  decode,
  findUnknownFields,
  readContainer,
  UnknownFieldsError,
  UnsupportedContainerError,
  WorkoutBinarySchema,
  type WorkoutBinary,
} from "../src/index.js";
import { findEntry, readWorkoutBytes } from "./corpus.js";
import { mutatedWorkoutBinary } from "./schema-mutation.js";

interface RegressionCase {
  /** Correction number from spec §8. */
  readonly correction: number;
  readonly what: string;
  readonly message: string;
  readonly fieldNumber: number;
  /** A corpus file that exercises the field. */
  readonly file: string;
  /** Where the walker should report the loss. */
  readonly expectedPath: string;
}

const CASES: readonly RegressionCase[] = [
  {
    correction: 3,
    what: "WorkoutGoal.energy_goal",
    message: "WorkoutGoal",
    fieldNumber: 3,
    file: "360_cal_cycling",
    expectedPath: "$.single_goal_workout.goal",
  },
  {
    correction: 5,
    what: "WorkoutGoal.distance_time_goal",
    message: "WorkoutGoal",
    fieldNumber: 5,
    file: "Swim_DistTime",
    expectedPath: "$.custom_workout.interval_blocks[0].interval_steps[0].workout_step.workout_goal",
  },
  {
    correction: 6,
    what: "HeartRateRangeAlert.heart_rate_zone",
    message: "HeartRateRangeAlert",
    fieldNumber: 1,
    file: "Swim_HR",
    expectedPath:
      "$.custom_workout.interval_blocks[0].interval_steps[0].workout_step.workout_alert.heart_rate_range_alert",
  },
  {
    correction: 7,
    what: "SpeedAlert.speed_target",
    message: "SpeedAlert",
    fieldNumber: 1,
    file: "Probe_Alerts_Zones",
    expectedPath:
      "$.custom_workout.interval_blocks[0].interval_steps[0].workout_step.workout_alert.speed_alert",
  },
  {
    correction: 8,
    what: "CadenceAlert.cadence_target",
    message: "CadenceAlert",
    fieldNumber: 1,
    file: "Run_Cadence",
    expectedPath:
      "$.custom_workout.interval_blocks[1].interval_steps[0].workout_step.workout_alert.cadence_alert",
  },
  {
    correction: 9,
    what: "PowerAlert.power_target",
    message: "PowerAlert",
    fieldNumber: 1,
    file: "Run_Power",
    expectedPath:
      "$.custom_workout.interval_blocks[2].interval_steps[0].workout_step.workout_alert.power_alert",
  },
];

describe("assertion 3 has teeth", () => {
  for (const testCase of CASES) {
    describe(`§8 correction ${testCase.correction}: ${testCase.what}`, () => {
      const bytes = readWorkoutBytes(findEntry(testCase.file));
      const broken = mutatedWorkoutBinary({
        op: "removeField",
        message: testCase.message,
        fieldNumber: testCase.fieldNumber,
      });

      it("still round-trips byte-identically against the broken schema", () => {
        // This is the trap. A conformance suite asserting only decode/encode
        // fidelity reports this file as green while the field is silently lost.
        const decoded = fromBinary(broken, bytes);
        deepStrictEqual(
          Buffer.from(toBinary(broken, decoded)).toString("hex"),
          Buffer.from(bytes).toString("hex"),
        );
      });

      it("loses the field from the decoded content", () => {
        // Proof that the round-trip above is hiding real data loss, rather than
        // the mutation being a no-op for this file.
        const viaBroken = fromBinary(broken, bytes);
        const viaReal = fromBinary(WorkoutBinarySchema, bytes);
        notDeepStrictEqual(stripUnknown(viaBroken), stripUnknown(viaReal));
      });

      it("is caught by the unknown-field walker, at the right path", () => {
        const decoded = fromBinary(broken, bytes);
        const findings = findUnknownFields(broken, decoded);
        strictEqual(
          findings.length >= 1,
          true,
          "expected the removed field to surface as unknown",
        );
        deepStrictEqual(
          findings.map((f) => f.path).includes(testCase.expectedPath),
          true,
          `expected a finding at ${testCase.expectedPath}, got: ${findings
            .map((f) => `${f.path}#${f.fieldNumber}`)
            .join(", ")}`,
        );
        for (const finding of findings) {
          strictEqual(finding.fieldNumber, testCase.fieldNumber);
        }
      });

      it("is caught by the real schema's strict decode too, when the field is absent", () => {
        // Sanity check in the other direction: with the correct schema, the
        // same bytes produce no findings at all.
        deepStrictEqual(findUnknownFields(WorkoutBinarySchema, decode(bytes)), []);
      });
    });
  }

  it("reports every unknown field in one throw, not just the first", () => {
    const bytes = readWorkoutBytes(findEntry("Run_Power"));
    const broken = mutatedWorkoutBinary(
      { op: "removeField", message: "PowerAlert", fieldNumber: 1 },
      { op: "removeField", message: "PowerAlert", fieldNumber: 2 },
    );
    const findings = findUnknownFields(broken, fromBinary(broken, bytes));
    // Run_Power has two range blocks and one single-target block.
    strictEqual(findings.length, 3);
  });

  it("walks into repeated elements, not just the first one", () => {
    // PoolSwim_2 has five blocks, each with a TIME recovery step. Removing
    // time_goal must surface a finding under every block index, proving the
    // walker indexes through repeated fields rather than stopping at [0].
    const bytes = readWorkoutBytes(findEntry("PoolSwim_2"));
    const broken = mutatedWorkoutBinary({
      op: "removeField",
      message: "WorkoutGoal",
      fieldNumber: 2,
    });
    const findings = findUnknownFields(broken, fromBinary(broken, bytes));
    const blockIndices = new Set(
      findings
        .map((f) => /interval_blocks\[(\d+)\]/.exec(f.path)?.[1])
        .filter((i): i is string => i !== undefined),
    );
    deepStrictEqual([...blockIndices].sort(), ["0", "1", "2", "3", "4"]);
  });

  it("walks into warmup and cooldown, not only into blocks", () => {
    // Probe_Time keeps its warm up in MINUTES and its cool down in SECONDS.
    // Both sit outside interval_blocks entirely.
    const bytes = readWorkoutBytes(findEntry("Probe_Time"));
    const broken = mutatedWorkoutBinary({
      op: "removeField",
      message: "WorkoutGoal",
      fieldNumber: 2,
    });
    const paths = findUnknownFields(broken, fromBinary(broken, bytes)).map((f) => f.path);
    strictEqual(paths.includes("$.custom_workout.warmup.workout_goal"), true, paths.join(", "));
    strictEqual(paths.includes("$.custom_workout.cooldown.workout_goal"), true, paths.join(", "));
  });

  it("throws UnknownFieldsError from the default decode path", () => {
    // The public API must not need opting in to the check.
    const bytes = withUnmodelledField(readWorkoutBytes(findEntry("Swim_DistTime")));
    throws(() => decode(bytes), UnknownFieldsError);
    const error = captureError(() => decode(bytes));
    strictEqual(error instanceof UnknownFieldsError, true);
    strictEqual((error as UnknownFieldsError).findings.length > 0, true);
  });
});

describe("container branching", () => {
  it("resolves field 11 as a custom workout", () => {
    const { container } = { container: readContainer(decode(readWorkoutBytes(findEntry("PoolSwim_2")))) };
    strictEqual(container.kind, "custom");
    strictEqual(container.fieldNumber, 11);
  });

  it("resolves field 10 as a single-goal workout", () => {
    // The one corpus file that is not a custom workout. Assuming field 11 here
    // would silently report an empty workout instead of a 360 kcal ride.
    const container = readContainer(decode(readWorkoutBytes(findEntry("360_cal_cycling"))));
    strictEqual(container.kind, "singleGoal");
    strictEqual(container.fieldNumber, 10);
  });

  it("fails with a clear message on an unrecognised sibling container", () => {
    // Synthesise the pacer / swim-bike-run case spec §9 predicts: the same
    // payload moved to a container field number we do not model.
    const relocated = mutatedWorkoutBinary({
      op: "renumberField",
      message: "WorkoutBinary",
      fieldNumber: 10,
      to: 12,
    });
    // Read with the real schema so the container is actually populated, then
    // write with the relocated one so it lands on field 12. Reading with the
    // relocated schema instead would park field 10 in $unknown and re-emit it
    // untouched, producing identical bytes and testing nothing.
    const source = decode(readWorkoutBytes(findEntry("360_cal_cycling")));
    const bytes = toBinary(relocated, source);

    const binary = decode(bytes, { allowUnknownFields: true });
    const error = captureError(() => readContainer(binary));
    strictEqual(error instanceof UnsupportedContainerError, true);
    deepStrictEqual((error as UnsupportedContainerError).candidateFieldNumbers, [12]);
    strictEqual(
      (error as Error).message.includes("pacer and swim-bike-run"),
      true,
      "the error should point at the open question in spec §9",
    );
  });

  it("does not mistake version/format for a container candidate", () => {
    // Fields 1000 and 1002 are varints far above the container range; a naive
    // "any unknown field" heuristic would name them as suspects.
    const relocated = mutatedWorkoutBinary({
      op: "renumberField",
      message: "WorkoutBinary",
      fieldNumber: 11,
      to: 12,
    });
    const source = decode(readWorkoutBytes(findEntry("Minimal")));
    const binary = decode(toBinary(relocated, source), { allowUnknownFields: true });
    const error = captureError(() => readContainer(binary)) as UnsupportedContainerError;
    deepStrictEqual(error.candidateFieldNumbers, [12]);
  });
});

/**
 * Append a top-level field the schema does not model, standing in for whatever
 * Apple adds next. Field 99 is unused in every corpus file.
 */
function withUnmodelledField(bytes: Uint8Array): Uint8Array {
  // Tag byte: field number 99, wire type 2 (length-delimited), then a 3-byte
  // payload. 99 << 3 exceeds one varint byte, so the tag is encoded manually.
  const tag = (99 << 3) | 2;
  const extra = new Uint8Array([(tag & 0x7f) | 0x80, tag >>> 7, 3, 1, 2, 3]);
  const out = new Uint8Array(bytes.length + extra.length);
  out.set(bytes, 0);
  out.set(extra, bytes.length);
  return out;
}

function stripUnknown(message: WorkoutBinary | ReturnType<typeof fromBinary>): unknown {
  return JSON.parse(
    JSON.stringify(message, (key, value) => (key === "$unknown" ? undefined : value)),
  );
}

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}
