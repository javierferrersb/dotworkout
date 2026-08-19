import { capabilitiesFor, findSport } from "@dotworkout/domain";
import type { WorkoutSpec } from "./workout.js";

/**
 * The compatibility matrix, checked against the request rather than against the
 * message built from it.
 *
 * `validateWorkout` inspects a finished protobuf, which drags in protovalidate
 * and its CEL engine — around 375 ms of startup, which is most of a serverless
 * cold start. The structural half of that guards against malformed messages,
 * and over HTTP there is no way to hand this server one: every message it sees
 * it built itself, from a schema that already rejected the alternatives. What
 * is left worth checking is the matrix, and checking it here names the field
 * the caller actually wrote.
 */
export interface Precheck {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const METRIC_OF: Record<string, string> = {
  heartRateZone: "HEART_RATE",
  heartRateRange: "HEART_RATE",
  cadence: "CADENCE",
  cadenceRange: "CADENCE",
  power: "POWER",
  powerRange: "POWER",
  speed: "SPEED",
  speedRange: "SPEED",
};

function goalKind(step: object, sendOff: string | undefined): string {
  if ("open" in step) return "OPEN";
  if ("time" in step) return "TIME";
  return sendOff === undefined ? "DISTANCE" : "DISTANCE_TIME";
}

export function precheck(spec: WorkoutSpec): Precheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  const sport = findSport(spec.activity);
  if (sport === undefined) return { errors: [`Unknown activity ${spec.activity}`], warnings };

  const location = spec.location ?? sport.locations[0] ?? "outdoor";
  if (!sport.locations.includes(location)) {
    errors.push(
      `${spec.activity} is not offered ${location}s — only ${sport.locations.join(", ")}`,
    );
  }

  const can = capabilitiesFor(spec.activity, location);
  const where = location === "indoor" ? `${spec.activity} indoors` : spec.activity;

  const checkGoal = (label: string, step: object, sendOff: string | undefined) => {
    const goal = goalKind(step, sendOff);
    if (!can.goals.includes(goal as (typeof can.goals)[number])) {
      errors.push(`${where} has no ${goal} goal (${label}). It offers: ${can.goals.join(", ")}`);
    }
  };

  const checkAlert = (label: string, alert: { kind: string } | undefined) => {
    if (alert === undefined) return;
    const metric = METRIC_OF[alert.kind];
    if (metric === undefined) return;
    if (can.alerts.includes(metric as (typeof can.alerts)[number])) return;
    if (can.unverifiedAlerts.includes(metric as (typeof can.unverifiedAlerts)[number])) {
      warnings.push(
        `${where} with a ${metric} target (${label}) is unverified — allowed, untested`,
      );
      return;
    }
    const offered = can.alerts.length === 0 ? "none" : can.alerts.join(", ");
    errors.push(`${where} has no ${metric} target (${label}). It offers: ${offered}`);
  };

  if (spec.warmup !== undefined) {
    checkGoal("warmup", spec.warmup, spec.warmup.sendOff);
    checkAlert("warmup", spec.warmup.alert);
  }
  spec.blocks.forEach((block, at) => {
    checkGoal(`block ${at + 1}`, block.work, block.sendOff);
    checkAlert(`block ${at + 1}`, block.alert);
  });
  if (spec.cooldown !== undefined) {
    checkGoal("cooldown", spec.cooldown, spec.cooldown.sendOff);
    checkAlert("cooldown", spec.cooldown.alert);
  }

  return { errors, warnings };
}
