import {
  paceToMetersPerSecond,
  parseDistance,
  parseDuration,
  showsPace,
  speedToMetersPerSecond,
  toSeconds,
  type Distance,
  type DistanceUnit,
  type Duration,
} from "@dotworkout/domain";
import {
  alertShapeOf,
  type ActivityCapabilities,
  type AlertMetric,
  type AlertReading,
  type AlertStyle,
  type GoalKind,
} from "../domain/activity.js";
import type { AlertDraft, BlockDraft, BlockKind } from "../domain/block.js";
import type { MessageKey } from "../i18n/messages.js";

/**
 * Every edit the builder makes to a step, as pure functions over the draft.
 *
 * The interview these replace cleared everything downstream of an answer, which
 * was safe for a form filled in once from the top but loses work in a form that
 * is edited in any order. Here an edit keeps every value that still means the
 * same thing afterwards and drops only what no longer applies.
 */

/** A value the field cannot take, named by the message that explains it. */
export class FieldError extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

export const DISTANCE_UNITS: readonly DistanceUnit[] = ["m", "km", "yd", "mi"];

export type DurationField = "duration" | "sendOff" | "recovery";

export function newStep(kind: BlockKind, capabilities: ActivityCapabilities): BlockDraft {
  if (kind === "RECOVERY") return { kind };
  const goalKind = capabilities.goals[0];
  return goalKind === undefined ? { kind } : { kind, goalKind };
}

export function changeKind(
  draft: BlockDraft,
  kind: BlockKind,
  capabilities: ActivityCapabilities,
): BlockDraft {
  if (draft.kind === kind) return draft;

  // A rest is only ever a time, so it keeps a time if there was one and nothing else.
  if (kind === "RECOVERY") {
    const duration =
      draft.goalKind === "TIME" || draft.kind === undefined ? draft.duration : undefined;
    return { kind, duration, label: draft.label };
  }

  if (draft.kind === "RECOVERY") {
    const timed = draft.duration !== undefined && capabilities.goals.includes("TIME");
    return timed
      ? { kind, goalKind: "TIME", duration: draft.duration, label: draft.label }
      : { ...newStep(kind, capabilities), label: draft.label };
  }

  const next: BlockDraft = { ...draft, kind };
  return kind === "INTERVAL" ? next : { ...next, repetitions: undefined, recovery: undefined };
}

export function changeGoal(draft: BlockDraft, goalKind: GoalKind): BlockDraft {
  if (draft.goalKind === goalKind) return draft;
  const measured = goalKind === "DISTANCE" || goalKind === "DISTANCE_TIME";
  return {
    ...draft,
    goalKind,
    distance: measured ? draft.distance : undefined,
    duration: goalKind === "TIME" ? draft.duration : undefined,
    sendOff: goalKind === "DISTANCE_TIME" ? draft.sendOff : undefined,
  };
}

export function withDistance(draft: BlockDraft, distance: Distance | undefined): BlockDraft {
  return { ...draft, distance };
}

export function withDuration(
  draft: BlockDraft,
  field: DurationField,
  duration: Duration | undefined,
): BlockDraft {
  return { ...draft, [field]: duration };
}

export function withRepetitions(draft: BlockDraft, repetitions: number | undefined): BlockDraft {
  return { ...draft, repetitions };
}

export function withLabel(draft: BlockDraft, text: string): BlockDraft {
  const label = text.trim();
  return { ...draft, label: label === "" ? undefined : label };
}

const NO_TARGET = {
  alertReading: undefined,
  alertStyle: undefined,
  alertFrom: undefined,
  alertTo: undefined,
  alert: undefined,
} as const;

export function withTarget(draft: BlockDraft, metric: AlertMetric | "NONE"): BlockDraft {
  if (draft.alertMetric === metric) return draft;
  if (metric === "NONE") return { ...draft, alertMetric: "NONE", ...NO_TARGET };

  // Choosing a target picks its first reading and style, so the value field
  // shows straight away rather than after two more choices.
  const shape = alertShapeOf(metric);
  return {
    ...draft,
    ...NO_TARGET,
    alertMetric: metric,
    alertReading: shape.readings ? "current" : undefined,
    alertStyle: shape.styles.length > 1 ? shape.styles[0] : undefined,
  };
}

export function withReading(draft: BlockDraft, reading: AlertReading): BlockDraft {
  if (draft.alertReading === reading) return draft;
  const alert = draft.alert;
  const kept =
    alert === undefined || !("reading" in alert) ? alert : ({ ...alert, reading } as AlertDraft);
  return { ...draft, alertReading: reading, alert: kept };
}

export function withStyle(draft: BlockDraft, style: AlertStyle): BlockDraft {
  if (targetStyle(draft) === style) return draft;
  return {
    ...draft,
    alertStyle: style,
    alertFrom: undefined,
    alertTo: undefined,
    alert: undefined,
  };
}

export function withZone(draft: BlockDraft, zone: number): BlockDraft {
  return { ...draft, alert: { metric: "HEART_RATE", style: "ZONE", zone } };
}

