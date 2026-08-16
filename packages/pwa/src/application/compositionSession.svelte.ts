import {
  paceToMetersPerSecond,
  parseDistance,
  parseDuration,
  speedToMetersPerSecond,
} from "@dotworkout/domain";
import {
  ACTIVITY_CATALOGUE,
  alertShapeOf,
  capabilitiesOf,
  type Activity,
  type ActivityCapabilities,
  type AlertMetric,
  type AlertReading,
  type AlertStyle,
} from "../domain/activity.js";
import type { AlertDraft, BlockDraft, BlockKind } from "../domain/block.js";
import {
  isAnswered,
  questionSequence,
  unfinishedBlocks,
  type BlockContext,
  type Question,
  type QuestionId,
  type Unfinished,
} from "../domain/interview.js";
import { cursorAfterRemoval, inPerformedOrder, isPinned, moved } from "../domain/order.js";
import { activityName } from "../i18n/format.js";
import { inspect, type WorkoutDraft } from "./workoutComposition.js";

export class CompositionSession {
  activity = $state<Activity>(ACTIVITY_CATALOGUE[0]!);
  title = $state("Workout");
  blocks = $state<BlockDraft[]>([]);
  cursor = $state(0);
  focused = $state<QuestionId | undefined>(undefined);
  problem = $state<string | undefined>(undefined);

  capabilities = $derived<ActivityCapabilities>(capabilitiesOf(this.activity));

  activityName = $derived(activityName(this.activity.id));

  draft = $derived<BlockDraft>(this.blocks[this.cursor] ?? {});

  composingNew = $derived<boolean>(this.cursor >= this.blocks.length);

  context = $derived<BlockContext>({
    hasWarmup: this.blocks.some((block, index) => block.kind === "WARMUP" && index !== this.cursor),
    hasCooldown: this.blocks.some(
      (block, index) => block.kind === "COOLDOWN" && index !== this.cursor,
    ),
    position: this.cursor,
  });

  questions = $derived<readonly Question[]>(
    questionSequence(this.draft, this.activity, this.capabilities, this.context),
  );

  current = $derived<Question | undefined>(
    this.focused === undefined
      ? this.questions.find((question) => !isAnswered(this.draft, question.id))
      : this.questions.find((question) => question.id === this.focused),
  );

  answered = $derived<readonly Question[]>(
    this.questions.filter(
      (question) => isAnswered(this.draft, question.id) && question.id !== this.current?.id,
    ),
  );

  upcoming = $derived<readonly Question[]>(
    this.questions.filter(
      (question) => !isAnswered(this.draft, question.id) && question.id !== this.current?.id,
    ),
  );

  workout = $derived<WorkoutDraft>({
    title: this.title,
    activity: this.activity,
    blocks: this.blocks.filter((block) => block.kind !== undefined),
  });

  preview = $derived(inspect(this.workout));

  unfinished = $derived<readonly Unfinished[]>(
    unfinishedBlocks(this.blocks, this.activity, this.capabilities),
  );

  complete = $derived<boolean>(
    this.questions.every((question) => question.optional || isAnswered(this.draft, question.id)),
  );

  snapshot = $derived({
    activityId: this.activity.id,
    title: this.title,
    blocks: this.blocks,
    cursor: this.cursor,
  });

  chooseActivity(activity: Activity): void {
    this.activity = activity;
    this.blocks = [];
    this.cursor = 0;
    this.focused = undefined;
  }

  restore(activity: Activity, title: string, blocks: readonly BlockDraft[], cursor: number): void {
    this.activity = activity;
    this.title = title;
    this.blocks = [...blocks];
    this.cursor = Math.min(Math.max(0, cursor), blocks.length);
    this.focused = undefined;
    this.problem = undefined;
  }

  answer(id: QuestionId, raw: string): void {
    this.problem = undefined;
    try {
      this.write(applyAnswer(this.draft, id, raw, this.activity));
      this.focused = undefined;
    } catch (error) {
      this.problem = error instanceof Error ? error.message : String(error);
    }
  }

