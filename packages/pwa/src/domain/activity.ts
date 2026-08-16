import type { CustomWorkout_ActivityType } from "@dotworkout/codec";
import { SPORTS, alertShapeFor, capabilitiesFor } from "@dotworkout/domain";
import type { AlertShape, DistanceUnit, WorkoutLocation } from "@dotworkout/domain";

export type AlertMetric = "HEART_RATE" | "SPEED" | "CADENCE" | "POWER";
export type GoalKind = "DISTANCE" | "DISTANCE_TIME" | "TIME" | "OPEN";
export type AlertStyle = "ZONE" | "VALUE" | "RANGE";
export type AlertReading = "current" | "average";

export interface Activity {
  /** Catalogue and message-key id. Distinct from the sport when a sport is offered indoors and out. */
  readonly id: string;
  /** Key into the compatibility matrix, which knows nothing about location. */
  readonly sport: string;
  readonly type: CustomWorkout_ActivityType;
  readonly location: WorkoutLocation;
  readonly defaultDistanceUnit: DistanceUnit;
}

export type ActivityCapabilities = ReturnType<typeof capabilitiesFor>;

/**
 * One entry per sport, and one more for each sport the Watch offers indoors as
 * well as out. The id is what the picker and the message keys use; the sport is
 * what the library knows about.
 */
export const ACTIVITY_CATALOGUE: readonly Activity[] = SPORTS.flatMap((sport) =>
  sport.locations.map((location) => ({
    id: location === "indoor" && sport.locations.length > 1 ? `${sport.name}_INDOOR` : sport.name,
    sport: sport.name,
    type: sport.type,
    location,
    defaultDistanceUnit: sport.defaultUnit,
  })),
);

export function findActivity(id: string): Activity {
  const activity = ACTIVITY_CATALOGUE.find((candidate) => candidate.id === id);
  if (activity === undefined) throw new Error(`Unknown activity ${id}`);
  return activity;
}

export function capabilitiesOf(activity: Activity): ActivityCapabilities {
  return capabilitiesFor(activity.sport, activity.location);
}

export function alertShapeOf(metric: AlertMetric): AlertShape {
  return alertShapeFor(metric);
}