/** A single target: one pace, one cadence, one wattage. */
export function withValue(draft: BlockDraft, value: number | undefined): BlockDraft {
  const metric = draft.alertMetric;
  if (metric === undefined || metric === "NONE" || value === undefined) {
    return { ...draft, alert: undefined };
  }
  const reading = draft.alertReading ?? "current";
  switch (metric) {
    case "HEART_RATE":
      return withZone(draft, value);
    case "SPEED":
      return { ...draft, alert: { metric, style: "VALUE", metersPerSecond: value, reading } };
    case "CADENCE":
      return { ...draft, alert: { metric, style: "VALUE", perMinute: value } };
    case "POWER":
      return { ...draft, alert: { metric, style: "VALUE", watts: value, reading } };
  }
}

/**
 * One end of a range. The alert exists once both ends do, low to high
 * whichever way round they were typed.
 */
export function withBound(
  draft: BlockDraft,
  end: "from" | "to",
  value: number | undefined,
): BlockDraft {
  const ends = rangeEnds(draft);
  const from = end === "from" ? value : ends.from;
  const to = end === "to" ? value : ends.to;
  const metric = draft.alertMetric;
  const alert =
    from === undefined || to === undefined || metric === undefined || metric === "NONE"
      ? undefined
      : rangeAlert(metric, Math.min(from, to), Math.max(from, to), draft.alertReading ?? "current");
  return { ...draft, alertFrom: from, alertTo: to, alert };
}

function rangeAlert(
  metric: AlertMetric,
  low: number,
  high: number,
  reading: AlertReading,
): AlertDraft {
  switch (metric) {
    case "HEART_RATE":
      return { metric, style: "RANGE", from: low, to: high };
    case "SPEED":
      return { metric, style: "RANGE", slower: low, faster: high, reading };
    case "CADENCE":
      return { metric, style: "RANGE", from: low, to: high };
    case "POWER":
      return { metric, style: "RANGE", from: low, to: high, reading };
  }
}

export function targetStyle(draft: BlockDraft): AlertStyle | undefined {
  const metric = draft.alertMetric;
  if (metric === undefined || metric === "NONE") return undefined;
  const shape = alertShapeOf(metric);
  return shape.styles.length > 1 ? draft.alertStyle : shape.styles[0];
}

/** Both ends of a range as typed, falling back to the built alert for drafts saved before `alertTo`. */
export function rangeEnds(draft: BlockDraft): { from: number | undefined; to: number | undefined } {
  const alert = draft.alert;
  if (alert === undefined || alert.style !== "RANGE") {
    return { from: draft.alertFrom, to: draft.alertTo };
  }
  const low = alert.metric === "SPEED" ? alert.slower : alert.from;
  const high = alert.metric === "SPEED" ? alert.faster : alert.to;
  const from = draft.alertFrom ?? low;
  const to = draft.alertTo ?? (from === low ? high : low);
  return { from, to };
}

/** The number behind a single target, in the units the field is typed in. */
export function targetValue(draft: BlockDraft): number | undefined {
  const alert = draft.alert;
  if (alert === undefined) return undefined;
  if (alert.metric === "HEART_RATE") return alert.style === "ZONE" ? alert.zone : undefined;
  if (alert.style !== "VALUE") return undefined;
  switch (alert.metric) {
    case "SPEED":
      return alert.metersPerSecond;
    case "CADENCE":
      return alert.perMinute;
    case "POWER":
      return alert.watts;
  }
}

// Reading a field. Each throws a FieldError naming what a good value looks like.

function normalised(text: string): string {
  return text.trim().replace(",", ".");
}

export function readDistance(text: string, unit: DistanceUnit): Distance {
  try {
    const distance = parseDistance(normalised(text), unit);
    if (distance.value <= 0) throw new FieldError("field.error.distance");
    return distance;
  } catch {
    throw new FieldError("field.error.distance");
  }
}

export function readDuration(text: string): Duration {
  let duration: Duration;
  try {
    duration = parseDuration(normalised(text));
  } catch {
    throw new FieldError("field.error.duration");
  }
  if (toSeconds(duration) <= 0) throw new FieldError("field.error.duration");
  return duration;
}

export function readCount(text: string): number {
  const value = Number(normalised(text));
  if (!Number.isInteger(value) || value < 1) throw new FieldError("field.error.count");
  return value;
}

/** A target number as typed: a pace for running, km/h for other speeds, a whole number otherwise. */
export function readTarget(metric: AlertMetric, text: string, sport: string): number {
  const clean = normalised(text);
  if (metric === "SPEED") {
    if (showsPace(sport)) {
      try {
        return paceToMetersPerSecond(clean);
      } catch {
        throw new FieldError("field.error.pace");
      }
    }
    const kmh = Number(clean);
    if (!Number.isFinite(kmh) || kmh <= 0) throw new FieldError("field.error.number");
    return speedToMetersPerSecond(kmh);
  }
  const value = Number(clean);
  if (!Number.isFinite(value) || value <= 0) throw new FieldError("field.error.number");
  return Math.round(value);
}

// Writing a value back into its field, the way it would be typed.

export function numberText(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function clockText(totalSeconds: number): string {
  const whole = Math.round(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = String(whole % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function durationText(duration: Duration | undefined): string {
  return duration === undefined ? "" : clockText(toSeconds(duration));
}

export function targetText(metric: AlertMetric, value: number | undefined, sport: string): string {
  if (value === undefined) return "";
  if (metric !== "SPEED") return numberText(value);
  if (showsPace(sport)) return clockText(1000 / value);
  return numberText(Math.round(value * 36) / 10);
}
