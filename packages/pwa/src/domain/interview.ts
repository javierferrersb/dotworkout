import { formatDistance, formatDuration } from "@dotworkout/domain";
import {
  alertTitle,
  goalTitle,
  type Activity,
  type ActivityCapabilities,
  type AlertMetric,
  type GoalKind,
} from "./activity.js";
import { blockKindTitle, repeats, type BlockDraft, type BlockKind } from "./block.js";

export type QuestionId =
  | "kind"
  | "goal"
  | "distance"
  | "duration"
  | "sendOff"
  | "repetitions"
  | "recovery"
  | "alert"
  | "alertValue"
  | "label";

export interface Choice {
  readonly key: string;
  readonly value: string;
  readonly title: string;
  readonly caution: boolean;
}

export type QuestionForm =
  | { readonly type: "choice"; readonly choices: readonly Choice[] }
  | { readonly type: "distance"; readonly unit: string }
  | { readonly type: "duration"; readonly placeholder: string }
  | { readonly type: "count"; readonly placeholder: string }
  | { readonly type: "text"; readonly suggestions: readonly string[] };

export interface Question {
  readonly id: QuestionId;
  readonly prompt: string;
  readonly note: string | undefined;
  readonly optional: boolean;
  readonly form: QuestionForm;
}

export interface BlockContext {
  readonly hasWarmup: boolean;
  readonly hasCooldown: boolean;
  readonly position: number;
}

const STROKE_SUGGESTIONS = ["Free", "Back", "Breast", "Fly", "IM", "Kick", "Drill", "Pull", "Build"];
const EFFORT_SUGGESTIONS = ["Easy", "Steady", "Tempo", "Threshold", "Hard", "Sprint", "Recovery"];

const GOAL_KEYS: Record<GoalKind, string> = {
  DISTANCE: "D",
  DISTANCE_TIME: "S",
  TIME: "T",
  OPEN: "O",
};

const ALERT_KEYS: Record<AlertMetric, string> = {
  HEART_RATE: "H",
  SPEED: "P",
  CADENCE: "C",
  POWER: "W",
};

function blockKindChoices(draft: BlockDraft, context: BlockContext): readonly Choice[] {
  const choices: Choice[] = [];

  const warmupAvailable = !context.hasWarmup || draft.kind === "WARMUP";
  if (warmupAvailable && context.position === 0) {
    choices.push({ key: "W", value: "WARMUP", title: "Warm up", caution: false });
  }

  choices.push({ key: "S", value: "INTERVAL", title: "Set", caution: false });
  choices.push({ key: "R", value: "RECOVERY", title: "Rest", caution: false });

  const cooldownAvailable = !context.hasCooldown || draft.kind === "COOLDOWN";
  if (cooldownAvailable) {
    choices.push({ key: "C", value: "COOLDOWN", title: "Cool down", caution: false });
  }

  return choices;
}

