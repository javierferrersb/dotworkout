import type { CustomWorkout } from "@dotworkout/codec";
import {
  alertShapeFor,
  capabilitiesFor,
  formatDistance,
  formatDuration,
  steps,
  totalDistance,
} from "@dotworkout/domain";
import type { Activity } from "./workout.js";

/**
 * Text the model reads. Shared by the stdio and HTTP servers, which used to
 * carry a copy each and had started to drift.
 */

export function describeActivity(activity: Activity): string {
  const outdoor = capabilitiesFor(activity, "outdoor");
  const indoor = capabilitiesFor(activity, "indoor");

  const lines = [
    activity + (outdoor.enumerated ? "" : " (never enumerated: anything allowed, with a warning)"),
    `  goals:  ${outdoor.goals.join(", ")}`,
    `  alerts: ${outdoor.alerts.length === 0 ? "none" : outdoor.alerts.join(", ")}`,
  ];

  const differsIndoors =
    indoor.goals.join() !== outdoor.goals.join() || indoor.alerts.join() !== outdoor.alerts.join();
  if (differsIndoors) {
    lines.push(`  indoors: goals ${indoor.goals.join(", ")} · alerts ${indoor.alerts.join(", ")}`);
  }
  if (outdoor.unverifiedAlerts.length > 0) {
    lines.push(`  alerts, unverified (allowed, will warn): ${outdoor.unverifiedAlerts.join(", ")}`);
  }
  if (outdoor.advisory !== undefined) lines.push(`  note:   ${outdoor.advisory}`);

  for (const metric of outdoor.alerts) {
    const shape = alertShapeFor(metric);
    const readings = shape.readings ? " · current or average" : "";
    lines.push(`    ${metric}: ${shape.styles.join(" | ")}${readings}`);
  }
  return lines.join("\n");
}

/** One line per step, then the total: what inspect_workout reports. */
export function describeWorkout(custom: CustomWorkout, fallbackTitle: string): string {
  const lines = [
    custom.displayName === "" ? fallbackTitle : custom.displayName,
    ...steps(custom).map((step) => {
      const goal =
        step.goal.kind === "distance"
          ? formatDistance(step.goal.distance)
          : step.goal.kind === "time"
            ? formatDuration(step.goal.duration)
            : step.goal.kind === "distanceTime"
              ? `${formatDistance(step.goal.distance)} on ${formatDuration(step.goal.duration)}`
              : step.goal.kind;
      const label = step.label === undefined || step.label === "" ? "" : `  ${step.label}`;
      return `  ${step.position.kind.padEnd(9)} ${goal}${label}`;
    }),
  ];
  const total = totalOf(custom);
  if (total !== "") lines.push(`total ${total}`);
  return lines.join("\n");
}

/** "1.4 km", or "2 km + 1 mi" when units are mixed, or "" for a timed session. */
export function totalOf(custom: CustomWorkout): string {
  return totalDistance(custom).total.byUnit.map(formatDistance).join(" + ");
}

export function bullets(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
}
