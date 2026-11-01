import type { BlockDraft, BlockKind } from "./block.js";

type KindOf<T> = (item: T) => BlockKind | undefined;

const ownKind: KindOf<BlockDraft> = (block) => block.kind;

/**
 * A warm up and a cool down are single fields on the wire pinned to the ends of
 * the workout, so there is only ever one of each and neither ever moves.
 */
export function isPinned(block: BlockDraft | undefined): boolean {
  return block === undefined || block.kind === "WARMUP" || block.kind === "COOLDOWN";
}

/**
 * The same ordering for anything that carries a block, so the builder can keep
 * an identity on each step while the warm up and cool down stay at the ends.
 */
export function performedOrder<T>(items: readonly T[], kindOf: KindOf<T>): T[] {
  const warmups = items.filter((item) => kindOf(item) === "WARMUP");
  const cooldowns = items.filter((item) => kindOf(item) === "COOLDOWN");
  const middle = items.filter((item) => {
    const kind = kindOf(item);
    return kind !== "WARMUP" && kind !== "COOLDOWN";
  });
  return [...warmups, ...middle, ...cooldowns];
}

export function inPerformedOrder(blocks: readonly BlockDraft[]): BlockDraft[] {
  return performedOrder(blocks, ownKind);
}

/**
 * Where the cursor lands once the block at `index` is gone. Removing a block
 * above the one being edited shifts it up by one, so the composer stays on the
 * block it was on rather than sliding onto its neighbour.
 */
export function cursorAfterRemoval(cursor: number, index: number, remaining: number): number {
  return Math.min(index < cursor ? cursor - 1 : cursor, remaining);
}

export function movedItem<T>(
  items: readonly T[],
  from: number,
  to: number,
  kindOf: KindOf<T>,
): T[] {
  const item = items[from];
  if (item === undefined || from === to) return [...items];

  const rest = items.filter((_, position) => position !== from);
  const at = Math.max(0, Math.min(rest.length, to));
  return performedOrder([...rest.slice(0, at), item, ...rest.slice(at)], kindOf);
}

/**
 * The block at `from` lands at `to`, taking that slot and pushing the rest
 * down. A drop past a pinned block lands beside it instead.
 */
export function moved(blocks: readonly BlockDraft[], from: number, to: number): BlockDraft[] {
  return movedItem(blocks, from, to, ownKind);
}
