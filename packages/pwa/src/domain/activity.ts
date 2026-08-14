import { CustomWorkout_ActivityType } from "@dotworkout/codec";
import { COMPATIBILITY } from "@dotworkout/domain";
import type { DistanceUnit } from "@dotworkout/domain";

export type AlertMetric = "HEART_RATE" | "SPEED" | "CADENCE" | "POWER";
export type GoalKind = "DISTANCE" | "DISTANCE_TIME" | "TIME" | "OPEN";
export type AlertStyle = "ZONE" | "VALUE" | "RANGE";
export type AlertReading = "current" | "average";

export type WorkoutLocation = "indoor" | "outdoor";

export interface Activity {
  /** Catalogue and message-key id. Distinct from the sport when a sport is offered indoors and out. */
  readonly id: string;
  /** Key into the compatibility matrix, which knows nothing about location. */
  readonly sport: string;
  readonly type: CustomWorkout_ActivityType;
  readonly location: WorkoutLocation;
  readonly defaultDistanceUnit: DistanceUnit;
}

export interface ActivityCapabilities {
  readonly goals: readonly GoalKind[];
  readonly alerts: readonly AlertMetric[];
  readonly unverifiedAlerts: readonly AlertMetric[];
  readonly enumerated: boolean;
  readonly advisory: string | undefined;
}

/**
 * The fourteen sports WorkoutKit accepts, split by location where the Watch
 * offers both. Pool swims store as OUTDOOR (spec 3), which is why swimming is
 * listed that way rather than indoors.
 */
const CATALOGUE: readonly {
  id: string;
  sport: string;
  location: WorkoutLocation;
  unit: DistanceUnit;
}[] = [
  { id: "SWIMMING", sport: "SWIMMING", location: "outdoor", unit: "m" },
  { id: "RUNNING", sport: "RUNNING", location: "outdoor", unit: "km" },
  { id: "RUNNING_INDOOR", sport: "RUNNING", location: "indoor", unit: "km" },
  { id: "CYCLING", sport: "CYCLING", location: "outdoor", unit: "km" },
  { id: "CYCLING_INDOOR", sport: "CYCLING", location: "indoor", unit: "km" },
  { id: "WALKING", sport: "WALKING", location: "outdoor", unit: "km" },
  { id: "WALKING_INDOOR", sport: "WALKING", location: "indoor", unit: "km" },
  { id: "HIKING", sport: "HIKING", location: "outdoor", unit: "km" },
  { id: "HIGH_INTENSITY_INTERVAL_TRAINING", sport: "HIGH_INTENSITY_INTERVAL_TRAINING", location: "outdoor", unit: "m" },
  { id: "ROWING", sport: "ROWING", location: "indoor", unit: "m" },
  { id: "ELLIPTICAL", sport: "ELLIPTICAL", location: "indoor", unit: "m" },
  { id: "STAIR_CLIMBING", sport: "STAIR_CLIMBING", location: "indoor", unit: "m" },
  { id: "CROSS_TRAINING", sport: "CROSS_TRAINING", location: "indoor", unit: "m" },
  { id: "FUNCTIONAL_STRENGTH_TRAINING", sport: "FUNCTIONAL_STRENGTH_TRAINING", location: "indoor", unit: "m" },
  { id: "TRADITIONAL_STRENGTH_TRAINING", sport: "TRADITIONAL_STRENGTH_TRAINING", location: "indoor", unit: "m" },
  { id: "CORE_TRAINING", sport: "CORE_TRAINING", location: "indoor", unit: "m" },
  { id: "YOGA", sport: "YOGA", location: "indoor", unit: "m" },
];

export const ACTIVITY_CATALOGUE: readonly Activity[] = CATALOGUE.flatMap((entry) => {
  const type = CustomWorkout_ActivityType[entry.sport as keyof typeof CustomWorkout_ActivityType];
  if (typeof type !== "number") return [];
  return [
    {
      id: entry.id,
      sport: entry.sport,
      type,
      location: entry.location,
      defaultDistanceUnit: entry.unit,
    },
  ];
});

export function findActivity(id: string): Activity {
  const activity = ACTIVITY_CATALOGUE.find((candidate) => candidate.id === id);
  if (activity === undefined) throw new Error(`Unknown activity ${id}`);
  return activity;
}

const ALL_GOALS: readonly GoalKind[] = ["DISTANCE", "DISTANCE_TIME", "TIME", "OPEN"];
const ALL_ALERTS: readonly AlertMetric[] = ["HEART_RATE", "SPEED", "CADENCE", "POWER"];

export function capabilitiesOf(activity: Activity): ActivityCapabilities {
  const table = COMPATIBILITY.customWorkout as Record<
    string,
    { goalTypes: readonly string[]; alerts: readonly string[]; alertsUnverified?: readonly string[]; note?: string }
  >;
  const entry = Object.hasOwn(table, activity.sport) ? table[activity.sport] : undefined;

  if (entry === undefined) {
    return {
      goals: ALL_GOALS.filter((goal) => goal !== "DISTANCE_TIME"),
      alerts: ALL_ALERTS,
      unverifiedAlerts: [],
      enumerated: false,
      advisory: COMPATIBILITY.customWorkoutUnverifiedActivities._note,
    };
  }

  return {
    goals: ALL_GOALS.filter((goal) => entry.goalTypes.includes(goal)),
    alerts: ALL_ALERTS.filter((metric) => entry.alerts.includes(metric)),
    unverifiedAlerts: ALL_ALERTS.filter((metric) => (entry.alertsUnverified ?? []).includes(metric)),
    enumerated: true,
    advisory: entry.note,
  };
}

const STYLE_ORDER: readonly AlertStyle[] = ["ZONE", "VALUE", "RANGE"];

export interface AlertShape {
  readonly styles: readonly AlertStyle[];
  readonly readings: boolean;
}

export function alertShapeOf(metric: AlertMetric): AlertShape {
  const table = COMPATIBILITY.alertStyles as Record<
    string,
    { styles: readonly string[]; currentAverageToggle: boolean }
  >;
  const entry = Object.hasOwn(table, metric) ? table[metric] : undefined;

  return {
    styles: STYLE_ORDER.filter((style) => (entry?.styles ?? ["VALUE"]).includes(style)),
    readings: entry?.currentAverageToggle === true,
  };
}
