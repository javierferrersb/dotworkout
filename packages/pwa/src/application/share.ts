import qrcode from "qrcode-generator";
import { encode } from "@dotworkout/codec";
import { compose, type WorkoutDraft } from "./workoutComposition.js";
import { fileNameFor } from "./workoutFile.js";

export type ShareOutcome = "shared" | "unavailable" | "cancelled";
export type ShareRoute = "download" | "chat";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function workoutLink(draft: WorkoutDraft): string {
  const payload = toBase64Url(encode(compose(draft)));
  const name = encodeURIComponent(draft.title);
  return `${location.origin}${location.pathname}#w=${payload}&n=${name}`;
}

export interface InboundWorkout {
  readonly bytes: Uint8Array;
  readonly title: string;
}

export function readInboundWorkout(): InboundWorkout | undefined {
  const hash = location.hash.replace(/^#/, "");
  if (hash === "") return undefined;
  const params = new URLSearchParams(hash);
  const payload = params.get("w");
  if (payload === null) return undefined;
  try {
    return { bytes: fromBase64Url(payload), title: params.get("n") ?? "Workout" };
  } catch {
    return undefined;
  }
}

export function clearInboundWorkout(): void {
  history.replaceState(null, "", `${location.origin}${location.pathname}`);
}

export function qrMatrix(text: string): readonly (readonly boolean[])[] {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  const rows: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const cells: boolean[] = [];
    for (let column = 0; column < size; column++) cells.push(code.isDark(row, column));
    rows.push(cells);
  }
  return rows;
}

export async function shareBytes(bytes: Uint8Array, title: string): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "unavailable";
  }
  const file = new File([bytes as BlobPart], fileNameFor(title), {
    type: "application/octet-stream",
  });
  if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
    return "unavailable";
  }
  try {
    await navigator.share({ files: [file], title });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    return "unavailable";
  }
}

export function whatsappLink(draft: WorkoutDraft, summary: string): string {
  const message = `${draft.title}\n${summary}\n\n${workoutLink(draft)}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