  skip(id: QuestionId): void {
    this.problem = undefined;
    const skipped = [...(this.draft.skipped ?? []), id];
    this.write(
      id === "alert" ? { ...this.draft, alertMetric: "NONE", skipped } : { ...this.draft, skipped },
    );
    this.focused = undefined;
  }

  focus(id: QuestionId): void {
    this.focused = id;
    this.problem = undefined;
  }

  previousQuestion(): void {
    const order = this.questions;
    const at = order.findIndex((question) => question.id === this.current?.id);
    const previous = order[at <= 0 ? 0 : at - 1];
    if (previous !== undefined) this.focus(previous.id);
  }

  nextQuestion(): void {
    const order = this.questions;
    const at = order.findIndex((question) => question.id === this.current?.id);
    const next = order[at + 1];
    if (next !== undefined) this.focus(next.id);
  }

  commitBlock(): void {
    if (!this.complete) return;
    if (this.composingNew) this.blocks = [...this.blocks, this.draft];
    this.cursor = this.blocks.length;
    this.focused = undefined;
    this.problem = undefined;
  }

  goToBlock(index: number): void {
    if (index < 0 || index > this.blocks.length) return;
    this.cursor = index;
    this.problem = undefined;

    const target = this.blocks[index];
    if (target === undefined) {
      this.focused = undefined;
      return;
    }
    const order = questionSequence(target, this.activity, this.capabilities, {
      hasWarmup: this.blocks.some((block, at) => block.kind === "WARMUP" && at !== index),
      hasCooldown: this.blocks.some((block, at) => block.kind === "COOLDOWN" && at !== index),
      position: index,
    });
    const pending = order.find((question) => !isAnswered(target, question.id));
    this.focused = pending?.id ?? order[order.length - 1]?.id;
  }

  previousBlock(): void {
    this.goToBlock(Math.max(0, this.cursor - 1));
  }

  nextBlock(): void {
    this.goToBlock(Math.min(this.blocks.length, this.cursor + 1));
  }

  startNewBlock(): void {
    this.goToBlock(this.blocks.length);
  }

  removeBlock(index: number): void {
    if (this.blocks[index] === undefined) return;

    const remaining = this.blocks.filter((_, position) => position !== index);
    this.blocks = remaining;
    this.cursor = cursorAfterRemoval(this.cursor, index, remaining.length);
    this.focused = undefined;
    this.problem = undefined;
  }

  canDuplicate(index: number): boolean {
    return !isPinned(this.blocks[index]);
  }

  canReorder(index: number): boolean {
    return !isPinned(this.blocks[index]);
  }

  canMoveUp(index: number): boolean {
    return this.canReorder(index) && !isPinned(this.blocks[index - 1]);
  }

  canMoveDown(index: number): boolean {
    return this.canReorder(index) && !isPinned(this.blocks[index + 1]);
  }

  duplicateBlock(index: number): void {
    if (!this.canDuplicate(index)) return;
    const block = this.blocks[index];
    if (block === undefined) return;

    const copy = { ...block };
    this.settle([...this.blocks.slice(0, index + 1), copy, ...this.blocks.slice(index + 1)], copy);
  }

  moveBlock(from: number, to: number): void {
    const block = this.blocks[from];
    if (block === undefined || from === to) return;
    this.settle(moved(this.blocks, from, to), block);
  }

  private settle(blocks: readonly BlockDraft[], follow: BlockDraft): void {
    const ordered = inPerformedOrder(blocks);
    this.blocks = ordered;
    this.cursor = ordered.indexOf(follow);
    this.focused = undefined;
    this.problem = undefined;
  }

  deselect(): void {
    this.focused = undefined;
    this.problem = undefined;
  }

