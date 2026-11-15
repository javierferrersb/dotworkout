import { cubicOut } from "svelte/easing";
import type { AnimationConfig } from "svelte/animate";

const reduced =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A transition length, or none for people who asked the system for less motion. */
export function ms(duration: number): number {
  return reduced ? 0 : duration;
}

/**
 * Like Svelte's flip, but it only slides an item to its new place and never
 * stretches it. Flip also scales items whose size changed, so a step that grew
 * because a field appeared would warp as a whole instead of letting the field
 * animate in.
 */
export function move(
  node: Element,
  { from, to }: { from: DOMRect; to: DOMRect },
  {
    delay = 0,
    duration = 250,
    easing = cubicOut,
  }: { delay?: number; duration?: number; easing?: (t: number) => number } = {},
): AnimationConfig {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (dx === 0 && dy === 0) return { duration: 0 };
  const transform = getComputedStyle(node).transform;
  const base = transform === "none" ? "" : transform;
  return {
    delay,
    duration,
    easing,
    css: (_t, u) => `transform: ${base} translate(${u * dx}px, ${u * dy}px);`,
  };
}
