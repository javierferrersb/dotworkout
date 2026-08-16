/**
 * Validation, in two layers with different sources of truth.
 *
 * **Structural invariants** — `iterations >= 1`, exactly one container field,
 * `goal_type` matching its payload, range bounds ordered — live as protovalidate
 * CEL options on the protos in `proto/`, not here. This module just runs them.
 *
 * **The compatibility matrix** — which goals and alerts each sport allows —
 * comes from `constraints/compatibility.json` via a build-time transcription.
 * It is never restated in TypeScript. If you find yourself about to write
 * `if (activity === "SWIMMING")` in this file, the answer is in the data.
 *
 * The asymmetry in `constraints/README.md` is the load-bearing rule here:
 *
 * > confirmed — enforce. presumed — allow, no warning. unknown /
 * > alertsUnverified / customWorkoutUnverifiedActivities — allow and warn.
 * > Never reject on these.
 *
 * A combination nobody checked is not a combination known to be illegal. The
 * cost of wrongly allowing one is a file the Watch declines to import; the cost
 * of wrongly forbidding one is a workout the user cannot create at all, with no
 * recourse and no obvious cause.
 */

import { createValidator, type Validator } from "@bufbuild/protovalidate";
import {
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  WorkoutAlert_AlertMetricEnum,
  WorkoutAlert_AlertStyle,
  WorkoutBinarySchema,
  WorkoutGoal_GoalType,
  readContainer,
  type CustomWorkout,
  type WorkoutAlert,
  type WorkoutBinary,
} from "@dotworkout/codec";
import { COMPATIBILITY, COMPATIBILITY_SOURCE_PATH } from "./generated/compatibility-data.js";
import { resolveEntry } from "./capabilities.js";
import { alertKind, type AlertKind } from "./alerts.js";
import { steps } from "./inspect.js";

export type Severity = "error" | "warning";

export interface Issue {
  readonly severity: Severity;
  /** Stable identifier, safe to match on. Use with {@link ValidateOptions.downgradeToWarning}. */
  readonly code: string;
  readonly message: string;
  /** Dotted path using proto field names, or `$` for the whole file. */
  readonly path: string;
  /** Confidence of the matrix entry this came from, when it came from one. */
  readonly confidence?: string;
  /** Provenance note carried on the matrix entry, surfaced verbatim. */
  readonly note?: string;
}

export interface ValidationResult {
  /** True when there are no errors. Warnings do not make a workout invalid. */
  readonly ok: boolean;
  readonly errors: readonly Issue[];
  readonly warnings: readonly Issue[];
  readonly issues: readonly Issue[];
}

export interface ValidateOptions {
  /**
   * Issue codes to demote from error to warning.
   *
   * The matrix was read off one device, in one region, on one day. When it is
   * wrong, a user needs a way through that is not "edit the library" — see the
   * `openQuestion` and unverified entries in the source file.
   */
  readonly downgradeToWarning?: readonly string[];
  /** Skip the protovalidate structural pass. Rarely what you want. */
  readonly skipStructural?: boolean;
}

export class WorkoutValidationError extends Error {
  override readonly name = "WorkoutValidationError";
  readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    super(
      `Workout failed validation with ${result.errors.length} error(s):\n` +
        result.errors
          .map((issue) => `  [${issue.code}] ${issue.path}: ${issue.message}`)
          .join("\n"),
    );
    this.result = result;
  }
}

let cachedValidator: Validator | undefined;
function validator(): Validator {
  cachedValidator ??= createValidator();
  return cachedValidator;
}

/** Validate a workout. Never throws on invalid input — inspect the result. */
export function validateWorkout(
  binary: WorkoutBinary,
  options: ValidateOptions = {},
): ValidationResult {
  const issues: Issue[] = [];

  if (options.skipStructural !== true) {
    issues.push(...structuralIssues(binary));
  }

  // The compatibility pass reads goals back into domain terms, which throws on a
  // message whose goal_type disagrees with its payload. Validation must report
  // that, never propagate it: a validator that throws on invalid input is
  // useless for the case it exists to handle. The structural pass above has
  // already named the real problem, so this only has to avoid losing it.
  try {
    issues.push(...compatibilityIssues(binary));
  } catch (error) {
    issues.push({
      severity: "error",
      code: "compat.unreadable",
      message:
        `Could not check sport compatibility because the workout is structurally ` +
        `malformed: ${error instanceof Error ? error.message : String(error)}` +
        (issues.length > 0 ? " (see the structural errors above)" : ""),
      path: "$",
    });
  }

  const downgrade = new Set(options.downgradeToWarning ?? []);
  const adjusted = issues.map((issue) =>
    issue.severity === "error" && downgrade.has(issue.code)
      ? { ...issue, severity: "warning" as const }
      : issue,
  );

  const errors = adjusted.filter((issue) => issue.severity === "error");
  const warnings = adjusted.filter((issue) => issue.severity === "warning");
  return { ok: errors.length === 0, errors, warnings, issues: adjusted };
}

