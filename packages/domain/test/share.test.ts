import { deepStrictEqual, strictEqual, throws } from "node:assert/strict";
import { describe, it } from "node:test";
import { decode } from "@dotworkout/codec";
import { fromBase64Url, readWorkoutLink, swim, toBase64Url, workoutLink } from "../src/index.js";
import { corpusNames, workoutBytes } from "./corpus.js";

describe("base64url", () => {
  it("survives every byte value, at every length modulo three", () => {
    for (let length = 0; length < 260; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, at) => (at * 7 + length) % 256);
      deepStrictEqual(fromBase64Url(toBase64Url(bytes)), bytes, `length ${length}`);
    }
  });

  it("is url-safe: no padding, no plus, no slash", () => {
    for (const name of corpusNames()) {
      const encoded = toBase64Url(workoutBytes(name));
      strictEqual(/^[A-Za-z0-9\-_]*$/.test(encoded), true, name);
    }
  });

  it("refuses input that is not base64url", () => {
    throws(() => fromBase64Url("not base64!"), /unexpected character/);
  });
});

describe("share links", () => {
  const bytes = swim("Thursday threshold").warmup(400).repeat(8).of(50).toBytes();

  it("carries a real workout there and back", () => {
    const link = workoutLink(bytes, { origin: "https://example.com", title: "Thursday threshold" });
    const inbound = readWorkoutLink(link.slice(link.indexOf("#")));

    deepStrictEqual(inbound?.bytes, bytes);
    strictEqual(inbound?.title, "Thursday threshold");
    strictEqual(decode(inbound.bytes).customWorkout?.displayName, "Thursday threshold");
  });

  it("round-trips every file in the corpus", () => {
    for (const name of corpusNames()) {
      const original = workoutBytes(name);
      const link = workoutLink(original, { origin: "https://example.com", title: name });
      deepStrictEqual(readWorkoutLink(link.slice(link.indexOf("#")))?.bytes, original, name);
    }
  });

  it("keeps a title that would otherwise break the fragment", () => {
    const link = workoutLink(bytes, { origin: "https://example.com", title: "8×50 #hard & fast" });
    strictEqual(readWorkoutLink(link.slice(link.indexOf("#")))?.title, "8×50 #hard & fast");
  });

  it("puts the payload in the fragment, so it never reaches a server", () => {
    const link = workoutLink(bytes, { origin: "https://example.com" });
    strictEqual(link.slice(0, link.indexOf("#")), "https://example.com/");
  });

  it("does not double the slash when the origin has one", () => {
    const link = workoutLink(bytes, { origin: "https://example.com/" });
    strictEqual(link.startsWith("https://example.com/#w="), true);
  });

  it("keeps a subpath the app is served under", () => {
    const link = workoutLink(bytes, { origin: "https://example.com/app/" });
    strictEqual(link.startsWith("https://example.com/app/#w="), true);
  });

  it("returns nothing for a fragment that is not a workout", () => {
    strictEqual(readWorkoutLink(""), undefined);
    strictEqual(readWorkoutLink("#section"), undefined);
    strictEqual(readWorkoutLink("#w=not base64!"), undefined);
  });
});
