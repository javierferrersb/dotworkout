/**
 * `@dotworkout/codec` — decoder/encoder for the Apple `.workout` binary format.
 *
 * This layer is deliberately thin and deliberately literal. It models the wire
 * format described in `spec/FORMAT.md` and nothing more: no unit conversion, no
 * sport/goal validation, no opinion about what a sensible workout looks like.
 * Those belong in `@dotworkout/domain`, so the codec stays usable on its own.
 *
 * The format is plain protobuf — no header, magic bytes, compression, or
 * framing (spec §1).
 */

import { fromBinary, fromJson, toBinary, toJson } from "@bufbuild/protobuf";
import type { JsonValue } from "@bufbuild/protobuf";
import { WorkoutBinarySchema, type WorkoutBinary } from "./schema.js";
import { assertNoUnknownFields, findUnknownFields } from "./unknown.js";
import { readContainer, type WorkoutContainer } from "./container.js";

export * from "./schema.js";
export { UnknownFieldsError, UnsupportedContainerError } from "./errors.js";
export { findUnknownFields, assertNoUnknownFields, type UnknownFieldFinding } from "./unknown.js";
export {
  readContainer,
  candidateContainerFields,
  CUSTOM_WORKOUT_FIELD,
  SINGLE_GOAL_WORKOUT_FIELD,
  type WorkoutContainer,
} from "./container.js";

export interface DecodeOptions {
  /**
   * Retain unrecognised fields instead of throwing.
   *
   * Off by default, and that default is the point. A permissive decode is how
   * ten real schema gaps stayed invisible in the upstream library for as long
   * as they did (spec §8). Turn this on only to *inspect* a file that fails —
   * pair it with {@link findUnknownFields} to see what was missed.
   */
  allowUnknownFields?: boolean;
}

/**
 * Decode a `.workout` file into its raw `WorkoutBinary` message.
 *
 * @throws {UnknownFieldsError} unless `allowUnknownFields` is set.
 */
export function decode(bytes: Uint8Array, options: DecodeOptions = {}): WorkoutBinary {
  const binary = fromBinary(WorkoutBinarySchema, bytes);
  if (options.allowUnknownFields !== true) {
    assertNoUnknownFields(WorkoutBinarySchema, binary);
  }
  return binary;
}

/** Encode a `WorkoutBinary` back to `.workout` bytes. */
export function encode(binary: WorkoutBinary): Uint8Array {
  return toBinary(WorkoutBinarySchema, binary);
}

/** A decoded file together with the container it turned out to hold. */
export interface DecodedWorkout {
  readonly binary: WorkoutBinary;
  readonly container: WorkoutContainer;
}

/**
 * Decode and resolve the container in one step.
 *
 * @throws {UnknownFieldsError} unless `allowUnknownFields` is set.
 * @throws {UnsupportedContainerError} if the file holds neither field 10 nor
 *   field 11 — most likely a pacer or swim-bike-run workout (spec §9).
 */
export function decodeWorkout(bytes: Uint8Array, options: DecodeOptions = {}): DecodedWorkout {
  const binary = decode(bytes, options);
  return { binary, container: readContainer(binary) };
}

/**
 * Convert to the protobuf JSON mapping used by `testdata/*.json`: original
 * proto field names, enum values as names.
 *
 * `useProtoFieldName` is what makes the output `"activity_type"` rather than
 * protobuf JSON's default `"activityType"`, matching the corpus fixtures.
 */
export function toJsonObject(binary: WorkoutBinary): JsonValue {
  return toJson(WorkoutBinarySchema, binary, { useProtoFieldName: true });
}

/** Inverse of {@link toJsonObject}. Accepts both proto and lowerCamelCase names. */
export function fromJsonObject(json: JsonValue): WorkoutBinary {
  return fromJson(WorkoutBinarySchema, json);
}
