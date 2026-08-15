/**
 * A share link carries the whole workout in the fragment, so opening one needs
 * no server and nothing is uploaded. The app and the MCP server both build it
 * here: a link one of them writes and the other cannot read is worse than no
 * link, and only one of the two would ever find out.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Base64url, unpadded. Hand-rolled so this works in a browser and in Node. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let at = 0; at < bytes.length; at += 3) {
    const first = bytes[at] as number;
    const second = bytes[at + 1];
    const third = bytes[at + 2];

    out += ALPHABET[first >> 2] as string;
    out += ALPHABET[((first & 0b11) << 4) | ((second ?? 0) >> 4)] as string;
    if (second === undefined) break;
    out += ALPHABET[((second & 0b1111) << 2) | ((third ?? 0) >> 6)] as string;
    if (third === undefined) break;
    out += ALPHABET[third & 0b111111] as string;
  }
  return out;
}

export function fromBase64Url(value: string): Uint8Array {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const character of value) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error(`Not a workout link: unexpected character ${character}`);
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

export interface LinkOptions {
  /**
   * Where the app is served, with any path it sits under —
   * `https://example.com` or `https://example.com/app`.
   */
  readonly origin: string;
  readonly title?: string;
}

export function workoutLink(bytes: Uint8Array, options: LinkOptions): string {
  const base = options.origin.replace(/\/+$/, "");
  const name = encodeURIComponent(options.title ?? "Workout");
  return `${base}/#w=${toBase64Url(bytes)}&n=${name}`;
}

export interface InboundWorkout {
  readonly bytes: Uint8Array;
  readonly title: string;
}

/** Reads back what `workoutLink` wrote. Takes the fragment, with or without `#`. */
export function readWorkoutLink(fragment: string): InboundWorkout | undefined {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const payload = params.get("w");
  if (payload === null) return undefined;
  try {
    return { bytes: fromBase64Url(payload), title: params.get("n") ?? "Workout" };
  } catch {
    return undefined;
  }
}
