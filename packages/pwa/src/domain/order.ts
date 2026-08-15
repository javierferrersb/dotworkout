import type { BlockDraft } from "./block.js";

/**
 * A warm up and a cool down are single fields on the wire pinned to the ends of
 * the workout, so there is only ever one of each and neither ever moves.
 */
export function isPinned(block: BlockDraft | undefined): boolean {
  return block === undefined || block.kind === "WARMUP" || block.kind === "COOLDOWN";
}

export function inPerformedOrder(blocks: readonly BlockDraft[]): BlockDraft[] {
  const warmups = blocks.filter((block) => block.kind === "WARMUP");
  const cooldowns = blocks.filter((block) => block.kind === "COOLDOWN");
  const middle = blocks.filter((block) => block.kind !== "WARMUP" && block.kind !== "COOLDOWN");
  return [...warmups, ...middle, ...cooldowns];
}

/**
 * The block at `from` lands at `to`, taking that slot and pushing the rest
 * down. A drop past a pinned block lands beside it instead.
 */
export function moved(blocks: readonly BlockDraft[], from: number, to: number): BlockDraft[] {
  const block = blocks[from];
  if (block === undefined || from === to) return [...blocks];

  const rest = blocks.filter((_, position) => position !== from);
  const at = Math.max(0, Math.min(rest.length, to));
  return inPerformedOrder([...rest.slice(0, at), block, ...rest.slice(at)]);
}