  private write(next: BlockDraft): void {
    const updated = this.composingNew
      ? [...this.blocks, next]
      : this.blocks.map((block, index) => (index === this.cursor ? next : block));
    const settled = inPerformedOrder(updated);
    this.blocks = settled;
    this.cursor = settled.indexOf(next);
  }
}

function applyAnswer(
  draft: BlockDraft,
  id: QuestionId,
  raw: string,
  activity: Activity,
): BlockDraft {
  switch (id) {
    case "kind":
      return draft.kind === raw ? draft : { kind: raw as BlockKind, label: draft.label };
    // Changing the goal drops the measurements taken under the old one, which
    // means confirming the goal you already had must be a no-op — otherwise
    // reopening a finished block to look at it throws its numbers away.
    case "goal":
      return draft.goalKind === raw
        ? draft
        : {
            ...draft,
            goalKind: raw as BlockDraft["goalKind"],
            distance: undefined,
            duration: undefined,
            sendOff: undefined,
          };
    case "distance":
      return { ...draft, distance: parseDistance(raw, activity.defaultDistanceUnit) };
    case "duration":
      return { ...draft, duration: parseDuration(raw) };
    case "sendOff":
      return { ...draft, sendOff: parseDuration(raw) };
    case "repetitions": {
      const value = Number(raw);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("Give a whole number of reps, 1 or more");
      }
      return { ...draft, repetitions: value };
    }
    case "recovery":
      return { ...draft, recovery: parseDuration(raw) };
    case "alert":
      return draft.alertMetric === raw
        ? draft
        : {
            ...draft,
            alertMetric: raw as AlertMetric | "NONE",
            alertReading: undefined,
            alertStyle: undefined,
            alertFrom: undefined,
            alert: undefined,
          };
    case "alertReading":
      return draft.alertReading === raw
        ? draft
        : { ...draft, alertReading: raw as AlertReading, alert: undefined };
    case "alertStyle":
      return draft.alertStyle === raw
        ? draft
        : {
            ...draft,
            alertStyle: raw as AlertStyle,
            alertFrom: undefined,
            alert: undefined,
          };
    case "alertFrom":
      return {
        ...draft,
        alertFrom: boundValue(draft.alertMetric, raw, activity),
        alert: undefined,
      };
    case "alertValue":
      return { ...draft, alert: buildAlert(draft, raw, activity) };
    case "label":
      return { ...draft, label: raw.trim() };
  }
}

/**
 * Running enters a pace — minutes per kilometre — and everything else enters
 * the number it is displayed as. Both end up as metres per second.
 */
function boundValue(metric: BlockDraft["alertMetric"], raw: string, activity: Activity): number {
  if (metric !== "SPEED") return Number(raw);
  return activity.sport === "RUNNING"
    ? paceToMetersPerSecond(raw)
    : speedToMetersPerSecond(Number(raw));
}

function buildAlert(draft: BlockDraft, raw: string, activity: Activity): AlertDraft {
  const metric = draft.alertMetric;
  if (metric === undefined || metric === "NONE") throw new Error("Choose a target first");

  const shape = alertShapeOf(metric);
  const style = (shape.styles.length > 1 ? draft.alertStyle : shape.styles[0]) ?? "VALUE";
  const reading = draft.alertReading ?? "current";
  const value = boundValue(metric, raw, activity);

  if (style === "ZONE") return { metric: "HEART_RATE", style: "ZONE", zone: Number(raw) };

  if (style === "RANGE") {
    const other = draft.alertFrom;
    if (other === undefined) throw new Error("Give the other end of the range first");
    const low = Math.min(other, value);
    const high = Math.max(other, value);

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

  switch (metric) {
    case "HEART_RATE":
      return { metric, style: "ZONE", zone: Number(raw) };
    case "SPEED":
      return { metric, style: "VALUE", metersPerSecond: value, reading };
    case "CADENCE":
      return { metric, style: "VALUE", perMinute: value };
    case "POWER":
      return { metric, style: "VALUE", watts: value, reading };
  }
}
