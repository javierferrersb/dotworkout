import type { BlockDraft } from "../domain/block.js";
import type { Stage } from "./appFlow.svelte.js";

const KEY = "dotworkout.session.v1";

export interface SessionSnapshot {
  readonly activityId: string;
  readonly title: string;
  readonly blocks: readonly BlockDraft[];
  readonly cursor: number;
  readonly stage: Stage;
}

export function saveSession(snapshot: SessionSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    return;
  }
}

export function loadSession(): SessionSnapshot | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<SessionSnapshot>;
    if (typeof parsed.activityId !== "string") return undefined;
    if (!Array.isArray(parsed.blocks)) return undefined;
    return {
      activityId: parsed.activityId,
      title: typeof parsed.title === "string" ? parsed.title : "Workout",
      blocks: parsed.blocks as BlockDraft[],
      cursor: typeof parsed.cursor === "number" ? parsed.cursor : parsed.blocks.length,
      stage:
        parsed.stage === "compose" || parsed.stage === "choose" || parsed.stage === "name"
          ? parsed.stage
          : "welcome",
    };
  } catch {
    return undefined;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
