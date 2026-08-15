import { formatDistance, formatDuration, showsPace } from "@dotworkout/domain";
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

export function alertName(metric: AlertMetric | "NONE", sport: string): string {
  if (metric === "SPEED") {
    return showsPace(sport) ? t("alert.SPEED.pace") : t("alert.SPEED.speed");
  }
  return t(`alert.${metric}` as MessageKey);
}

export function questionText(question: Question): string {
  return t(question.promptKey);
}

export function questionNote(question: Question): string | undefined {
  return question.noteKey === undefined ? undefined : t(question.noteKey);
}

export function choiceText(choice: Choice, sport: string): string {
  if (choice.group === "kind") return blockKindName(choice.value as BlockKind);
  if (choice.group === "goal") return goalName(choice.value as GoalKind);
  if (choice.group === "alert") return alertName(choice.value as AlertMetric | "NONE", sport);
  if (choice.group === "zone") return t("alert.zone", { n: choice.value });
  if (choice.group === "reading") return t(`reading.${choice.value}` as MessageKey);
  if (choice.group === "style") return t(`style.${choice.value}` as MessageKey);
  return choice.value;
}

export function choiceKey(choice: Choice, sport: string): string {
  if (choice.group === "zone") return choice.value;
  if (choice.group === "alert" && choice.value === "SPEED") {
    return showsPace(sport) ? t("alertKey.SPEED.pace") : t("alertKey.SPEED.speed");
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

/** Metres per second as minutes and seconds per kilometre. */
export function formatPace(metersPerSecond: number): string {
  const seconds = Math.round(1000 / metersPerSecond);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return Number.isInteger(kmh) ? String(kmh) : kmh.toFixed(1);
}

export function alertSummary(draft: BlockDraft, sport: string): string {
  const alert = draft.alert;
  if (alert === undefined) return "";
  const pace = showsPace(sport);
  switch (alert.metric) {
    case "HEART_RATE":
      return alert.style === "ZONE"
        ? t("alert.zone", { n: alert.zone })
        : t("alert.bpm", { from: alert.from, to: alert.to });
    case "SPEED":
      if (alert.style === "VALUE") {
        return pace
          ? t("alert.pace", { value: formatPace(alert.metersPerSecond) })
          : t("alert.speed", { value: formatSpeed(alert.metersPerSecond) });
      }
      return pace
        ? t("alert.paceRange", {
            from: formatPace(alert.faster),
            to: formatPace(alert.slower),
          })
        : t("alert.speedRange", {
            from: formatSpeed(alert.slower),
            to: formatSpeed(alert.faster),
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

export function answerLabel(draft: BlockDraft, id: QuestionId, sport: string): string {
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
      return alertName(draft.alertMetric ?? "NONE", sport);
    case "alertReading":
      return draft.alertReading === undefined
        ? ""
        : t(`reading.${draft.alertReading}` as MessageKey);
    case "alertStyle":
      return draft.alertStyle === undefined ? "" : t(`style.${draft.alertStyle}` as MessageKey);
    case "alertFrom": {
      if (draft.alertFrom === undefined) return "";
      if (draft.alertMetric !== "SPEED") return round(draft.alertFrom);
      return showsPace(sport)
        ? formatPace(draft.alertFrom)
        : `${(draft.alertFrom * 3.6).toFixed(1)}`;
    }
    case "alertValue":
      return alertSummary(draft, sport);
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