export function questionSequence(
  draft: BlockDraft,
  activity: Activity,
  capabilities: ActivityCapabilities,
  context: BlockContext,
): readonly Question[] {
  const questions: Question[] = [
    {
      id: "kind",
      prompt: "What are you adding?",
      note: undefined,
      optional: false,
      form: { type: "choice", choices: blockKindChoices(draft, context) },
    },
  ];

  if (draft.kind === undefined) return questions;

  if (draft.kind === "RECOVERY") {
    questions.push({
      id: "duration",
      prompt: "How long?",
      note: undefined,
      optional: false,
      form: { type: "duration", placeholder: "1:00" },
    });
    questions.push(labelQuestion(activity));
    return questions;
  }

  questions.push({
    id: "goal",
    prompt: "Measured by",
    note: undefined,
    optional: false,
    form: {
      type: "choice",
      choices: capabilities.goals.map((goal) => ({
        key: GOAL_KEYS[goal],
        value: goal,
        title: goalTitle(goal),
        caution: false,
      })),
    },
  });

  if (draft.goalKind === undefined) return questions;

  if (draft.goalKind === "DISTANCE" || draft.goalKind === "DISTANCE_TIME") {
    questions.push({
      id: "distance",
      prompt: "How far?",
      note: undefined,
      optional: false,
      form: { type: "distance", unit: activity.defaultDistanceUnit },
    });
  }
  if (draft.goalKind === "TIME") {
    questions.push({
      id: "duration",
      prompt: "How long?",
      note: undefined,
      optional: false,
      form: { type: "duration", placeholder: "10:00" },
    });
  }
  if (draft.goalKind === "DISTANCE_TIME") {
    questions.push({
      id: "sendOff",
      prompt: "Leave every",
      note: "The next rep starts on this clock, however fast you finish",
      optional: false,
      form: { type: "duration", placeholder: "1:00" },
    });
  }

  if (repeats(draft)) {
    questions.push({
      id: "repetitions",
      prompt: "How many?",
      note: undefined,
      optional: false,
      form: { type: "count", placeholder: "8" },
    });
    questions.push({
      id: "recovery",
      prompt: "Rest between",
      note: undefined,
      optional: true,
      form: { type: "duration", placeholder: "0:20" },
    });
  }

  questions.push(alertQuestion(activity, capabilities));

  if (draft.alertMetric !== undefined && draft.alertMetric !== "NONE") {
    questions.push(alertValueQuestion(draft.alertMetric, activity));
  }

  if (draft.kind === "INTERVAL") questions.push(labelQuestion(activity));
  return questions;
}

function alertQuestion(activity: Activity, capabilities: ActivityCapabilities): Question {
  const offered = capabilities.alerts.map((metric) => ({
    key: ALERT_KEYS[metric],
    value: metric,
    title: alertTitle(metric, activity),
    caution: false,
  }));
  const unverified = capabilities.unverifiedAlerts.map((metric) => ({
    key: ALERT_KEYS[metric],
    value: metric,
    title: alertTitle(metric, activity),
    caution: true,
  }));

  return {
    id: "alert",
    prompt: "Keep me at",
    note: undefined,
    optional: true,
    form: {
      type: "choice",
      choices: [
        { key: "N", value: "NONE", title: "No target", caution: false },
        ...offered,
        ...unverified,
      ],
    },
  };
}

function alertValueQuestion(metric: AlertMetric, activity: Activity): Question {
  if (metric === "HEART_RATE") {
    return {
      id: "alertValue",
      prompt: "Which zone?",
      note: "Zone limits come from your own heart-rate data on the Watch",
      optional: false,
      form: {
        type: "choice",
        choices: [1, 2, 3, 4, 5].map((zone) => ({
          key: String(zone),
          value: String(zone),
          title: `Zone ${zone}`,
          caution: false,
        })),
      },
    };
  }
  if (metric === "SPEED") {
    return {
      id: "alertValue",
      prompt: activity.id === "RUNNING" ? "Target pace" : "Target speed",
      note: activity.id === "RUNNING" ? "Per kilometre" : "Kilometres per hour",
      optional: false,
      form: { type: "duration", placeholder: activity.id === "RUNNING" ? "5:00" : "25" },
    };
  }
  return {
    id: "alertValue",
    prompt: metric === "POWER" ? "Target watts" : "Target cadence",
    note: undefined,
    optional: false,
    form: { type: "count", placeholder: metric === "POWER" ? "250" : "90" },
  };
}

function labelQuestion(activity: Activity): Question {
  return {
    id: "label",
    prompt: "Name it",
    note: activity.id === "SWIMMING" ? "Stroke, equipment, or how it should feel" : undefined,
    optional: true,
    form: {
      type: "text",
      suggestions: activity.id === "SWIMMING" ? STROKE_SUGGESTIONS : EFFORT_SUGGESTIONS,
    },
  };
}

