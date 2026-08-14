import { formatDistance, formatDuration } from "@dotworkout/domain";
import type { AlertMetric, GoalKind } from "../domain/activity.js";
import type { BlockDraft, BlockKind } from "../domain/block.js";
import type { Choice, Question, QuestionId } from "../domain/interview.js";
import { t } from "./locale.svelte.js";
import type { MessageKey } from "./messages.js";

export function activityName(id: string): string {
  return t(`activity.${id}` as MessageKey);
}

export function blockKindName(kind: BlockKind): string {
  return t(`kind.${kind}` as MessageKey);
}

export function goalName(kind: GoalKind): string {
  return t(`goal.${kind}` as MessageKey);
}

export function alertName(metric: AlertMetric | "NONE", activityId: string): string {
  if (metric === "SPEED") {
    return activityId === "RUNNING" ? t("alert.SPEED.pace") : t("alert.SPEED.speed");
  }
  return t(`alert.${metric}` as MessageKey);
}

export function questionText(question: Question): string {
  return t(question.promptKey);
}

export function questionNote(question: Question): string | undefined {
  return question.noteKey === undefined ? undefined : t(question.noteKey);
}

export function choiceText(choice: Choice, activityId: string): string {
  if (choice.group === "kind") return blockKindName(choice.value as BlockKind);
  if (choice.group === "goal") return goalName(choice.value as GoalKind);
  if (choice.group === "alert") return alertName(choice.value as AlertMetric | "NONE", activityId);
  if (choice.group === "zone") return t("alert.zone", { n: choice.value });
  if (choice.group === "reading") return t(`reading.${choice.value}` as MessageKey);
  if (choice.group === "style") return t(`style.${choice.value}` as MessageKey);
  return choice.value;
}

export function choiceKey(choice: Choice, activityId: string): string {
  if (choice.group === "zone") return choice.value;
  if (choice.group === "alert" && choice.value === "SPEED") {
    return activityId === "RUNNING" ? t("alertKey.SPEED.pace") : t("alertKey.SPEED.speed");
  }
  const prefix =
    choice.group === "kind"
      ? "kindKey"
      : choice.group === "goal"
        ? "goalKey"
        : choice.group === "reading"
          ? "readingKey"
          : choice.group === "style"
            ? "styleKey"
            : "alertKey";
  return t(`${prefix}.${choice.value}` as MessageKey);
}

export function alertSummary(draft: BlockDraft): string {
  const alert = draft.alert;
  if (alert === undefined) return "";
  switch (alert.metric) {
    case "HEART_RATE":
      return alert.style === "ZONE"
        ? t("alert.zone", { n: alert.zone })
        : t("alert.bpm", { from: alert.from, to: alert.to });
    case "SPEED":
      return alert.style === "VALUE"
        ? t("alert.mps", { value: alert.metersPerSecond.toFixed(2) })
        : t("alert.mpsRange", {
            from: alert.slower.toFixed(2),
            to: alert.faster.toFixed(2),
          });
    case "CADENCE":
      return alert.style === "VALUE"
        ? t("alert.spm", { value: alert.perMinute })
        : t("alert.spmRange", { from: alert.from, to: alert.to });
    case "POWER":
      return alert.style === "VALUE"
        ? t("alert.watts", { value: alert.watts })
        : t("alert.wattsRange", { from: alert.from, to: alert.to });
  }
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function answerLabel(draft: BlockDraft, id: QuestionId, activityId: string): string {
  switch (id) {
    case "kind":
      return draft.kind === undefined ? "" : blockKindName(draft.kind);
    case "goal":
      return draft.goalKind === undefined ? "" : goalName(draft.goalKind);
    case "distance":
      return draft.distance === undefined ? "" : formatDistance(draft.distance);
    case "duration":
      return draft.duration === undefined ? "" : formatDuration(draft.duration);
    case "sendOff":
      return draft.sendOff === undefined ? "" : formatDuration(draft.sendOff);
    case "repetitions":
      return draft.repetitions === undefined ? "" : `${draft.repetitions}`;
    case "recovery":
      return draft.recovery === undefined ? t("alert.NONE") : formatDuration(draft.recovery);
    case "alert":
      return alertName(draft.alertMetric ?? "NONE", activityId);
    case "alertReading":
      return draft.alertReading === undefined
        ? ""
        : t(`reading.${draft.alertReading}` as MessageKey);
    case "alertStyle":
      return draft.alertStyle === undefined ? "" : t(`style.${draft.alertStyle}` as MessageKey);
    case "alertFrom":
      return draft.alertFrom === undefined ? "" : `${round(draft.alertFrom)}`;
    case "alertValue":
      return alertSummary(draft);
    case "label":
      return draft.label === undefined || draft.label === "" ? t("rail.untitled") : draft.label;
  }
}

export function blockSummary(draft: BlockDraft): string {
  const parts: string[] = [];
  if (draft.repetitions !== undefined && draft.repetitions > 1) parts.push(`${draft.repetitions}×`);
  if (draft.distance !== undefined) parts.push(formatDistance(draft.distance));
  if (draft.duration !== undefined) parts.push(formatDuration(draft.duration));
  if (draft.goalKind === "OPEN") parts.push(goalName("OPEN").toLowerCase());
  if (draft.sendOff !== undefined) parts.push(`↻ ${formatDuration(draft.sendOff)}`);
  if (draft.recovery !== undefined) parts.push(`+ ${formatDuration(draft.recovery)}`);
  return parts.join(" ");
}

export function blockHeading(draft: BlockDraft, index: number): string {
  if (draft.label !== undefined && draft.label !== "") return draft.label;
  if (draft.kind !== undefined && draft.kind !== "INTERVAL") return blockKindName(draft.kind);
  return t("block.untitled", { index: index + 1 });
}
