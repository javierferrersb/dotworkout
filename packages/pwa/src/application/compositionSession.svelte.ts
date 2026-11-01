import {
  ACTIVITY_CATALOGUE,
  capabilitiesOf,
  type Activity,
  type ActivityCapabilities,
} from "../domain/activity.js";
import type { BlockDraft, BlockKind } from "../domain/block.js";
import {
  questionSequence,
  unfinishedBlocks,
  type BlockContext,
  type Question,
  type Unfinished,
} from "../domain/interview.js";
import { isPinned, movedItem, performedOrder } from "../domain/order.js";
import { activityName } from "../i18n/format.js";
import { newStep } from "./stepEdit.js";
import { inspect, type WorkoutDraft } from "./workoutComposition.js";

/**
 * A block with an identity that survives edits. Drafts are replaced on every
 * change, so without one the step being typed into would be a new object, and
 * a new row, after each keystroke.
 */
export interface Step {
  readonly id: number;
  readonly draft: BlockDraft;
}

interface Moment {
  readonly steps: readonly Step[];
  readonly open: number | undefined;
}

/** Keystrokes into one field within this long are one undo step, not one per character. */
const COALESCE_MS = 1200;

let lastId = 0;
function step(draft: BlockDraft): Step {
  lastId += 1;
  return { id: lastId, draft };
}

function ordered(steps: readonly Step[]): Step[] {
  return performedOrder(steps, (entry) => entry.draft.kind);
}

export class CompositionSession {
  activity = $state<Activity>(ACTIVITY_CATALOGUE[0]!);
  title = $state("Workout");
  steps = $state.raw<readonly Step[]>([]);
  /** The step whose editor is open. One at a time, like a disclosure list. */
  open = $state<number | undefined>(undefined);
  /**
   * Where focus goes once a step's editor is drawn: the first field after its
   * kind for a step just added, so a new step is filled in from the top; the
   * first missing one when Download sends someone back to finish it.
   */
  focusRequest = $state<{ readonly id: number; readonly from: "start" | "missing" } | undefined>(
    undefined,
  );

  private past = $state.raw<readonly Moment[]>([]);
  private future = $state.raw<readonly Moment[]>([]);
  private lastKey: string | undefined;
  private lastAt = 0;

  capabilities = $derived<ActivityCapabilities>(capabilitiesOf(this.activity));

  activityName = $derived(activityName(this.activity.id));

  blocks = $derived<readonly BlockDraft[]>(this.steps.map((entry) => entry.draft));

  workout = $derived<WorkoutDraft>({
    title: this.title,
    activity: this.activity,
    blocks: this.blocks.filter((block) => block.kind !== undefined),
  });

  preview = $derived(inspect(this.workout));

  unfinished = $derived<readonly Unfinished[]>(
    unfinishedBlocks(this.blocks, this.activity, this.capabilities),
  );

  openIndex = $derived<number | undefined>(this.indexOf(this.open));

  canUndo = $derived(this.past.length > 0);
  canRedo = $derived(this.future.length > 0);

  snapshot = $derived({
    activityId: this.activity.id,
    title: this.title,
    blocks: this.blocks,
    cursor: this.openIndex ?? this.blocks.length,
  });

  chooseActivity(activity: Activity): void {
    this.activity = activity;
    this.steps = [];
    this.open = undefined;
    this.forget();
  }

  restore(activity: Activity, title: string, blocks: readonly BlockDraft[], _cursor: number): void {
    this.activity = activity;
    this.title = title;
    this.steps = ordered(blocks.map(step));
    this.open = undefined;
    this.forget();
  }

  indexOf(id: number | undefined): number | undefined {
    if (id === undefined) return undefined;
    const index = this.steps.findIndex((entry) => entry.id === id);
    return index === -1 ? undefined : index;
  }

  contextAt(index: number): BlockContext {
    return {
      hasWarmup: this.blocks.some((block, at) => block.kind === "WARMUP" && at !== index),
      hasCooldown: this.blocks.some((block, at) => block.kind === "COOLDOWN" && at !== index),
      position: index,
    };
  }

  /** The fields that apply to a step as it stands, in the order they are filled in. */
  fieldsAt(index: number): readonly Question[] {
    const draft = this.blocks[index];
    if (draft === undefined) return [];
    return questionSequence(draft, this.activity, this.capabilities, this.contextAt(index));
  }

  missingAt(index: number): Question | undefined {
    return this.unfinished.find((entry) => entry.index === index)?.question;
  }

  /** Kinds a step can become: one warm up and one cool down per workout, any number of the rest. */
  kindsAt(index: number): readonly BlockKind[] {
    const context = this.contextAt(index);
    const kinds: BlockKind[] = [];
    if (!context.hasWarmup) kinds.push("WARMUP");
    kinds.push("INTERVAL", "RECOVERY");
    if (!context.hasCooldown) kinds.push("COOLDOWN");
    return kinds;
  }

