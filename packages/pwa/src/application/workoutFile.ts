import { encode } from "@dotworkout/codec";
import { compose, type WorkoutDraft } from "./workoutComposition.js";

export function fileNameFor(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug === "" ? "workout" : slug}.workout`;
}

export function saveBytes(bytes: Uint8Array, title: string): string {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFor(title);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 30_000);
  return anchor.download;
}

export function download(draft: WorkoutDraft): string {
  return saveBytes(encode(compose(draft)), draft.title);
}
