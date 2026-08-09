/**
 * Authored units, preserved.
 *
 * `spec/FORMAT.md` §5 and `structuralRules[6]`: the stored unit is whichever the
 * workout was authored in, and switching display units is lossy — 100 m authored
 * as miles becomes 0.06 mi, which is 96.6 m. Nothing in this module ever
 * rewrites a unit. Conversion exists only in {@link toMeters}, which is for
 * computing a displayable total and is never written back to a goal.
 *
 * Time units are inconsistent even within a single file: `Probe_Time` stores its
 * warm up as MINUTES 5 and its cool down as SECONDS 120; `Swim_DistTime` stores
 * 1:00 and 2:00 as SECONDS but 3:00 as MINUTES 3. So the parser records what the
 * author wrote rather than normalising to a canonical unit.
 */

import {
  WorkoutGoal_DistanceGoal_DistanceUnitType,
  WorkoutGoal_TimeGoal_TimeUnitType,
} from "@dotworkout/codec";

export type DistanceUnit = "m" | "km" | "ft" | "yd" | "mi";
export type TimeUnit = "s" | "min" | "h";

export interface Distance {
  readonly value: number;
  readonly unit: DistanceUnit;
}

export interface Duration {
  readonly value: number;
  readonly unit: TimeUnit;
}

/** Anything accepted where a distance is expected. */
export type DistanceInput = number | string | Distance;
/** Anything accepted where a duration is expected. */
export type DurationInput = number | string | Duration;

const DISTANCE_UNIT_TO_PROTO: Record<DistanceUnit, WorkoutGoal_DistanceGoal_DistanceUnitType> = {
  m: WorkoutGoal_DistanceGoal_DistanceUnitType.METERS,
  km: WorkoutGoal_DistanceGoal_DistanceUnitType.KILOMETERS,
  ft: WorkoutGoal_DistanceGoal_DistanceUnitType.FEET,
  yd: WorkoutGoal_DistanceGoal_DistanceUnitType.YARDS,
  mi: WorkoutGoal_DistanceGoal_DistanceUnitType.MILES,
};

const TIME_UNIT_TO_PROTO: Record<TimeUnit, WorkoutGoal_TimeGoal_TimeUnitType> = {
  s: WorkoutGoal_TimeGoal_TimeUnitType.SECONDS,
  min: WorkoutGoal_TimeGoal_TimeUnitType.MINUTES,
  h: WorkoutGoal_TimeGoal_TimeUnitType.HOURS,
};

const PROTO_TO_DISTANCE_UNIT = invert(DISTANCE_UNIT_TO_PROTO);
const PROTO_TO_TIME_UNIT = invert(TIME_UNIT_TO_PROTO);

