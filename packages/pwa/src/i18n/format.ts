import { formatDistance, showsPace } from "@dotworkout/domain";
import { durationText } from "../application/stepEdit.js";
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

/** The key that picks a choice when its field has focus: a letter, or the zone's own number. */
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

/** What a step is, as the line reads: "8 × 400 m", "10:00", "Open". Empty until it is measured. */
export function stepMeasure(draft: BlockDraft): string {
  if (draft.kind === "RECOVERY") return durationText(draft.duration);
  if (draft.goalKind === "OPEN") return goalName("OPEN");
  const measure =
    draft.distance !== undefined ? formatDistance(draft.distance) : durationText(draft.duration);
  if (measure === "") return "";
  const reps = draft.kind === "INTERVAL" ? (draft.repetitions ?? 1) : 1;
  return reps > 1 ? `${reps} × ${measure}` : measure;
}

/** Everything else about a step, quieter: the clock, the rest, the target, the name. */
export function stepDetails(draft: BlockDraft, sport: string): string {
  const parts: string[] = [];
  if (draft.sendOff !== undefined) parts.push(t("step.on", { time: durationText(draft.sendOff) }));
  if (draft.recovery !== undefined) {
    parts.push(t("step.rest", { time: durationText(draft.recovery) }));
  }
  const target = alertSummary(draft, sport);
  if (target !== "") parts.push(target);
  if (draft.label !== undefined && draft.label !== "") parts.push(draft.label);
  return parts.join(" · ");
}

export function targetUnit(metric: AlertMetric, sport: string): string {
  switch (metric) {
    case "HEART_RATE":
      return t("unit.bpm");
    case "CADENCE":
      return t("unit.spm");
    case "POWER":
      return t("unit.watts");
    case "SPEED":
      return showsPace(sport) ? t("unit.pace") : t("unit.speed");
  }
}

/** The label a field carries in the step editor, and the name a missing one goes by. */
export function fieldName(id: QuestionId, draft: BlockDraft, sport: string): string {
  switch (id) {
    case "kind":
      return t("field.kind");
    case "goal":
      return t("field.goal");
    case "distance":
      return t("field.distance");
    case "duration":
      return t("field.duration");
    case "sendOff":
      return t("question.sendOff");
    case "repetitions":
      return t("field.repetitions");
    case "recovery":
      return t("question.recovery");
    case "alert":
      return t("field.alert");
    case "alertReading":
      return t("field.reading");
    case "alertStyle":
      return t("field.style");
    case "alertFrom":
    case "alertValue": {
      const metric = draft.alertMetric;
      if (metric === undefined || metric === "NONE") return t("field.alert");
      if (
        metric === "HEART_RATE" &&
        draft.alert?.style !== "RANGE" &&
        draft.alertStyle !== "RANGE"
      ) {
        return t("field.zone");
      }
      return alertName(metric, sport);
    }
    case "label":
      return t("field.label");
  }
}
