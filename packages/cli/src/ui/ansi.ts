/**
 * Terminal capability detection and styling.
 *
 * Everything degrades. Colour is disabled when the output is piped, when
 * NO_COLOR is set, or when the terminal says it is dumb; box drawing falls back
 * to ASCII when the encoding will not carry it. The CLI has to stay legible in
 * a CI log, a `less` pager, and a Windows console that predates UTF-8.
 */

export interface Capabilities {
  readonly color: boolean;
  /** 24-bit colour, as opposed to the basic 16. */
  readonly trueColor: boolean;
  /** Safe to draw with box-drawing characters and other non-ASCII glyphs. */
  readonly unicode: boolean;
  readonly interactive: boolean;
  readonly columns: number;
}

export function detectCapabilities(stream: NodeJS.WriteStream = process.stdout): Capabilities {
  const env = process.env;
  const isTty = stream.isTTY === true;

  // https://no-color.org — any non-empty value disables colour, and it wins
  // over every other signal except an explicit FORCE_COLOR.
  const noColor = env["NO_COLOR"] !== undefined && env["NO_COLOR"] !== "";
  const forceColor = env["FORCE_COLOR"] !== undefined && env["FORCE_COLOR"] !== "0";
  const dumb = env["TERM"] === "dumb";

  const color = forceColor || (isTty && !noColor && !dumb);
  const colorTerm = env["COLORTERM"] ?? "";
  const trueColor = color && (/truecolor|24bit/i.test(colorTerm) || env["TERM_PROGRAM"] === "vscode");

  return {
    color,
    trueColor,
    unicode: detectUnicode(),
    interactive: isTty && process.stdin.isTTY === true,
    columns: stream.columns ?? 80,
  };
}

function detectUnicode(): boolean {
  const env = process.env;
  if (env["DOTWORKOUT_ASCII"] === "1") return false;
  if (process.platform !== "win32") {
    return /UTF-?8/i.test(env["LC_ALL"] ?? env["LC_CTYPE"] ?? env["LANG"] ?? "UTF-8");
  }
  // Windows Terminal, VS Code and modern PowerShell all handle it. The legacy
  // conhost that does not is identifiable by the absence of all three.
  return (
    env["WT_SESSION"] !== undefined ||
    env["TERM_PROGRAM"] === "vscode" ||
    env["ConEmuANSI"] === "ON" ||
    (env["PSModulePath"] ?? "").includes("PowerShell")
  );
}

/** SGR codes, applied only when colour is on. */
export interface Style {
  (text: string): string;
}

const CODES = {
  reset: 0,
  bold: 1,
  dim: 2,
  italic: 3,
  underline: 4,
  inverse: 7,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
} as const;

export type StyleName = keyof typeof CODES;

export class Painter {
  readonly caps: Capabilities;

  constructor(caps: Capabilities) {
    this.caps = caps;
  }

  paint(text: string, ...styles: StyleName[]): string {
    if (!this.caps.color || styles.length === 0) return text;
    const open = styles.map((s) => `[${CODES[s]}m`).join("");
    return `${open}${text}[0m`;
  }

  /** Pick a glyph, falling back to ASCII where Unicode is unsafe. */
  glyph(unicode: string, ascii: string): string {
    return this.caps.unicode ? unicode : ascii;
  }
}

/** Cursor and screen control. No-ops when not interactive. */
export const ESC = {
  clearScreen: "[2J[H",
  clearLine: "[2K",
  clearBelow: "[J",
  hideCursor: "[?25l",
  showCursor: "[?25h",
  up: (n: number) => (n > 0 ? `[${n}A` : ""),
  down: (n: number) => (n > 0 ? `[${n}B` : ""),
  right: (n: number) => (n > 0 ? `[${n}C` : ""),
  toColumn: (n: number) => `[${n}G`,
} as const;

/**
 * Printable width of a string, ignoring SGR sequences.
 *
 * Not full grapheme segmentation — it counts code points and gives wide CJK and
 * emoji two columns, which is enough for the labels this CLI renders. Getting
 * this wrong shows up as box borders that do not line up.
 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of stripAnsi(text)) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x200d) continue; // zero-width joiner
    if (code >= 0xfe00 && code <= 0xfe0f) continue; // variation selectors
    width += isWide(code) ? 2 : 1;
  }
  return width;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;?]*[A-Za-z]/g, "");
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff)
  );
}

/** Pad to `width` display columns, accounting for ANSI and wide glyphs. */
export function padEnd(text: string, width: number): string {
  const gap = width - displayWidth(text);
  return gap > 0 ? text + " ".repeat(gap) : text;
}

export function padStart(text: string, width: number): string {
  const gap = width - displayWidth(text);
  return gap > 0 ? " ".repeat(gap) + text : text;
}

/** Truncate to `width` display columns, with an ellipsis when it does not fit. */
export function truncate(text: string, width: number, ellipsis = "…"): string {
  if (displayWidth(text) <= width) return text;
  const limit = width - displayWidth(ellipsis);
  let out = "";
  for (const char of text) {
    if (displayWidth(out + char) > limit) break;
    out += char;
  }
  return out + ellipsis;
}
