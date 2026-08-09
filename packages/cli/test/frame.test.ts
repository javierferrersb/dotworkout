/**
 * The composer's display.
 *
 * `composeFrame` is pure, so the thing the user actually looks at is testable
 * without a terminal. Colour is off here (no TTY), which conveniently makes the
 * assertions about layout rather than escape codes.
 */

import { ok, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";
import { Painter, displayWidth, type Capabilities } from "../src/ui/ansi.js";
import { composeFrame } from "../src/tui/frame.js";
import { initialState, type EditorState } from "../src/tui/editor.js";

const PLAIN: Capabilities = {
  color: false,
  trueColor: false,
  unicode: true,
  interactive: false,
  columns: 80,
};

function frame(state: EditorState, name = "Thursday threshold", width = 80) {
  return composeFrame({ state, name, painter: new Painter(PLAIN), width });
}

function text(state: EditorState, name?: string): string {
  return frame(state, name).lines.join("\n");
}

describe("composeFrame", () => {
  it("shows a prompt on an empty workout, and says what to try", () => {
    const output = text(initialState());
    ok(output.includes("nothing yet"), output);
    ok(output.includes("8x50 on 1:00"), "the empty state teaches the notation");
  });

  it("renders committed sets with reps, modifiers and totals", () => {
    const output = text(
      initialState(["400 warmup", "8x50 on 1:00 Build", "4x100 pull r:20", "200 cd"]),
    );
    ok(output.includes("8×"), output);
    ok(output.includes("on 1:00"), output);
    ok(output.includes("rest :20"), "rest reads in swim convention, not `20s`");
    ok(output.includes("Build"), output);
    ok(output.includes("1,400 m"), "total is separated for reading");
  });

  it("breaks the total down by label", () => {
    // Labels are the only per-stroke grouping the format can express.
    const output = text(initialState(["8x50 Build", "4x100 pull"]));
    ok(output.includes("Build"), output);
    ok(output.includes("pull"), output);
  });

  it("never shows a lap count", () => {
    // Pool length is chosen on the Watch and is not in the file, so laps are
    // unknowable at authoring time.
    const output = text(initialState(["8x50 on 1:00", "400 warmup"])).toLowerCase();
    ok(!output.includes("lap"), output);
  });

  it("echoes what the current line was understood as", () => {
    const state = { ...initialState(), buffer: "8x50 on 1:00", cursor: 12 };
    const output = text(state);
    ok(output.includes("8 × 50 m"), output);
    ok(output.includes("leaving every 1:00"), output);
  });

  it("shows an error and a hint for an unparseable line, without committing", () => {
    const state = { ...initialState(), buffer: "8x50 on banana", cursor: 14 };
    const output = text(state);
    ok(output.includes("not one") || output.includes("banana"), output);
    ok(output.includes("Times look like"), "the hint is shown too");
  });

  it("marks the line being edited", () => {
    const base = initialState(["400 warmup", "8x50"]);
    const editing: EditorState = { ...base, editing: 1, buffer: "8x50", cursor: 4 };
    const output = text(editing);
    ok(output.includes("editing line 2"), output);
    ok(output.includes("▸"), "the active row is marked");
  });

  it("shows the help panel on demand, including the notation summary", () => {
    const output = text({ ...initialState(), showHelp: true });
    ok(output.includes("keys"), output);
    ok(output.includes("^Z"), output);
    ok(output.includes(":name"), output);
    ok(output.includes("send-off"), output);
  });

  it("reports the prompt position so the caret can be parked", () => {
    const result = frame({ ...initialState(["8x50"]), buffer: "4x1", cursor: 3 });
    const promptLine = result.lines[result.promptRow]!;
    ok(promptLine.includes("4x1"), promptLine);
    strictEqual(result.promptColumn, 2);
    strictEqual(result.lines.length - result.promptRow, 3, "prompt, feedback, status");
  });

  it("keeps every line inside the terminal width", () => {
    // A wrapped line breaks the repaint bookkeeping, so nothing may exceed it.
    const wide = "8x50 " + "long label ".repeat(20);
    const result = frame(initialState([wide, "400 warmup"]), "a very long workout name ".repeat(4), 80);
    for (const line of result.lines) {
      ok(displayWidth(line) <= 80, `line too wide (${displayWidth(line)}): ${line}`);
    }
  });

  it("falls back to ASCII when unicode is unsafe", () => {
    const ascii = composeFrame({
      state: { ...initialState(["8x50"]), buffer: "8x50", cursor: 4 },
      name: "x",
      painter: new Painter({ ...PLAIN, unicode: false }),
      width: 80,
    });
    const output = ascii.lines.join("\n");
    ok(output.includes(">"), "the prompt marker degrades");
    ok(!output.includes("›"), output);
  });

  it("emits no escape codes when colour is off", () => {
    const output = text(initialState(["8x50 on 1:00"]));
    ok(!output.includes("\u001b"), "piped output stays clean");
  });
});
