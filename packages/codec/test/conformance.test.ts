/**
 * Conformance suite over the 20 real `.workout` exports in `testdata/`.
 *
 * Every file must satisfy all three assertions from `testdata/README.md`:
 *
 *   1. decode(bytes) deep-equals the paired .json
 *   2. encode(decode(bytes)) is byte-identical to the original
 *   3. decoding yields ZERO unknown fields
 *
 * Assertion 3 carries the weight. Nine of these files pass 1 and 2 against a
 * schema missing ten real fields, because protobuf runtimes retain and re-emit
 * unrecognised fields verbatim (spec §8). Round-trip fidelity is not evidence
 * of a complete schema. Do not weaken or skip this assertion — if it ever fails,
 * the schema is wrong, not the test.
 */

import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decode,
  encode,
  findUnknownFields,
  toJsonObject,
  WorkoutBinarySchema,
} from "../src/index.js";
import { corpus, readWorkoutBytes, readExpectedJson } from "./corpus.js";

describe("conformance corpus", () => {
  it("covers all 20 files documented in testdata/README.md", () => {
    strictEqual(corpus.length, 20);
  });

  for (const entry of corpus) {
    describe(entry.name, () => {
      const bytes = readWorkoutBytes(entry);

      it("1. decodes to the expected JSON", () => {
        // Decoded permissively so this assertion reports a *content* mismatch
        // rather than being pre-empted by assertion 3's error.
        const binary = decode(bytes, { allowUnknownFields: true });
        deepStrictEqual(toJsonObject(binary), readExpectedJson(entry));
      });

      it("2. re-encodes byte-identically", () => {
        const binary = decode(bytes, { allowUnknownFields: true });
        const reencoded = encode(binary);
        deepStrictEqual(Buffer.from(reencoded).toString("hex"), Buffer.from(bytes).toString("hex"));
      });

      it("3. decodes with zero unknown fields", () => {
        const binary = decode(bytes, { allowUnknownFields: true });
        const findings = findUnknownFields(WorkoutBinarySchema, binary);
        deepStrictEqual(
          findings,
          [],
          findings.length === 0
            ? ""
            : `Schema gap: ${findings.length} unknown field(s) retained.\n` +
                findings
                  .map(
                    (f) =>
                      `  ${f.path} (${f.typeName}) field ${f.fieldNumber} ` +
                      `[${f.wireTypeName}, ${f.byteLength} bytes]`,
                  )
                  .join("\n"),
        );
      });

      it("strict decode() accepts the file without opting out of the unknown-field check", () => {
        // The three assertions above decode permissively so their failures stay
        // readable. This one proves the shipped default path — which throws on
        // any unknown field — handles the real corpus.
        const binary = decode(bytes);
        ok(binary.GUID.length > 0, "expected a GUID");
      });
    });
  }
});
