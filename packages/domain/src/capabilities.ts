/**
 * What a sport offers, read from the compatibility matrix.
 *
 * Every consumer goes through here — the validator, the browser composer, the
 * MCP server. A UI that works the rules out for itself will disagree with the
 * validator eventually, and the disagreement will be silent: the app hides an
 * option the library still writes, or offers one the library rejects.
 *
 * Nothing in this file states a rule. It reads
 * `constraints/compatibility.json`, which is the only place rules live.
 */

import { COMPATIBILITY } from "./generated/compatibility-data.js";

export type WorkoutLocation = "indoor" | "outdoor";
export type GoalName = "DISTANCE" | "DISTANCE_TIME" | "TIME" | "OPEN";
export type AlertMetricName = "HEART_RATE" | "SPEED" | "CADENCE" | "POWER";
export type AlertStyleName = "ZONE" | "VALUE" | "RANGE";

const ALL_GOALS: readonly GoalName[] = ["DISTANCE", "DISTANCE_TIME", "TIME", "OPEN"];
const ALL_ALERTS: readonly AlertMetricName[] = ["HEART_RATE", "SPEED", "CADENCE", "POWER"];
const STYLE_ORDER: readonly AlertStyleName[] = ["ZONE", "VALUE", "RANGE"];

export interface SportCapabilities {
  readonly goals: readonly GoalName[];
  readonly alerts: readonly AlertMetricName[];
  /** Offered but never checked. Allowed with a warning, never rejected. */
  readonly unverifiedAlerts: readonly AlertMetricName[];
  /** False when the sport is not in the matrix: allow everything, warn once. */
  readonly enumerated: boolean;
  readonly confidence: string | undefined;
  readonly advisory: string | undefined;
}

interface MatrixEntry {
  readonly goalTypes: readonly string[];
  readonly alerts: readonly string[];
  readonly alertsUnverified?: readonly string[];
  readonly confidence?: string;
  readonly note?: string;
  readonly indoor?: {
    readonly goalTypes?: readonly string[];
    readonly alerts?: readonly string[];
    readonly confidence?: string;
    readonly note?: string;
  };
}

function lookup(sport: string): MatrixEntry | undefined {
  const table = COMPATIBILITY.customWorkout as unknown as Record<string, MatrixEntry>;
  return Object.hasOwn(table, sport) ? table[sport] : undefined;
}

/**
 * A sport can offer less indoors than out: a treadmill measures no cadence or
 * power, a stationary bike covers no distance. Folding the override in here
 * means no caller has to remember it exists.
 */
export function resolveEntry(sport: string, location: WorkoutLocation): MatrixEntry | undefined {
  const entry = lookup(sport);
  if (entry === undefined || location !== "indoor") return entry;

  const override = entry.indoor;
  if (override === undefined) return entry;

  return {
    ...entry,
    ...(override.goalTypes === undefined ? {} : { goalTypes: override.goalTypes }),
    ...(override.alerts === undefined ? {} : { alerts: override.alerts }),
    ...(override.confidence === undefined ? {} : { confidence: override.confidence }),
    ...(override.note === undefined ? {} : { note: override.note }),
  };
}

export function capabilitiesFor(
  sport: string,
  location: WorkoutLocation = "outdoor",
): SportCapabilities {
  const entry = resolveEntry(sport, location);

  if (entry === undefined) {
    const unverified = COMPATIBILITY.customWorkoutUnverifiedActivities;
    return {
      // Send-off is swimming's alone, so it is never the safe default.
      goals: ALL_GOALS.filter((goal) => goal !== "DISTANCE_TIME"),
      alerts: ALL_ALERTS,
      unverifiedAlerts: [],
      enumerated: false,
      confidence: unverified.confidence,
      advisory: unverified._note,
    };
  }

  return {
    goals: ALL_GOALS.filter((goal) => entry.goalTypes.includes(goal)),
    alerts: ALL_ALERTS.filter((metric) => entry.alerts.includes(metric)),
    unverifiedAlerts: ALL_ALERTS.filter((metric) =>
      (entry.alertsUnverified ?? []).includes(metric),
    ),
    enumerated: true,
    confidence: entry.confidence,
    advisory: entry.note,
  };
}

export interface AlertShape {
  /** Ordered for display: zone first where it exists, then value, then range. */
  readonly styles: readonly AlertStyleName[];
  /** Whether the metric carries the current/average axis. */
  readonly readings: boolean;
}

export function alertShapeFor(metric: AlertMetricName): AlertShape {
  const table = COMPATIBILITY.alertStyles as unknown as Record<
    string,
    { styles: readonly string[]; currentAverageToggle: boolean } | undefined
  >;
  const entry = Object.hasOwn(table, metric) ? table[metric] : undefined;

  return {
    styles: STYLE_ORDER.filter((style) => (entry?.styles ?? ["VALUE"]).includes(style)),
    readings: entry?.currentAverageToggle === true,
  };
}
