const reduced =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A transition length, or none for people who asked the system for less motion. */
export function ms(duration: number): number {
  return reduced ? 0 : duration;
}
