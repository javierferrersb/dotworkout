/**
 * Workout identity.
 *
 * `spec/FORMAT.md` §1: the GUID is a stable per-workout identity, not a
 * per-export nonce. Four corpus files exported from one workout after only
 * changing display units share `EB04F3B5-…`; three files exported across
 * successive edits share `4004C7EB-…`. So a generator must mint a fresh UUIDv4
 * per *workout* — reusing one across genuinely different workouts risks import
 * collisions, and minting a new one on every export of the same workout would
 * throw away the identity the app relies on.
 */

/**
 * A fresh UUIDv4, uppercased.
 *
 * Every corpus GUID is uppercase, which is what the iOS app writes. Nothing
 * proves lowercase would be rejected, but matching the observed convention costs
 * nothing — so the validator accepts either case while this only emits one.
 */
export function newWorkoutGuid(): string {
  return randomUuid().toUpperCase();
}

function randomUuid(): string {
  const c = globalThis.crypto;
  if (c === undefined || typeof c.getRandomValues !== "function") {
    throw new Error(
      "No Web Crypto available. Node 19+ and browsers in a secure context both " +
        "provide globalThis.crypto; pass an explicit guid if you are somewhere else.",
    );
  }
  if (typeof c.randomUUID === "function") return c.randomUUID();

  // randomUUID is unavailable on insecure origins in some browsers, but
  // getRandomValues is not. Same v4 layout, done by hand.
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-` +
    `${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}
