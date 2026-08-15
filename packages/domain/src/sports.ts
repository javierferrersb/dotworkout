/**
 * The catalogue: which sports exist, where each is offered, and what it is
 * measured in.
 *
 * Assembled from `constraints/compatibility.json` and the activity enum. Every
 * consumer builds its list from here — a UI that keeps its own will drift, and
 * the drift shows up as a sport the app offers and the validator rejects.
 */

import { CustomWorkout_ActivityType } from "@dotworkout/codec";
import { COMPATIBILITY } from "./generated/compatibility-data.js";
import type { WorkoutLocation } from "./capabilities.js";
import type { DistanceUnit } from "./units.js";

export interface Sport {
  /** Matches the matrix key and the `CustomWorkout_ActivityType` name. */
  readonly name: string;
  readonly type: CustomWorkout_ActivityType;
  /** Where the Watch offers it. Most sports are one or the other. */
  readonly locations: readonly WorkoutLocation[];
  /** Unit a bare number is read as. */
  readonly defaultUnit: DistanceUnit;
  /**
   * Whether a speed target reads as a pace. Running, walking and hiking are
   * paced in minutes per kilometre; everything else is a speed in km/h. The
   * wire format stores metres per second either way (spec §6).
   */
  readonly showsPace: boolean;
}

const KILOMETRES = new Set(["RUNNING", "CYCLING", "WALKING", "HIKING"]);
const PACED = new Set(["RUNNING", "WALKING", "HIKING"]);

function locationsOf(entry: unknown): readonly WorkoutLocation[] {
  const listed = (entry as { locations?: readonly string[] }).locations;
  const valid = (listed ?? []).filter(
    (value): value is WorkoutLocation => value === "indoor" || value === "outdoor",
  );
  return valid.length > 0 ? valid : ["outdoor"];
}

export const SPORTS: readonly Sport[] = Object.entries(COMPATIBILITY.customWorkout).flatMap(
  ([name, entry]) => {
    const type = CustomWorkout_ActivityType[name as keyof typeof CustomWorkout_ActivityType];
    if (typeof type !== "number") return [];
    return [
      {
        name,
        type,
        locations: locationsOf(entry),
        defaultUnit: KILOMETRES.has(name) ? ("km" as const) : ("m" as const),
        showsPace: PACED.has(name),
      },
    ];
  },
);

export function findSport(name: string): Sport | undefined {
  return SPORTS.find((sport) => sport.name === name);
}

/** Does a speed target on this sport read as a pace rather than a speed? */
export function showsPace(sport: string): boolean {
  return findSport(sport)?.showsPace === true;
}
