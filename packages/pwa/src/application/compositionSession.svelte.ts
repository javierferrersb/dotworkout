import { parseDistance, parseDuration } from "@dotworkout/domain";
import {
  ACTIVITY_CATALOGUE,
  capabilitiesOf,
  type Activity,
  type ActivityCapabilities,
  type AlertMetric,
} from "../domain/activity.js";
import type { AlertDraft, BlockDraft, BlockKind } from "../domain/block.js";
import {
  isAnswered,
  questionSequence,
  type BlockContext,
  type Question,
  type QuestionId,
} from "../domain/interview.js";
import { inspect, type WorkoutDraft } from "./workoutComposition.js";

export class CompositionSession {
  activity = $state<Activity>(ACTIVITY_CATALOGUE[0]!);
  title = $state("Workout");
  blocks = $state<BlockDraft[]>([]);
  cursor = $state(0);
  focused = $state<QuestionId | undefined>(undefined);
  problem = $state<string | undefined>(undefined);

  capabilities = $derived<ActivityCapabilities>(capabilitiesOf(this.activity));

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
      id === "alert"
        ? { ...this.draft, alertMetric: "NONE", skipped }
        : { ...this.draft, skipped },
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
    this.blocks = this.blocks.filter((_, position) => position !== index);
    this.cursor = Math.min(this.cursor, this.blocks.length);
    this.focused = undefined;
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

function inPerformedOrder(blocks: readonly BlockDraft[]): BlockDraft[] {
  const warmups = blocks.filter((block) => block.kind === "WARMUP");
  const cooldowns = blocks.filter((block) => block.kind === "COOLDOWN");
  const middle = blocks.filter((block) => block.kind !== "WARMUP" && block.kind !== "COOLDOWN");
  return [...warmups, ...middle, ...cooldowns];
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
    case "goal":
      return {
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
      return { ...draft, alertMetric: raw as AlertMetric | "NONE", alert: undefined };
    case "alertValue":
      return { ...draft, alert: buildAlert(draft.alertMetric, raw) };
    case "label":
      return { ...draft, label: raw.trim() };
  }
}

function buildAlert(metric: BlockDraft["alertMetric"], raw: string): AlertDraft {
  const value = Number(raw);
  switch (metric) {
    case "HEART_RATE":
      return { metric: "HEART_RATE", style: "ZONE", zone: value };
    case "SPEED": {
      const seconds = raw.includes(":")
        ? raw.split(":").reduce((total, part) => total * 60 + Number(part), 0)
        : value;
      return { metric: "SPEED", style: "VALUE", metersPerSecond: 1000 / seconds };
    }
    case "CADENCE":
      return { metric: "CADENCE", style: "VALUE", perMinute: value };
    case "POWER":
      return { metric: "POWER", style: "VALUE", watts: value };
    default:
      throw new Error("Choose a target first");
  }
}
