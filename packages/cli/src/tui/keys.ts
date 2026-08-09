/**
 * Decoding raw-mode keypresses.
 *
 * In raw mode stdin delivers bytes, not events: arrow keys arrive as escape
 * sequences, Ctrl+A as 0x01, and a pasted line as one large chunk. Keeping this
 * a pure function of a chunk means the whole keyboard layer is testable without
 * a terminal.
 */

export type KeyName =
  | "char"
  | "enter"
  | "backspace"
  | "delete"
  | "tab"
  | "shiftTab"
  | "escape"
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "wordLeft"
  | "wordRight"
  | "deleteWord"
  | "deleteToStart"
  | "deleteToEnd"
  | "submit"
  | "cancel"
  | "save"
  | "undo"
  | "help"
  | "unknown";

export interface Key {
  readonly name: KeyName;
  /** Present when `name` is `"char"`. */
  readonly value: string;
  readonly ctrl: boolean;
}

const ESC = "\u001b";

/** Decode one stdin chunk into zero or more keys. */
export function decodeKeys(chunk: string): Key[] {
  const keys: Key[] = [];
  let i = 0;

  while (i < chunk.length) {
    const rest = chunk.slice(i);

    // Escape sequences first — a lone ESC is only an escape if nothing follows.
    const sequence = matchSequence(rest);
    if (sequence !== undefined) {
      keys.push(sequence.key);
      i += sequence.length;
      continue;
    }

    const char = chunk[i]!;
    const code = char.charCodeAt(0);

    if (char === "\r" || char === "\n") {
      keys.push(key("enter"));
      i++;
      continue;
    }
    if (code === 0x7f || code === 0x08) {
      keys.push(key("backspace"));
      i++;
      continue;
    }
    if (char === "\t") {
      keys.push(key("tab"));
      i++;
      continue;
    }
    if (code < 0x20) {
      keys.push(control(code));
      i++;
      continue;
    }

    // Take the whole code point, so astral characters (emoji in labels) are not
    // split into surrogate halves.
    const codePoint = String.fromCodePoint(chunk.codePointAt(i)!);
    keys.push({ name: "char", value: codePoint, ctrl: false });
    i += codePoint.length;
  }

  return keys;
}

function matchSequence(rest: string): { key: Key; length: number } | undefined {
  if (!rest.startsWith(ESC)) return undefined;

  const table: Record<string, KeyName> = {
    "[A": "up",
    "[B": "down",
    "[C": "right",
    "[D": "left",
    "[H": "home",
    "[F": "end",
    "[1~": "home",
    "[4~": "end",
    "[3~": "delete",
    "[Z": "shiftTab",
    "OA": "up",
    "OB": "down",
    "OC": "right",
    "OD": "left",
    "[1;5C": "wordRight",
    "[1;5D": "wordLeft",
    "[1;3C": "wordRight",
    "[1;3D": "wordLeft",
  };

  // Longest match wins: "[1;5C" must not be read as "[1" then junk.
  const candidates = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const suffix of candidates) {
    if (rest.startsWith(ESC + suffix)) {
      return { key: key(table[suffix]!), length: 1 + suffix.length };
    }
  }

  // Alt+Backspace — delete previous word, as in most shells.
  if (rest.startsWith(`${ESC}\u007f`)) return { key: key("deleteWord"), length: 2 };
  if (rest.length === 1) return { key: key("escape"), length: 1 };
  return { key: key("unknown"), length: rest.length };
}

function control(code: number): Key {
  switch (code) {
    case 0x01:
      return key("home", true); // Ctrl+A
    case 0x03:
      return key("cancel", true); // Ctrl+C
    case 0x04:
      return key("submit", true); // Ctrl+D
    case 0x05:
      return key("end", true); // Ctrl+E
    case 0x0b:
      return key("deleteToEnd", true); // Ctrl+K
    case 0x0f:
      return key("help", true); // Ctrl+O
    case 0x13:
      return key("save", true); // Ctrl+S
    case 0x15:
      return key("deleteToStart", true); // Ctrl+U
    case 0x17:
      return key("deleteWord", true); // Ctrl+W
    case 0x1a:
      return key("undo", true); // Ctrl+Z
    default:
      return key("unknown", true);
  }
}

function key(name: KeyName, ctrl = false): Key {
  return { name, value: "", ctrl };
}
