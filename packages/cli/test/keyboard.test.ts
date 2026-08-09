/**
 * The keyboard layer.
 *
 * The shortcuts are the product here, so they get real tests. Both modules are
 * pure functions of their input, which is the reason the composer was split
 * this way — none of this needs a terminal.
 */

import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeKeys, type Key } from "../src/tui/keys.js";
import { apply, initialState, type EditorState } from "../src/tui/editor.js";

const ESC = "\u001b";

function names(chunk: string): string[] {
  return decodeKeys(chunk).map((k) => k.name);
}

describe("decodeKeys", () => {
  it("decodes plain characters", () => {
    deepStrictEqual(
      decodeKeys("8x50").map((k) => k.value),
      ["8", "x", "5", "0"],
    );
  });

  it("decodes arrows in both encodings terminals use", () => {
    deepStrictEqual(names(`${ESC}[A${ESC}[B${ESC}[C${ESC}[D`), ["up", "down", "right", "left"]);
    deepStrictEqual(names(`${ESC}OA${ESC}OB`), ["up", "down"], "application cursor mode");
  });

  it("prefers the longest escape sequence", () => {
    // ESC[1;5C is Ctrl+Right. Matching ESC[1 first would strand ";5C" as text.
    deepStrictEqual(names(`${ESC}[1;5C`), ["wordRight"]);
    deepStrictEqual(names(`${ESC}[1;5D`), ["wordLeft"]);
  });

  it("decodes the control shortcuts", () => {
    strictEqual(names("\u0003")[0], "cancel"); // ^C
    strictEqual(names("\u0013")[0], "save"); // ^S
    strictEqual(names("\u001a")[0], "undo"); // ^Z
    strictEqual(names("\u0017")[0], "deleteWord"); // ^W
    strictEqual(names("\u0015")[0], "deleteToStart"); // ^U
    strictEqual(names("\u000f")[0], "help"); // ^O
  });

  it("decodes enter, backspace and delete", () => {
    deepStrictEqual(names("\r"), ["enter"]);
    deepStrictEqual(names("\n"), ["enter"]);
    deepStrictEqual(names("\u007f"), ["backspace"]);
    deepStrictEqual(names(`${ESC}[3~`), ["delete"]);
  });

  it("keeps astral characters whole", () => {
    // A pasted label can contain emoji — Stress.workout has them. Splitting a
    // surrogate pair would corrupt the text.
    const keys = decodeKeys("🏊");
    strictEqual(keys.length, 1);
    strictEqual(keys[0]?.value, "🏊");
  });

  it("handles a pasted chunk as many keys", () => {
    const keys = decodeKeys("8x50 on 1:00\r");
    strictEqual(keys.length, 13);
    strictEqual(keys.at(-1)?.name, "enter");
  });
});

// A tiny driver so tests read as sequences of keystrokes rather than state.
function type(state: EditorState, ...chunks: string[]): EditorState {
  let next = state;
  for (const chunk of chunks) {
    for (const key of decodeKeys(chunk)) {
      next = apply(next, key, () => undefined);
    }
  }
  return next;
}

describe("editor", () => {
  it("inserts and commits a line", () => {
    const state = type(initialState(), "8x50 on 1:00", "\r");
    deepStrictEqual(state.lines, ["8x50 on 1:00"]);
    strictEqual(state.buffer, "", "buffer clears after commit");
  });

  it("edits mid-line rather than only at the end", () => {
    let state = type(initialState(), "8x50");
    state = type(state, `${ESC}[D${ESC}[D`); // left, left
    state = type(state, "1");
    strictEqual(state.buffer, "8x150");
  });

  it("deletes a word with ^W", () => {
    const state = type(initialState(), "8x50 on 1:00", "\u0017");
    strictEqual(state.buffer, "8x50 on ");
  });

  it("clears the line with ^U", () => {
    const state = type(initialState(), "8x50 on 1:00", "\u0015");
    strictEqual(state.buffer, "");
    strictEqual(state.cursor, 0);
  });

  it("moves by word with ctrl+arrows", () => {
    let state = type(initialState(), "8x50 on 1:00");
    state = type(state, `${ESC}[1;5D`);
    strictEqual(state.cursor, 8, "start of the last word");
    state = type(state, `${ESC}[1;5D`);
    strictEqual(state.cursor, 5);
  });

  it("undoes the last committed line back into the buffer", () => {
    // Pulling it back rather than discarding: almost always you want to fix it.
    let state = type(initialState(), "400 warmup", "\r", "8x50", "\r");
    deepStrictEqual(state.lines, ["400 warmup", "8x50"]);
    state = type(state, "\u001a");
    deepStrictEqual(state.lines, ["400 warmup"]);
    strictEqual(state.buffer, "8x50");
    strictEqual(state.cursor, 4, "cursor lands at the end, ready to edit");
  });

  it("recalls previous lines with up, and edits them in place", () => {
    let state = type(initialState(), "400 warmup", "\r", "8x50", "\r");
    state = type(state, `${ESC}[A`);
    strictEqual(state.buffer, "8x50");
    strictEqual(state.editing, 1);

    state = type(state, `${ESC}[A`);
    strictEqual(state.buffer, "400 warmup");
    strictEqual(state.editing, 0);

    // Committing replaces that line rather than appending a new one.
    state = type(state, "\u0015", "600 warmup", "\r");
    deepStrictEqual(state.lines, ["600 warmup", "8x50"]);
  });

  it("does not hijack up while you are mid-typing", () => {
    const state = type(initialState(["400 warmup"]), "8x5", `${ESC}[A`);
    strictEqual(state.buffer, "8x5", "arrow ignored with text in the buffer");
    strictEqual(state.editing, null);
  });

  it("escape cancels an in-progress edit without changing the line", () => {
    let state = type(initialState(["400 warmup"]), `${ESC}[A`);
    strictEqual(state.editing, 0);
    state = type(state, "\u0015", "junk", ESC);
    deepStrictEqual(state.lines, ["400 warmup"]);
    strictEqual(state.buffer, "");
  });

  it("refuses to commit a line the parser rejects, keeping the text", () => {
    let state = initialState();
    for (const key of decodeKeys("8x50 on banana\r")) {
      state = apply(state, key, (line) => (line.includes("banana") ? "not a time" : undefined));
    }
    deepStrictEqual(state.lines, [], "nothing committed");
    strictEqual(state.buffer, "8x50 on banana", "your text survives");
    strictEqual(state.intent.kind, "rejected");
  });

  it("treats enter on an empty buffer as finishing", () => {
    const state = type(initialState(["8x50"]), "\r");
    strictEqual(state.intent.kind, "save");
  });

  it("reports a cancel intent for ^C", () => {
    strictEqual(type(initialState(), "\u0003").intent.kind, "cancel");
  });

  it("toggles help with ^O and dismisses it on the next character", () => {
    let state = type(initialState(), "\u000f");
    strictEqual(state.showHelp, true);
    state = type(state, "4");
    strictEqual(state.showHelp, false);
    strictEqual(state.buffer, "4", "the keystroke is not swallowed");
  });

  it("counts the cursor in code points, not UTF-16 units", () => {
    const state = type(initialState(), "🏊", "x");
    strictEqual(state.buffer, "🏊x");
    strictEqual(state.cursor, 2, "two code points, not three");
  });
});