/** Metres per unit. Exact for every unit here — these are defined values, not measurements. */
const METERS_PER: Record<DistanceUnit, number> = {
  m: 1,
  km: 1000,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const SECONDS_PER: Record<TimeUnit, number> = { s: 1, min: 60, h: 3600 };

/** Spellings accepted in text input, mapped to the canonical unit tag. */
const DISTANCE_ALIASES: Record<string, DistanceUnit> = {
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  km: "km",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  kilometres: "km",
  ft: "ft",
  foot: "ft",
  feet: "ft",
  yd: "yd",
  yds: "yd",
  yard: "yd",
  yards: "yd",
  mi: "mi",
  mile: "mi",
  miles: "mi",
};

const TIME_ALIASES: Record<string, TimeUnit> = {
  s: "s",
  sec: "s",
  secs: "s",
  second: "s",
  seconds: "s",
  m: "min",
  min: "min",
  mins: "min",
  minute: "min",
  minutes: "min",
  h: "h",
  hr: "h",
  hrs: "h",
  hour: "h",
  hours: "h",
};

export class UnitParseError extends Error {
  override readonly name = "UnitParseError";
}

/**
 * Parse a distance, keeping whatever unit the author used.
 *
 * Accepts `400` (in `defaultUnit`), `"400"`, `"400m"`, `"0.5 mi"`, `"1.2km"`, or
 * an explicit `{ value, unit }`.
 */
export function parseDistance(input: DistanceInput, defaultUnit: DistanceUnit = "m"): Distance {
  if (typeof input === "number") {
    return checkedDistance(input, defaultUnit, String(input));
  }
  if (typeof input === "object") {
    return checkedDistance(input.value, input.unit, JSON.stringify(input));
  }

  const text = input.trim().toLowerCase();
  const match = /^(-?\d+(?:\.\d+)?)\s*([a-z]*)$/.exec(text);
  if (match === null) {
    throw new UnitParseError(`Cannot read "${input}" as a distance (try "400", "400m", "0.5mi")`);
  }
  const [, rawValue = "", rawUnit = ""] = match;
  const unit = rawUnit === "" ? defaultUnit : DISTANCE_ALIASES[rawUnit];
  if (unit === undefined) {
    throw new UnitParseError(
      `Unknown distance unit "${rawUnit}" in "${input}". Known units: m, km, ft, yd, mi`,
    );
  }
  return checkedDistance(Number(rawValue), unit, input);
}

/**
 * Parse a duration, keeping whatever unit the author used.
 *
 * - `30` or `"30"` → 30 seconds
 * - `":20"` → 20 seconds
 * - `"1:00"` → 60 **seconds**, matching how the app stores 1:00 and 2:00 in
 *   `Swim_DistTime`
 * - `"1:30:00"` → 5400 seconds
 * - `"5min"` → 5 **minutes**, preserved as MINUTES rather than expanded to 300 s
 * - `"90s"`, `"1h"` → as written
 */
export function parseDuration(input: DurationInput): Duration {
  if (typeof input === "number") {
    return checkedDuration(input, "s", String(input));
  }
  if (typeof input === "object") {
    return checkedDuration(input.value, input.unit, JSON.stringify(input));
  }

  const text = input.trim().toLowerCase();

  // Clock notation is always stored in seconds. m:ss and h:mm:ss both collapse
  // to a seconds count because that is what the app writes for 1:00 and 2:00.
  if (text.includes(":")) {
    const parts = text.split(":");
    if (parts.length > 3) {
      throw new UnitParseError(`Cannot read "${input}" as a duration (too many ":" groups)`);
    }
    let total = 0;
    for (const part of parts) {
      const piece = part.trim();
      if (piece !== "" && !/^\d+(?:\.\d+)?$/.test(piece)) {
        throw new UnitParseError(`Cannot read "${input}" as a duration`);
      }
      total = total * 60 + (piece === "" ? 0 : Number(piece));
    }
    return checkedDuration(total, "s", input);
  }

  const match = /^(-?\d+(?:\.\d+)?)\s*([a-z]*)$/.exec(text);
  if (match === null) {
    throw new UnitParseError(`Cannot read "${input}" as a duration (try "30", ":20", "1:00", "5min")`);
  }
  const [, rawValue = "", rawUnit = ""] = match;
  const unit = rawUnit === "" ? "s" : TIME_ALIASES[rawUnit];
  if (unit === undefined) {
    throw new UnitParseError(
      `Unknown time unit "${rawUnit}" in "${input}". Known units: s, min, h`,
    );
  }
  return checkedDuration(Number(rawValue), unit, input);
}

/**
 * Metres, for computing a displayable total.
 *
 * Derived, never stored. Writing this back into a goal is precisely the lossy
 * canonicalisation the format forbids.
 */
export function toMeters(distance: Distance): number {
  return distance.value * METERS_PER[distance.unit];
}

/** Seconds, for computing a displayable total. Derived, never stored. */
export function toSeconds(duration: Duration): number {
  return duration.value * SECONDS_PER[duration.unit];
}

export function distanceUnitToProto(unit: DistanceUnit): WorkoutGoal_DistanceGoal_DistanceUnitType {
  return DISTANCE_UNIT_TO_PROTO[unit];
}

export function timeUnitToProto(unit: TimeUnit): WorkoutGoal_TimeGoal_TimeUnitType {
  return TIME_UNIT_TO_PROTO[unit];
}

/** @throws if the file stores a unit this library does not model. */
export function distanceUnitFromProto(
  unit: WorkoutGoal_DistanceGoal_DistanceUnitType,
): DistanceUnit {
  const known = PROTO_TO_DISTANCE_UNIT.get(unit);
  if (known === undefined) {
    throw new UnitParseError(
      `Unmodelled distance unit ${unit}. spec/FORMAT.md §5 lists METERS 1, ` +
        `KILOMETERS 2, FEET 3, YARDS 4, MILES 5 — all observed. A new value is ` +
        `worth capturing as a corpus file.`,
    );
  }
  return known;
}

/** @throws if the file stores a unit this library does not model. */
export function timeUnitFromProto(unit: WorkoutGoal_TimeGoal_TimeUnitType): TimeUnit {
  const known = PROTO_TO_TIME_UNIT.get(unit);
  if (known === undefined) {
    throw new UnitParseError(
      `Unmodelled time unit ${unit}. spec/FORMAT.md §5 lists SECONDS 1, MINUTES 2, HOURS 3.`,
    );
  }
  return known;
}

/** Format for display without implying a precision the value does not have. */
export function formatDistance(distance: Distance): string {
  return `${trim(distance.value)} ${distance.unit}`;
}

export function formatDuration(duration: Duration): string {
  if (duration.unit === "s" && Number.isInteger(duration.value) && duration.value >= 60) {
    const minutes = Math.floor(duration.value / 60);
    const seconds = duration.value % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return `${trim(duration.value)}${duration.unit === "s" ? "s" : duration.unit}`;
}

function checkedDistance(value: number, unit: DistanceUnit, source: string): Distance {
  if (!Number.isFinite(value) || value <= 0) {
    throw new UnitParseError(`Distance must be a positive number, got "${source}"`);
  }
  return { value, unit };
}

function checkedDuration(value: number, unit: TimeUnit, source: string): Duration {
  if (!Number.isFinite(value) || value <= 0) {
    throw new UnitParseError(`Duration must be a positive number, got "${source}"`);
  }
  return { value, unit };
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function invert<K extends string, V>(record: Record<K, V>): Map<V, K> {
  return new Map((Object.entries(record) as [K, V][]).map(([key, value]) => [value, key]));
}