/** Validate and throw on errors. Warnings pass through silently. */
export function assertValidWorkout(
  binary: WorkoutBinary,
  options: ValidateOptions = {},
): ValidationResult {
  const result = validateWorkout(binary, options);
  if (!result.ok) throw new WorkoutValidationError(result);
  return result;
}

function structuralIssues(binary: WorkoutBinary): Issue[] {
  const result = validator().validate(WorkoutBinarySchema, binary);
  if (result.kind === "valid") return [];
  if (result.kind === "invalid") {
    return result.violations.map((violation) => ({
      severity: "error" as const,
      // ruleId is the `id` given to each CEL rule in proto/, e.g.
      // "workout_goal.payload_matches_goal_type". Stable and greppable.
      code: `structural.${violation.ruleId}`,
      message: violation.message,
      path: pathOf(violation.field),
    }));
  }
  // A CEL compilation or evaluation failure is a bug in proto/, not in the
  // user's workout. Surfacing it as an error keeps it from passing silently.
  return [
    {
      severity: "error",
      code: "structural.evaluation_failed",
      message: `protovalidate could not evaluate the schema rules: ${String(result.error)}`,
      path: "$",
    },
  ];
}

function compatibilityIssues(binary: WorkoutBinary): Issue[] {
  let container;
  try {
    container = readContainer(binary);
  } catch (error) {
    return [
      {
        severity: "error",
        code: "container.unrecognised",
        message: error instanceof Error ? error.message : String(error),
        path: "$",
      },
    ];
  }

  return container.kind === "singleGoal"
    ? singleGoalIssues(container.workout)
    : customWorkoutIssues(container.workout);
}

function singleGoalIssues(workout: {
  goal?: { goalType: WorkoutGoal_GoalType } | undefined;
}): Issue[] {
  const entry = COMPATIBILITY.singleGoalWorkout;
  const goalType = workout.goal?.goalType;
  if (goalType === undefined) return [];

  const name = goalTypeName(goalType);
  if (name !== undefined && !includes(entry.goalTypes, name)) {
    return [
      {
        severity: "error",
        code: "compat.single_goal_type_not_offered",
        message:
          `A single-goal workout cannot use the ${name} goal. ` +
          `${sourceRef()} lists ${entry.goalTypes.join(", ")}.`,
        path: "single_goal_workout.goal",
        confidence: entry.confidence,
        note: entry.openQuestion,
      },
    ];
  }
  return [];
}

function customWorkoutIssues(workout: CustomWorkout): Issue[] {
  const issues: Issue[] = [];
  const activity = activityName(workout.activityType);
  const indoors = workout.locationType === CustomWorkout_LocationType.INDOOR;
  const entry =
    activity === undefined
      ? undefined
      : (resolveEntry(activity, indoors ? "indoor" : "outdoor") as ActivityEntry | undefined);

  if (entry === undefined) {
    // Unverified or entirely unmodelled activity: allow everything, warn once.
    issues.push(unverifiedActivityIssue(activity, workout.activityType));
  }

  for (const step of steps(workout)) {
    if (entry !== undefined) {
      const goalName = goalSpecName(step.goal.kind);
      if (goalName !== undefined && !includes(entry.goalTypes, goalName)) {
        issues.push({
          severity: "error",
          code: "compat.goal_not_offered",
          message:
            `${activity} does not offer the ${goalName} goal. ` +
            `${sourceRef()} lists ${entry.goalTypes.join(", ")}.`,
          path: `${step.path}.workout_goal`,
          confidence: entry.confidence,
          note: noteOf(entry),
        });
      }
    }

    const alert = step.alert;
    if (alert === undefined) continue;

    const kind = alertKind(alert);
    if (kind === undefined) {
      issues.push({
        severity: "error",
        code: "compat.alert_empty",
        message: "workout_alert is set but carries no metric payload",
        path: `${step.path}.workout_alert`,
      });
      continue;
    }

    if (entry !== undefined) {
      issues.push(
        ...alertAllowedForActivity(
          kind,
          entry,
          activity ?? "this activity",
          `${step.path}.workout_alert`,
        ),
      );
    }
    issues.push(...alertShapeIssues(kind, alert, `${step.path}.workout_alert`));
  }

  return issues;
}

/** Is this alert offered for this sport? Unverified entries warn, never reject. */
function alertAllowedForActivity(
  kind: AlertKind,
  entry: ActivityEntry,
  activity: string,
  path: string,
): Issue[] {
  if (includes(entry.alerts, kind)) return [];

  const raw = "alertsUnverified" in entry ? entry.alertsUnverified : undefined;
  const unverified: readonly string[] = Array.isArray(raw) ? raw : [];
  if (includes(unverified, kind)) {
    return [
      {
        severity: "warning",
        code: "compat.alert_unverified",
        message:
          `The ${kind} alert for ${activity} was never verified against the composer UI. ` +
          `Allowing it: an unchecked combination is not a combination known to be illegal.`,
        path,
        confidence: "unknown",
        note: noteOf(entry),
      },
    ];
  }

  return [
    {
      severity: "error",
      code: "compat.alert_not_offered",
      message:
        `${activity} does not offer the ${kind} alert. ${sourceRef()} lists ` +
        `${entry.alerts.join(", ")}. The format encodes no such constraint, so this ` +
        `would serialise fine and produce a file the Watch may reject.`,
      path,
      confidence: entry.confidence,
      note: noteOf(entry),
    },
  ];
}

