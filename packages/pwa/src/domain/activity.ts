import { CustomWorkout_ActivityType } from "@dotworkout/codec";
import { COMPATIBILITY } from "@dotworkout/domain";
import type { DistanceUnit } from "@dotworkout/domain";

export type AlertMetric = "HEART_RATE" | "SPEED" | "CADENCE" | "POWER";
export type GoalKind = "DISTANCE" | "DISTANCE_TIME" | "TIME" | "OPEN";

export interface Activity {
  readonly id: string;
  readonly type: CustomWorkout_ActivityType;
  readonly defaultDistanceUnit: DistanceUnit;
}

export interface ActivityCapabilities {
  readonly goals: readonly GoalKind[];
  readonly alerts: readonly AlertMetric[];
  readonly unverifiedAlerts: readonly AlertMetric[];
  readonly enumerated: boolean;
  readonly advisory: string | undefined;
}

const DISTANCE_UNITS: Record<string, DistanceUnit> = {
  SWIMMING: "m",
  RUNNING: "km",
  CYCLING: "km",
  WALKING: "km",
  HIKING: "km",
  ROWING: "m",
};

const OFFERED = Object.keys(COMPATIBILITY.customWorkout);

function toActivity(id: string): Activity | undefined {
  const type = CustomWorkout_ActivityType[id as keyof typeof CustomWorkout_ActivityType];
  if (typeof type !== "number") return undefined;
  return {
    id,
    type,
    defaultDistanceUnit: DISTANCE_UNITS[id] ?? "m",
  };
}

export const ACTIVITY_CATALOGUE: readonly Activity[] = OFFERED.map(toActivity).filter(
  (activity): activity is Activity => activity !== undefined,
);

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
  const entry = Object.hasOwn(table, activity.id) ? table[activity.id] : undefined;

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
