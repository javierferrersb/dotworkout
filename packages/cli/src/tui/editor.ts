/**
 * The line editor, as a pure state machine.
 *
 * `apply(state, key)` returns the next state and never touches the terminal.
 * That keeps every keyboard shortcut unit-testable, which matters here because
 * the shortcuts *are* the product — a composer you have to reach for the mouse
 * in has missed the point.
 */

export interface EditorState {
  /** Committed lines, in workout order. */
  readonly lines: readonly string[];
  /** Current input buffer. */
  readonly buffer: string;
  /** Caret position within `buffer`, in code points. */
  readonly cursor: number;
  /**
   * Which committed line is being re-edited, or null when appending.
   * Set by ↑ from an empty buffer; cleared on commit.
   */
  readonly editing: number | null;
  /** Position in `lines` when browsing history with ↑/↓. */
  readonly historyIndex: number | null;
  readonly showHelp: boolean;
  /** Set when the editor wants the host to act. Cleared each tick. */
  readonly intent: Intent;
}

export type Intent =
  | { readonly kind: "none" }
  | { readonly kind: "save" }
  | { readonly kind: "quit" }
  | { readonly kind: "cancel" }
  | { readonly kind: "rejected"; readonly reason: string };

export function initialState(lines: readonly string[] = []): EditorState {
  return {
    lines,
    buffer: "",
    cursor: 0,
    editing: null,
    historyIndex: null,
    showHelp: false,
    intent: { kind: "none" },
  };
}

import type { Key } from "./keys.js";

/**
 * @param canCommit validates a candidate line. Returning a string rejects the
 *   commit with that reason, which is how a parse error keeps you in the editor
 *   with your text intact instead of silently appending something broken.
 */
export function apply(
  state: EditorState,
  key: Key,
  canCommit: (line: string) => string | undefined = () => undefined,
): EditorState {
  const clean: EditorState = { ...state, intent: { kind: "none" } };
  const chars = [...clean.buffer];

  switch (key.name) {
    case "char": {
      // Typing dismisses the help panel, but the keystroke still lands. Eating
      // it would mean the first character of every set typed after a glance at
      // the help vanishes, which is worse than the panel lingering a moment.
      const next = [...chars.slice(0, clean.cursor), key.value, ...chars.slice(clean.cursor)];
      return {
        ...clean,
        buffer: next.join(""),
        cursor: clean.cursor + 1,
        historyIndex: null,
        showHelp: false,
      };
    }

    case "enter": {
      const line = clean.buffer.trim();
      if (line === "") {
        // Enter on an empty buffer is how you finish, so it does not need a
        // shortcut to be discoverable.
        return { ...clean, intent: { kind: "save" }, showHelp: false };
      }
      const rejection = canCommit(line);
      if (rejection !== undefined) {
        return { ...clean, intent: { kind: "rejected", reason: rejection } };
      }
      const lines =
        clean.editing === null
          ? [...clean.lines, line]
          : clean.lines.map((existing, i) => (i === clean.editing ? line : existing));
      return { ...initialState(lines) };
    }

    case "backspace": {
      if (clean.cursor === 0) return clean;
      const next = [...chars.slice(0, clean.cursor - 1), ...chars.slice(clean.cursor)];
      return { ...clean, buffer: next.join(""), cursor: clean.cursor - 1 };
    }

    case "delete": {
      if (clean.cursor >= chars.length) return clean;
      const next = [...chars.slice(0, clean.cursor), ...chars.slice(clean.cursor + 1)];
      return { ...clean, buffer: next.join("") };
    }

    case "left":
      return { ...clean, cursor: Math.max(0, clean.cursor - 1) };
    case "right":
      return { ...clean, cursor: Math.min(chars.length, clean.cursor + 1) };
    case "home":
      return { ...clean, cursor: 0 };
    case "end":
      return { ...clean, cursor: chars.length };

    case "wordLeft":
      return { ...clean, cursor: wordBoundaryLeft(chars, clean.cursor) };
    case "wordRight":
      return { ...clean, cursor: wordBoundaryRight(chars, clean.cursor) };

    case "deleteWord": {
      const start = wordBoundaryLeft(chars, clean.cursor);
      const next = [...chars.slice(0, start), ...chars.slice(clean.cursor)];
      return { ...clean, buffer: next.join(""), cursor: start };
    }
    case "deleteToStart":
      return { ...clean, buffer: chars.slice(clean.cursor).join(""), cursor: 0 };
    case "deleteToEnd":
      return { ...clean, buffer: chars.slice(0, clean.cursor).join("") };

    case "up":
      return recall(clean, -1);
    case "down":
      return recall(clean, +1);

    case "undo": {
      if (clean.lines.length === 0) return clean;
      // Undo pulls the last line back into the buffer rather than discarding
      // it — almost always you want to fix it, not lose it.
      const last = clean.lines[clean.lines.length - 1]!;
      return {
        ...initialState(clean.lines.slice(0, -1)),
        buffer: last,
        cursor: [...last].length,
      };
    }

    case "escape":
      if (clean.showHelp) return { ...clean, showHelp: false };
      if (clean.editing !== null) return { ...initialState(clean.lines) };
      if (clean.buffer !== "") return { ...clean, buffer: "", cursor: 0 };
      return clean;

    case "help":
      return { ...clean, showHelp: !clean.showHelp };

    case "save":
      return { ...clean, intent: { kind: "save" }, showHelp: false };

    case "submit":
      return { ...clean, intent: { kind: "save" }, showHelp: false };

    case "cancel":
      return { ...clean, intent: { kind: "cancel" } };

    default:
      return clean;
  }
}

/**
 * ↑/↓ through committed lines.
 *
 * From an empty buffer, ↑ pulls the previous line back for editing in place.
 * From a non-empty buffer it does nothing, so arrow keys stay safe mid-typing.
 */
function recall(state: EditorState, direction: -1 | 1): EditorState {
  if (state.lines.length === 0) return state;
  if (state.historyIndex === null && state.buffer !== "" && state.editing === null) return state;

  const current = state.historyIndex ?? state.lines.length;
  const next = current + direction;

  if (next >= state.lines.length) {
    return { ...state, buffer: "", cursor: 0, historyIndex: null, editing: null };
  }
  const index = Math.max(0, next);
  const line = state.lines[index]!;
  return {
    ...state,
    buffer: line,
    cursor: [...line].length,
    historyIndex: index,
    editing: index,
  };
}

function wordBoundaryLeft(chars: readonly string[], cursor: number): number {
  let i = cursor;
  while (i > 0 && chars[i - 1] === " ") i--;
  while (i > 0 && chars[i - 1] !== " ") i--;
  return i;
}

function wordBoundaryRight(chars: readonly string[], cursor: number): number {
  let i = cursor;
  while (i < chars.length && chars[i] === " ") i++;
  while (i < chars.length && chars[i] !== " ") i++;
  return i;
}
