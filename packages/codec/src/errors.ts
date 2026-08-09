import type { UnknownFieldFinding } from "./unknown.js";

/**
 * Thrown when decoding produces fields the schema does not model.
 *
 * This is deliberately loud. `spec/FORMAT.md` §8 records that nine of the twenty
 * corpus files round-tripped byte-identically against a schema missing ten real
 * fields, because protobuf runtimes retain unrecognised fields and re-emit them
 * verbatim. Byte-identical round-tripping is therefore not evidence that a
 * schema is complete — only the absence of unknown fields is.
 */
export class UnknownFieldsError extends Error {
  override readonly name = "UnknownFieldsError";
  readonly findings: readonly UnknownFieldFinding[];

  constructor(findings: readonly UnknownFieldFinding[]) {
    const lines = findings.map(
      (f) =>
        `  ${f.path} (${f.typeName}): field ${f.fieldNumber}, ` +
        `wire type ${f.wireType} (${f.wireTypeName}), ${f.byteLength} bytes`,
    );
    super(
      `Decoded ${findings.length} unknown field${findings.length === 1 ? "" : "s"}. ` +
        `The schema in proto/ does not model everything in this file:\n${lines.join("\n")}\n` +
        `Capture this file as a new corpus entry rather than ignoring the gap.`,
    );
    this.findings = findings;
  }
}

/**
 * Thrown when a `WorkoutBinary` carries no container this library models.
 *
 * `spec/FORMAT.md` §1 and §9: fields 10 (`single_goal_workout`) and 11
 * (`custom_workout`) are mutually exclusive and are the only containers this
 * corpus has ever seen. WorkoutKit also defines pacer and swim-bike-run
 * workouts, which most likely occupy further sibling field numbers. Decoding
 * must branch on which field is present and fail clearly on anything else,
 * rather than assuming field 11.
 */
export class UnsupportedContainerError extends Error {
  override readonly name = "UnsupportedContainerError";
  /** Unknown top-level field numbers that could plausibly be a sibling container. */
  readonly candidateFieldNumbers: readonly number[];

  constructor(candidateFieldNumbers: readonly number[]) {
    const found =
      candidateFieldNumbers.length > 0
        ? `Found unmodelled length-delimited field${
            candidateFieldNumbers.length === 1 ? "" : "s"
          } ${candidateFieldNumbers.join(", ")} instead.`
        : `No container field is set at all.`;
    super(
      `WorkoutBinary contains no recognised workout container. ` +
        `Expected field 10 (single_goal_workout) or field 11 (custom_workout). ${found} ` +
        `Apple's WorkoutKit also defines pacer and swim-bike-run workouts, which ` +
        `spec/FORMAT.md §9 predicts occupy further sibling fields that this corpus ` +
        `has never seen. This file cannot be decoded until that container is modelled — ` +
        `it is worth capturing as a new corpus file.`,
    );
    this.candidateFieldNumbers = candidateFieldNumbers;
  }
}
