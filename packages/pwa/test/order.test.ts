import { deepStrictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import type { BlockDraft } from "../src/domain/block.js";
import { inPerformedOrder, isPinned, moved } from "../src/domain/order.js";

const warmup: BlockDraft = { kind: "WARMUP", label: "W" };
const cooldown: BlockDraft = { kind: "COOLDOWN", label: "C" };
const a: BlockDraft = { kind: "INTERVAL", label: "A" };
const b: BlockDraft = { kind: "INTERVAL", label: "B" };
const c: BlockDraft = { kind: "INTERVAL", label: "C1" };

const labels = (blocks: readonly BlockDraft[]) => blocks.map((block) => block.label);

describe("what can be moved", () => {
  it("pins the warm up and the cool down", () => {
    deepStrictEqual(isPinned(warmup), true);
    deepStrictEqual(isPinned(cooldown), true);
    deepStrictEqual(isPinned(a), false);
  });

  it("treats a block that is not there as pinned, so the ends stay put", () => {
    deepStrictEqual(isPinned(undefined), true);
  });
});

describe("performed order", () => {
  it("puts the warm up first and the cool down last", () => {
    deepStrictEqual(labels(inPerformedOrder([cooldown, a, warmup, b])), ["W", "A", "B", "C"]);
  });

  it("leaves the sets in the order they were given", () => {
    deepStrictEqual(labels(inPerformedOrder([b, c, a])), ["B", "C1", "A"]);
  });
});

describe("moving a block", () => {
  const full = [warmup, a, b, c, cooldown];

  it("drops a set onto a later slot and pushes the rest up", () => {
    deepStrictEqual(labels(moved(full, 1, 3)), ["W", "B", "C1", "A", "C"]);
  });

  it("drops a set onto an earlier slot and pushes the rest down", () => {
    deepStrictEqual(labels(moved(full, 3, 1)), ["W", "C1", "A", "B", "C"]);
  });

  it("reaches the last set, which an off-by-one would make unreachable", () => {
    deepStrictEqual(labels(moved([warmup, a, b], 1, 2)), ["W", "B", "A"]);
  });

  it("round-trips", () => {
    deepStrictEqual(labels(moved(moved(full, 1, 3), 3, 1)), labels(full));
  });

  it("parks a set beside the warm up rather than above it", () => {
    deepStrictEqual(labels(moved(full, 2, 0)), ["W", "B", "A", "C1", "C"]);
  });

  it("parks a set beside the cool down rather than below it", () => {
    deepStrictEqual(labels(moved(full, 1, 4)), ["W", "B", "C1", "A", "C"]);
  });

  it("does nothing when a block is dropped on itself", () => {
    deepStrictEqual(labels(moved(full, 2, 2)), labels(full));
  });

  it("does nothing when the index is not there", () => {
    deepStrictEqual(labels(moved(full, 9, 0)), labels(full));
  });

  it("never loses or gains a block", () => {
    for (let from = 0; from < full.length; from += 1) {
      for (let to = 0; to < full.length; to += 1) {
        deepStrictEqual(moved(full, from, to).length, full.length, `${from} to ${to}`);
      }
    }
  });

  it("keeps the warm up first and the cool down last, whatever the drop", () => {
    for (let from = 0; from < full.length; from += 1) {
      for (let to = 0; to < full.length; to += 1) {
        const result = moved(full, from, to);
        deepStrictEqual(result[0]?.kind, "WARMUP", `${from} to ${to}`);
        deepStrictEqual(result[result.length - 1]?.kind, "COOLDOWN", `${from} to ${to}`);
      }
    }
  });
});