  canAdd(kind: BlockKind): boolean {
    if (kind === "WARMUP") return !this.blocks.some((block) => block.kind === "WARMUP");
    if (kind === "COOLDOWN") return !this.blocks.some((block) => block.kind === "COOLDOWN");
    return true;
  }

  add(kind: BlockKind): number | undefined {
    if (!this.canAdd(kind)) return undefined;
    this.checkpoint();
    const added = step(newStep(kind, this.capabilities));
    this.steps = ordered([...this.steps, added]);
    this.open = added.id;
    this.focusRequest = { id: added.id, from: "start" };
    return added.id;
  }

  /**
   * Replaces a step's draft. Edits that share a key, such as the keystrokes of
   * one value, fold into a single undo step.
   */
  edit(id: number, change: (draft: BlockDraft) => BlockDraft, key?: string): void {
    const current = this.steps.find((entry) => entry.id === id);
    if (current === undefined) return;
    const next = change(current.draft);
    if (next === current.draft) return;
    this.checkpoint(key === undefined ? undefined : `${id}:${key}`);
    this.steps = ordered(
      this.steps.map((entry) => (entry.id === id ? { id, draft: next } : entry)),
    );
  }

  remove(id: number): void {
    const index = this.indexOf(id);
    if (index === undefined) return;
    this.checkpoint();
    const remaining = this.steps.filter((entry) => entry.id !== id);
    this.steps = remaining;
    if (this.open === id) this.open = undefined;
  }

  canDuplicate(id: number): boolean {
    const index = this.indexOf(id);
    return index !== undefined && !isPinned(this.blocks[index]);
  }

  duplicate(id: number): void {
    const index = this.indexOf(id);
    if (index === undefined || !this.canDuplicate(id)) return;
    this.checkpoint();
    const copy = step({ ...this.steps[index]!.draft });
    this.steps = ordered([...this.steps.slice(0, index + 1), copy, ...this.steps.slice(index + 1)]);
    this.open = copy.id;
  }

  canMove(id: number, by: -1 | 1): boolean {
    const index = this.indexOf(id);
    if (index === undefined || isPinned(this.blocks[index])) return false;
    return !isPinned(this.blocks[index + by]);
  }

  move(id: number, by: -1 | 1): void {
    const index = this.indexOf(id);
    if (index === undefined || !this.canMove(id, by)) return;
    this.checkpoint();
    this.steps = movedItem(this.steps, index, index + by, (entry) => entry.draft.kind);
  }

  /** Moves a step to another slot, for drag and drop. Pinned ends stay where they are. */
  place(id: number, to: number): void {
    const index = this.indexOf(id);
    if (index === undefined || index === to || isPinned(this.blocks[index])) return;
    this.checkpoint();
    this.steps = movedItem(this.steps, index, to, (entry) => entry.draft.kind);
  }

  toggle(id: number): void {
    this.open = this.open === id ? undefined : id;
  }

  close(): void {
    this.open = undefined;
  }

  /** Opens the step above or below the open one, or the first or last when none is. */
  openAdjacent(by: -1 | 1): number | undefined {
    if (this.steps.length === 0) return undefined;
    const index = this.openIndex;
    const target =
      index === undefined
        ? by === 1
          ? 0
          : this.steps.length - 1
        : Math.max(0, Math.min(this.steps.length - 1, index + by));
    this.open = this.steps[target]!.id;
    return this.open;
  }

  /** Opens the first unfinished step and asks for its missing field. */
  attendToUnfinished(): boolean {
    const first = this.unfinished[0];
    if (first === undefined) return false;
    const target = this.steps[first.index];
    if (target === undefined) return false;
    this.open = target.id;
    this.focusRequest = { id: target.id, from: "missing" };
    return true;
  }

  undo(): void {
    const previous = this.past.at(-1);
    if (previous === undefined) return;
    this.future = [...this.future, this.moment()];
    this.past = this.past.slice(0, -1);
    this.settle(previous);
  }

  redo(): void {
    const next = this.future.at(-1);
    if (next === undefined) return;
    this.past = [...this.past, this.moment()];
    this.future = this.future.slice(0, -1);
    this.settle(next);
  }

  private moment(): Moment {
    return { steps: this.steps, open: this.open };
  }

  private settle(moment: Moment): void {
    this.steps = moment.steps;
    this.open = moment.open;
    this.lastKey = undefined;
  }

  private checkpoint(key?: string): void {
    const now = Date.now();
    const folds = key !== undefined && key === this.lastKey && now - this.lastAt < COALESCE_MS;
    this.lastKey = key;
    this.lastAt = now;
    if (folds) return;
    this.past = [...this.past, this.moment()];
    this.future = [];
  }

  private forget(): void {
    this.past = [];
    this.future = [];
    this.lastKey = undefined;
  }
}
