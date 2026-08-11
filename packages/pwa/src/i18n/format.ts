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
  return choice.value;
}

export function choiceKey(choice: Choice, activityId: string): string {
  if (choice.group === "zone") return choice.value;
  if (choice.group === "alert" && choice.value === "SPEED") {
    return activityId === "RUNNING" ? t("alertKey.SPEED.pace") : t("alertKey.SPEED.speed");
  }
  const prefix = choice.group === "kind" ? "kindKey" : choice.group === "goal" ? "goalKey" : "alertKey";
  return t(`${prefix}.${choice.value}` as MessageKey);
}

export function alertSummary(draft: BlockDraft): string {
  const alert = draft.alert;
  if (alert === undefined) return "";
  if (alert.metric === "HEART_RATE" && alert.style === "ZONE") {
    return t("alert.zone", { n: alert.zone });
  }
  if (alert.metric === "HEART_RATE") return t("alert.bpm", { from: alert.from, to: alert.to });
  if (alert.metric === "SPEED") return t("alert.mps", { value: alert.metersPerSecond.toFixed(2) });
  if (alert.metric === "CADENCE") return t("alert.spm", { value: alert.perMinute });
  return t("alert.watts", { value: alert.watts });
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
