/**
 * The workout as a file the client can save, rather than a payload the model
 * has to retype.
 *
 * A link alone means whoever wants the file has to turn base64 back into bytes,
 * and asked to do that a model will sometimes do it itself and get it wrong: a
 * real one arrived here having lost a single byte off the end, which left 340
 * good bytes carrying a mangled six-byte trailer and a file the Watch refused.
 * Handing back the bytes moves that step into the client's code, where it is
 * not a judgement call.
 */

/** Matches what the composer names a download, so the same workout saves alike. */
export function fileNameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug === "" ? "workout" : slug}.workout`;
}

/**
 * Standard base64, not the url-safe kind the link carries — the protocol asks
 * for RFC 4648 §4 here. Built a chunk at a time because spreading a large array
 * into `String.fromCharCode` overflows the stack.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

export interface FileAttachment {
  readonly type: "resource";
  readonly resource: {
    readonly uri: string;
    readonly mimeType: string;
    readonly blob: string;
  };
}

/**
 * `application/octet-stream` is what the composer serves the same bytes as.
 * Apple does not document a media type for `.workout`, and inventing one that
 * a client might act on is worse than saying plainly that these are bytes.
 */
export function attachment(bytes: Uint8Array, title: string, link: string): FileAttachment {
  return {
    type: "resource",
    resource: { uri: link, mimeType: "application/octet-stream", blob: toBase64(bytes) },
  };
}
