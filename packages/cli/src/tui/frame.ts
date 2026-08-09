/**
 * Composing one frame of the composer's display.
 *
 * Pure: state in, lines out. Nothing here touches the terminal, so the visual
 * layer can be tested and inspected without a TTY — the event loop in
 * `composer.ts` is left with only the parts that genuinely cannot be.
 */

import { applyLines, describeLine } from "../notation/apply.js";
import { parseLine, tryParseLine, type ParsedLine } from "../notation/parse.js";
import { NotationError } from "../notation/tokenize.js";
import type { Painter } from "../ui/ansi.js";
import { renderHeader, renderRows, renderTotals, summarize } from "../ui/format.js";
import type { EditorState } from "./editor.js";

export const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["enter", "add set"],
  ["enter on empty", "finish"],
  ["↑ ↓", "edit an earlier line"],
  ["^Z", "undo last set"],
  ["^W / ^U", "delete word / line"],
  ["^A / ^E", "start / end of line"],
  ["esc", "cancel edit"],
  ["^O", "toggle this help"],
  ["^C", "quit without saving"],
];

export const COMMANDS: readonly (readonly [string, string])[] = [
  [":name <text>", "title the workout"],
  [":drop <n>", "delete line n"],
  [":save", "finish and write"],
  [":q", "quit without saving"],
];

const NOTATION_HELP: readonly string[] = [
  "8x50 on 1:00     send-off — leave every 1:00",
  "4x100 pull r:20  labelled “pull”, 20s rest after each",
  "4x1:00           a time set   ·   100y   yards, kept as yards",
  "8x50 z3          heart-rate zone 3",
  "400 warmup       ·   200 cd   ·   rest :30",
];

export interface Frame {
  readonly lines: readonly string[];
  /** Zero-based row holding the prompt, so the caller can park the caret. */
  readonly promptRow: number;
  /** Column the buffer text starts at, zero-based. */
  readonly promptColumn: number;
}

export interface FrameInput {
  readonly state: EditorState;
  readonly name: string;
  readonly painter: Painter;
  readonly width: number;
  readonly notice?: string | undefined;
}

export function composeFrame(input: FrameInput): Frame {
  const { state, name, painter: p, width } = input;
  const lines: string[] = [];

  const parsed = parseAll(state.lines);
  const workout = parsed.length > 0 ? safeBuild(parsed, name) : undefined;

  lines.push("");
  lines.push(renderHeader(name, workout, p, width));
  lines.push("");

  if (workout !== undefined) {
    lines.push(
      ...renderRows(summarize(workout), {
        painter: p,
        width,
        ...(state.editing !== null ? { activeIndex: state.editing } : {}),
      }),
    );
    lines.push(...renderTotals(workout, p, width));
  } else {
    lines.push(p.paint("  nothing yet — try `400 warmup` or `8x50 on 1:00`", "dim"));
  }

  lines.push("");

  if (state.showHelp) {
    lines.push(`  ${p.paint("keys", "bold")}`);
    for (const [key, what] of SHORTCUTS) {
      lines.push(`    ${p.paint(pad(key, 16), "brightCyan")}${p.paint(what, "dim")}`);
    }
    lines.push("");
    lines.push(`  ${p.paint("commands", "bold")}`);
    for (const [command, what] of COMMANDS) {
      lines.push(`    ${p.paint(pad(command, 16), "brightCyan")}${p.paint(what, "dim")}`);
    }
    lines.push("");
    lines.push(`  ${p.paint("notation", "bold")}`);
    for (const example of NOTATION_HELP) {
      lines.push(`    ${p.paint(example, "dim")}`);
    }
    lines.push("");
  }

  const marker = p.paint(
    p.glyph("›", ">"),
    state.editing === null ? "brightGreen" : "brightYellow",
  );
  const promptRow = lines.length;
  lines.push(`${marker} ${state.buffer}`);
  lines.push(feedback(input));
  lines.push(`  ${p.paint(statusHint(state), "dim")}`);

  return { lines, promptRow, promptColumn: 2 };
}

/** The line beneath the prompt: parse echo, error with a hint, or a notice. */
function feedback(input: FrameInput): string {
  const { state, painter: p } = input;
  if (input.notice !== undefined) {
    return `  ${p.paint(p.glyph("!", "!"), "brightMagenta")} ${p.paint(input.notice, "brightMagenta")}`;
  }

  const text = state.buffer.trim();
  if (text === "") return "";
  if (text.startsWith(":")) {
    return `  ${p.paint(p.glyph("›", ">"), "dim")} ${p.paint("command", "dim")}`;
  }

  const result = tryParseLine(text);
  if (result instanceof NotationError) {
    // Show the caret under the offending span, offset past the prompt marker.
    const hint = result.hint === undefined ? "" : p.paint(`  ${result.hint}`, "dim");
    return `  ${p.paint(p.glyph("✗", "x"), "red")} ${p.paint(result.message, "red")}${hint}`;
  }
  return `  ${p.paint(p.glyph("✓", "+"), "green")} ${p.paint(describeLine(result), "dim")}`;
}

function statusHint(state: EditorState): string {
  if (state.editing !== null) return `editing line ${state.editing + 1} · enter to replace · esc to cancel`;
  if (state.lines.length === 0) return "enter to add a set · ^O for keys";
  return "enter to add · empty enter to finish · ^Z undo · ^O keys";
}

export function parseAll(lines: readonly string[]): ParsedLine[] {
  const parsed: ParsedLine[] = [];
  for (const line of lines) {
    try {
      parsed.push(parseLine(line));
    } catch {
      // Lines are validated before they are committed, so this should not
      // happen. Skipping beats crashing the render loop if it ever does.
    }
  }
  return parsed;
}

function safeBuild(parsed: readonly ParsedLine[], name: string) {
  try {
    return applyLines(parsed, { name }).build().customWorkout;
  } catch {
    return undefined;
  }
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}
