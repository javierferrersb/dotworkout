/**
 * Presentation of durations in swim idiom.
 *
 * The domain layer's `formatDuration` is unit-faithful: it renders 20 seconds as
 * `20s` because that is what is stored. Swimmers write rest as `:20`. Both are
 * right for their layer, so the translation lives here and is shared by the
 * table and the live echo — having them disagree was the first thing that
 * looked wrong on screen.
 */

import { formatDuration, type Duration } from "@dotworkout/domain";

/** `:20`, `1:30`, `5min` — how a rest or send-off reads on a whiteboard. */
export function restText(duration: Duration): string {
  if (duration.unit === "s" && Number.isInteger(duration.value) && duration.value < 60) {
    return `:${String(duration.value).padStart(2, "0")}`;
  }
  return formatDuration(duration);
}
