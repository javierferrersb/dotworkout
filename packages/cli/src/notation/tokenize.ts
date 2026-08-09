/**
 * Tokeniser for swim notation.
 *
 * Splits on whitespace but keeps every token's offset in the original line, so
 * a parse error can point a caret at the exact word that failed. A notation
 * this terse is only pleasant to use if being wrong is cheap to diagnose.
 */

export interface Token {
  /** Text as written, original case preserved — labels need it. */
  readonly text: string;
  /** Lowercased, for keyword matching. */
  readonly lower: string;
  readonly start: number;
  readonly end: number;
}

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    const text = match[0];
    tokens.push({
      text,
      lower: text.toLowerCase(),
      start: match.index,
      end: match.index + text.length,
    });
  }
  return tokens;
}

/**
 * An error that knows where it happened.
 *
 * `offset`/`length` index into the original line so the renderer can underline
 * the offending span rather than just complaining in general terms.
 */
export class NotationError extends Error {
  override readonly name = "NotationError";
  readonly offset: number;
  readonly length: number;
  /** What to try instead, when there is a sensible suggestion. */
  readonly hint: string | undefined;

  constructor(message: string, offset: number, length: number, hint?: string) {
    super(message);
    this.offset = offset;
    this.length = Math.max(1, length);
    this.hint = hint;
  }

  /** Render as a caret pointer beneath the offending span. */
  caret(): string {
    return " ".repeat(this.offset) + "^".repeat(this.length);
  }
}
