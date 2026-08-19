import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { decode } from "@dotworkout/codec";
import { readWorkoutLink, steps, workoutLink } from "@dotworkout/domain";
import { attachment, fileNameFor, toBase64 } from "../src/attach.js";
import { buildWorkout } from "../src/workout.js";

const spec = {
  activity: "SWIMMING" as const,
  name: "Pull & Sprint 2000",
  warmup: { distance: "400" },
  blocks: [{ repeat: 8, work: { distance: "50" }, sendOff: "1:00", label: "Build" }],
  cooldown: { distance: "200" },
};

describe("base64", () => {
  it("round-trips every byte value", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, at) => at);
    deepStrictEqual(new Uint8Array(Buffer.from(toBase64(bytes), "base64")), bytes);
  });

  it("round-trips at every length modulo three, where padding decides the tail", () => {
    for (let length = 0; length < 130; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, at) => (at * 31 + length) % 256);
      deepStrictEqual(
        new Uint8Array(Buffer.from(toBase64(bytes), "base64")),
        bytes,
        `length ${length}`,
      );
    }
  });

  it("is standard base64, not the url-safe kind the link uses", () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0xbf, 0x00]);
    const encoded = toBase64(bytes);
    strictEqual(/[+/]/.test(encoded), true, "expects + and / rather than - and _");
    strictEqual(encoded.endsWith("="), true, "expects padding");
  });
});

describe("the attached file", () => {
  const built = buildWorkout(spec);
  const bytes = built.toBytes({ skipValidation: true });
  const link = workoutLink(bytes, { origin: "https://example.dev", title: spec.name });

  /**
   * The point of attaching the bytes at all: a model asked to turn the link's
   * payload into a file once lost a byte off the end, which the Watch refused.
   */
  it("carries bytes that decode to the same workout, unaltered", () => {
    const sent = attachment(bytes, spec.name, link);
    const back = new Uint8Array(Buffer.from(sent.resource.blob, "base64"));

    deepStrictEqual(back, bytes, "byte for byte");
    const workout = decode(back);
    strictEqual(workout.customWorkout?.displayName, "Pull & Sprint 2000");
    strictEqual(steps(workout.customWorkout!).length, 3);
  });

  it("agrees with the link it is sent beside", () => {
    const sent = attachment(bytes, spec.name, link);
    const fromLink = readWorkoutLink(link.slice(link.indexOf("#")));
    deepStrictEqual(new Uint8Array(Buffer.from(sent.resource.blob, "base64")), fromLink?.bytes);
  });

  it("says it is bytes, and points at the link that also opens it", () => {
    const sent = attachment(bytes, spec.name, link);
    strictEqual(sent.type, "resource");
    strictEqual(sent.resource.mimeType, "application/octet-stream");
    strictEqual(sent.resource.uri, link);
  });
});

describe("file names", () => {
  it("matches what the composer saves the same workout as", () => {
    strictEqual(fileNameFor("Pull & Sprint 2000"), "pull-sprint-2000.workout");
    strictEqual(fileNameFor("Thursday threshold"), "thursday-threshold.workout");
  });

  it("survives accents and punctuation", () => {
    strictEqual(fileNameFor("Natación en piscina"), "natacion-en-piscina.workout");
    strictEqual(fileNameFor("8×50 @ 1:00"), "8-50-1-00.workout");
  });

  it("falls back rather than producing a nameless file", () => {
    strictEqual(fileNameFor(""), "workout.workout");
    strictEqual(fileNameFor("—"), "workout.workout");
  });
});
