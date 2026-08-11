import type { MessageKey } from "../i18n/messages.js";
import type { Activity, ActivityCapabilities, AlertMetric, GoalKind } from "./activity.js";
import { repeats, type BlockDraft, type BlockKind } from "./block.js";

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

export type ChoiceGroup = "kind" | "goal" | "alert" | "zone";

export interface Choice {
  readonly key: string;
  readonly value: string;
  readonly group: ChoiceGroup;
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
  readonly promptKey: MessageKey;
  readonly noteKey: MessageKey | undefined;
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
    choices.push({ key: "W", value: "WARMUP", group: "kind", caution: false });
  }

  choices.push({ key: "S", value: "INTERVAL", group: "kind", caution: false });
  choices.push({ key: "R", value: "RECOVERY", group: "kind", caution: false });

  const cooldownAvailable = !context.hasCooldown || draft.kind === "COOLDOWN";
  if (cooldownAvailable) {
    choices.push({ key: "C", value: "COOLDOWN", group: "kind", caution: false });
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
      promptKey: "question.kind",
      noteKey: undefined,
      optional: false,
      form: { type: "choice", choices: blockKindChoices(draft, context) },
    },
  ];

  if (draft.kind === undefined) return questions;

  if (draft.kind === "RECOVERY") {
    questions.push({
      id: "duration",
      promptKey: "question.duration",
      noteKey: undefined,
      optional: false,
      form: { type: "duration", placeholder: "1:00" },
    });
    questions.push(labelQuestion(activity));
    return questions;
  }

  questions.push({
    id: "goal",
    promptKey: "question.goal",
    noteKey: undefined,
    optional: false,
    form: {
      type: "choice",
      choices: capabilities.goals.map((goal) => ({
        key: GOAL_KEYS[goal],
        value: goal,
        group: "goal" as const,
        caution: false,
      })),
    },
  });

  if (draft.goalKind === undefined) return questions;

  if (draft.goalKind === "DISTANCE" || draft.goalKind === "DISTANCE_TIME") {
    questions.push({
      id: "distance",
      promptKey: "question.distance",
      noteKey: undefined,
      optional: false,
      form: { type: "distance", unit: activity.defaultDistanceUnit },
    });
  }
  if (draft.goalKind === "TIME") {
    questions.push({
      id: "duration",
      promptKey: "question.duration",
      noteKey: undefined,
      optional: false,
      form: { type: "duration", placeholder: "10:00" },
    });
  }
  if (draft.goalKind === "DISTANCE_TIME") {
    questions.push({
      id: "sendOff",
      promptKey: "question.sendOff",
      noteKey: "question.sendOff.note",
      optional: false,
      form: { type: "duration", placeholder: "1:00" },
    });
  }

  if (repeats(draft)) {
    questions.push({
      id: "repetitions",
      promptKey: "question.repetitions",
      noteKey: undefined,
      optional: false,
      form: { type: "count", placeholder: "8" },
    });
    questions.push({
      id: "recovery",
      promptKey: "question.recovery",
      noteKey: undefined,
      optional: true,
      form: { type: "duration", placeholder: "0:20" },
    });
  }

  questions.push(alertQuestion(capabilities));

  if (draft.alertMetric !== undefined && draft.alertMetric !== "NONE") {
    questions.push(alertValueQuestion(draft.alertMetric, activity));
  }

  if (draft.kind === "INTERVAL") questions.push(labelQuestion(activity));
  return questions;
}

function alertQuestion(capabilities: ActivityCapabilities): Question {
  const offered = capabilities.alerts.map((metric) => ({
    key: ALERT_KEYS[metric],
    value: metric,
    group: "alert" as const,
    caution: false,
  }));
  const unverified = capabilities.unverifiedAlerts.map((metric) => ({
    key: ALERT_KEYS[metric],
    value: metric,
    group: "alert" as const,
    caution: true,
  }));

  return {
    id: "alert",
    promptKey: "question.alert",
    noteKey: undefined,
    optional: true,
    form: {
      type: "choice",
      choices: [
        { key: "N", value: "NONE", group: "alert" as const, caution: false },
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
      promptKey: "question.zone",
      noteKey: "question.zone.note",
      optional: false,
      form: {
        type: "choice",
        choices: [1, 2, 3, 4, 5].map((zone) => ({
          key: String(zone),
          value: String(zone),
          group: "zone" as const,
          caution: false,
        })),
      },
    };
  }
  if (metric === "SPEED") {
    const running = activity.id === "RUNNING";
    return {
      id: "alertValue",
      promptKey: running ? "question.pace" : "question.speed",
      noteKey: running ? "question.pace.note" : "question.speed.note",
      optional: false,
      form: { type: "duration", placeholder: running ? "5:00" : "25" },
    };
  }
  return {
    id: "alertValue",
    promptKey: metric === "POWER" ? "question.watts" : "question.cadence",
    noteKey: undefined,
    optional: false,
    form: { type: "count", placeholder: metric === "POWER" ? "250" : "90" },
  };
}

function labelQuestion(activity: Activity): Question {
  const swimming = activity.id === "SWIMMING";
  return {
    id: "label",
    promptKey: "question.label",
    noteKey: swimming ? "question.label.note" : undefined,
    optional: true,
    form: {
      type: "text",
      suggestions: swimming ? STROKE_SUGGESTIONS : EFFORT_SUGGESTIONS,
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

export type { BlockKind };