/** Does the alert's style and metric match what this metric actually offers? */
function alertShapeIssues(kind: AlertKind, alert: WorkoutAlert, path: string): Issue[] {
  const entry = COMPATIBILITY.alertStyles[kind];
  const issues: Issue[] = [];

  const style = alertStyleName(alert.alertStyle);
  if (style !== undefined && !includes(entry.styles, style)) {
    issues.push({
      severity: "error",
      code: "compat.alert_style_not_offered",
      message:
        `The ${kind} alert does not offer the ${style} style. ` +
        `${sourceRef()} lists ${entry.styles.join(", ")}.`,
      path,
      confidence: entry.confidence,
      note: noteOf(entry),
    });
  }

  const metric = alertMetricName(alert.alertMetric);
  if (metric !== undefined && !includes(entry.metrics, metric)) {
    issues.push({
      severity: "error",
      code: "compat.alert_metric_not_offered",
      message:
        `The ${kind} alert does not use the ${metric} metric. ` +
        `${sourceRef()} lists ${entry.metrics.join(", ")}` +
        (entry.currentAverageToggle ? "." : `, and this metric has no current/average toggle.`),
      path,
      confidence: entry.confidence,
      note: noteOf(entry),
    });
  }

  return issues;
}

function unverifiedActivityIssue(activity: string | undefined, rawValue: number): Issue {
  const unverified = COMPATIBILITY.customWorkoutUnverifiedActivities;
  if (activity !== undefined && includes(unverified.activities, activity)) {
    return {
      severity: "warning",
      code: "compat.activity_unverified",
      message:
        `${activity} is accepted for custom workouts but its composer options were ` +
        `never enumerated, so no goal or alert can be checked against it. ` +
        `Permitting everything rather than guessing a restriction.`,
      path: "custom_workout.activity_type",
      confidence: unverified.confidence,
      note: unverified._note,
    };
  }

  return {
    severity: "warning",
    code: "compat.activity_unknown",
    message:
      `activity_type ${rawValue}${activity === undefined ? "" : ` (${activity})`} is outside ` +
      `the set WorkoutKit is known to accept for custom workouts. The field carries a raw ` +
      `HKWorkoutActivityType, a public enum of ~80 entries, so this may well be valid — ` +
      `nothing has verified it either way.`,
    path: "custom_workout.activity_type",
    confidence: "unknown",
  };
}

type ActivityTable = typeof COMPATIBILITY.customWorkout;
type ActivityEntry = ActivityTable[keyof ActivityTable];

/**
 * The provenance note on a matrix entry, if it has one.
 *
 * Notes carry nuance the `confidence` field alone does not — "ZONE style not
 * offered at the time of observation, but this was not exhaustively checked" is
 * a materially different claim from a bare `confirmed`. Rather than parse that
 * prose into logic, which is the drift constraints/README.md warns against, the
 * note is passed through verbatim so whoever reads the error sees the caveat and
 * can downgrade the code if they disagree.
 */
function noteOf(entry: object): string | undefined {
  return "note" in entry && typeof entry.note === "string" ? entry.note : undefined;
}

/** Render a protovalidate field Path as a dotted string, or `$` for the root. */
function pathOf(field: { toString(): string }): string {
  const rendered = field.toString();
  return rendered === "" ? "$" : rendered;
}

function sourceRef(): string {
  return `${COMPATIBILITY_SOURCE_PATH} (observed ${COMPATIBILITY.observedOn})`;
}

/** Widening `includes` so readonly tuple types from the generated data still match. */
function includes(haystack: readonly string[], needle: string): boolean {
  return haystack.includes(needle);
}

function activityName(value: number): string | undefined {
  return CustomWorkout_ActivityType[value];
}

function goalTypeName(value: WorkoutGoal_GoalType): string | undefined {
  return WorkoutGoal_GoalType[value];
}

function alertStyleName(value: WorkoutAlert_AlertStyle): string | undefined {
  return WorkoutAlert_AlertStyle[value];
}

function alertMetricName(value: WorkoutAlert_AlertMetricEnum): string | undefined {
  return WorkoutAlert_AlertMetricEnum[value];
}

/** Domain goal `kind` back to the matrix's goal-type spelling. */
function goalSpecName(kind: string): string | undefined {
  switch (kind) {
    case "open":
      return "OPEN";
    case "distance":
      return "DISTANCE";
    case "time":
      return "TIME";
    case "energy":
      return "ENERGY";
    case "distanceTime":
      return "DISTANCE_TIME";
    default:
      return undefined;
  }
}