export function isAnswered(draft: BlockDraft, id: QuestionId): boolean {
  if (draft.skipped?.includes(id) === true) return true;
  switch (id) {
    case "kind":
      return draft.kind !== undefined;
    case "goal":
      return draft.goalKind !== undefined;
    case "distance":
      return draft.distance !== undefined;
    case "duration":
      return draft.duration !== undefined;
    case "sendOff":
      return draft.sendOff !== undefined;
    case "repetitions":
      return draft.repetitions !== undefined;
    case "recovery":
      return draft.recovery !== undefined;
    case "alert":
      return draft.alertMetric !== undefined;
    case "alertValue":
      return draft.alert !== undefined;
    case "label":
      return draft.label !== undefined;
  }
}

export function answerText(draft: BlockDraft, id: QuestionId, activity: Activity): string {
  switch (id) {
    case "kind":
      return draft.kind === undefined ? "" : blockKindTitle(draft.kind);
    case "goal":
      return draft.goalKind === undefined ? "" : goalTitle(draft.goalKind);
    case "distance":
      return draft.distance === undefined ? "" : formatDistance(draft.distance);
    case "duration":
      return draft.duration === undefined ? "" : formatDuration(draft.duration);
    case "sendOff":
      return draft.sendOff === undefined ? "" : formatDuration(draft.sendOff);
    case "repetitions":
      return draft.repetitions === undefined ? "" : `${draft.repetitions}`;
    case "recovery":
      return draft.recovery === undefined ? "none" : formatDuration(draft.recovery);
    case "alert":
      return draft.alertMetric === undefined || draft.alertMetric === "NONE"
        ? "No target"
        : alertTitle(draft.alertMetric, activity);
    case "alertValue":
      return describeAlert(draft);
    case "label":
      return draft.label === undefined || draft.label === "" ? "unnamed" : draft.label;
  }
}

export function rawAnswer(draft: BlockDraft, id: QuestionId): string | undefined {
  switch (id) {
    case "kind":
      return draft.kind;
    case "goal":
      return draft.goalKind;
    case "distance":
      return draft.distance === undefined ? undefined : String(draft.distance.value);
    case "duration":
      return draft.duration === undefined ? undefined : String(draft.duration.value);
    case "sendOff":
      return draft.sendOff === undefined ? undefined : String(draft.sendOff.value);
    case "repetitions":
      return draft.repetitions === undefined ? undefined : String(draft.repetitions);
    case "recovery":
      return draft.recovery === undefined ? undefined : String(draft.recovery.value);
    case "alert":
      return draft.alertMetric;
    case "alertValue":
      return draft.alert?.metric === "HEART_RATE" && draft.alert.style === "ZONE"
        ? String(draft.alert.zone)
        : undefined;
    case "label":
      return draft.label;
  }
}

export function describeAlert(draft: BlockDraft): string {
  const alert = draft.alert;
  if (alert === undefined) return "";
  if (alert.metric === "HEART_RATE" && alert.style === "ZONE") return `Zone ${alert.zone}`;
  if (alert.metric === "HEART_RATE") return `${alert.from}–${alert.to} bpm`;
  if (alert.metric === "SPEED") return `${alert.metersPerSecond.toFixed(2)} m/s`;
  if (alert.metric === "CADENCE") return `${alert.perMinute} spm`;
  return `${alert.watts} W`;
}

export function summarise(draft: BlockDraft): string {
  const parts: string[] = [];
  if (draft.repetitions !== undefined && draft.repetitions > 1) parts.push(`${draft.repetitions}×`);
  if (draft.distance !== undefined) parts.push(formatDistance(draft.distance));
  if (draft.duration !== undefined) parts.push(formatDuration(draft.duration));
  if (draft.goalKind === "OPEN") parts.push("open");
  if (draft.sendOff !== undefined) parts.push(`on ${formatDuration(draft.sendOff)}`);
  if (draft.recovery !== undefined) parts.push(`rest ${formatDuration(draft.recovery)}`);
  return parts.join(" ");
}

export function blockTitle(draft: BlockDraft, index: number): string {
  if (draft.label !== undefined && draft.label !== "") return draft.label;
  if (draft.kind !== undefined && draft.kind !== "INTERVAL") return blockKindTitle(draft.kind);
  return `Block ${index + 1}`;
}

export type { BlockKind };
