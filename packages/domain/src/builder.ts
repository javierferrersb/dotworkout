/**
 * The authoring API.
 *
 * ```ts
 * swim("Thursday threshold")
 *   .warmup(400)
 *   .repeat(8).of(50).rest(30).label("Build")
 *   .repeat(4).of(100).on("2:00")        // DISTANCE_TIME send-off
 *   .cooldown(200)
 * ```
 *
 * `.on()` is the important one: "8 × 50 on 1:00" means leave every 60 seconds
 * regardless of finishing time. It is how essentially every swim set is written,
 * and it is swimming-only — the compatibility matrix rejects it elsewhere.
 *
 * Builders emit protobuf messages directly. There is no intermediate domain
 * representation to round-trip through, which is what makes editing a decoded
 * file safe: nothing can be lost in a translation that never happens.
 */

import { create } from "@bufbuild/protobuf";
import {
  CustomWorkoutSchema,
  CustomWorkout_ActivityType,
  CustomWorkout_LocationType,
  IntervalBlockSchema,
  IntervalBlock_IntervalStepSchema,
  IntervalBlock_IntervalStep_IntervalPurpose,
  SingleGoalWorkoutSchema,
  WorkoutBinarySchema,
  WorkoutStepSchema,
  encode,
  type IntervalBlock,
  type WorkoutBinary,
  type WorkoutStep,
} from "@dotworkout/codec";
import { toWorkoutAlert, type AlertSpec } from "./alerts.js";
import { toWorkoutGoal, type GoalSpec } from "./goals.js";
import { newWorkoutGuid } from "./guid.js";
import {
  parseDistance,
  parseDuration,
  type DistanceInput,
  type DistanceUnit,
  type DurationInput,
} from "./units.js";
import {
  assertValidWorkout,
  validateWorkout,
  type ValidateOptions,
  type ValidationResult,
} from "./validate.js";

/** Observed as 1 and 5 in every corpus file. */
const WIRE_VERSION = 1;
const WIRE_FORMAT = 5;

export interface WorkoutOptions {
  /**
   * Pool swims store as OUTDOOR (spec §3), which is why that is the default even
   * for an indoor pool. Open water is not a separate composer activity.
   */
  readonly location?: "indoor" | "outdoor";
  /** Unit applied to bare numbers. Never rewrites an explicitly authored unit. */
  readonly defaultUnit?: DistanceUnit;
  /**
   * Reuse a specific GUID.
   *
   * Omit this. The GUID is a stable per-workout identity, not a per-export
   * nonce, so a fresh UUIDv4 is minted per workout; reusing one risks import
   * collisions. Pass it only when deliberately re-exporting the *same* workout.
   */
  readonly guid?: string;
}

/** A distance goal, or `{ time }` / `"open"` where a step is not distance-based. */
/**
 * Anything a warm up or cool down carries besides its goal.
 *
 * The Watch accepts a target on either — `ProbeAlertsRange`, `Swim_HR` and
 * `Probe_Alert_Range_Zone_2_HR` in the corpus all put one on their warm up —
 * so both steps take the same extras a set does.
 */
export interface StepExtras {
  readonly alert?: AlertSpec;
  readonly label?: string;
}

export type StepInput =
  | DistanceInput
  | { readonly time: DurationInput }
  | { readonly open: true };

export function swim(name?: string, options: WorkoutOptions = {}): WorkoutBuilder {
  return new WorkoutBuilder(CustomWorkout_ActivityType.SWIMMING, name, {
    defaultUnit: "m",
    ...options,
  });
}

export function run(name?: string, options: WorkoutOptions = {}): WorkoutBuilder {
  return new WorkoutBuilder(CustomWorkout_ActivityType.RUNNING, name, {
    defaultUnit: "m",
    ...options,
  });
}

export function bike(name?: string, options: WorkoutOptions = {}): WorkoutBuilder {
  return new WorkoutBuilder(CustomWorkout_ActivityType.CYCLING, name, {
    defaultUnit: "km",
    ...options,
  });
}

export function hiit(name?: string, options: WorkoutOptions = {}): WorkoutBuilder {
  return new WorkoutBuilder(
    CustomWorkout_ActivityType.HIGH_INTENSITY_INTERVAL_TRAINING,
    name,
    options,
  );
}

/** Any activity, including ones the matrix has never verified. */
export function custom(
  activity: CustomWorkout_ActivityType,
  name?: string,
  options: WorkoutOptions = {},
): WorkoutBuilder {
  return new WorkoutBuilder(activity, name, options);
}

interface StepDraft {
  goal: GoalSpec;
  label?: string;
  alert?: AlertSpec;
}

interface BlockDraft {
  iterations: number;
  steps: { purpose: "work" | "recovery"; step: StepDraft }[];
}

export class WorkoutBuilder {
  readonly #activity: CustomWorkout_ActivityType;
  readonly #options: WorkoutOptions;
  readonly #blocks: BlockDraft[] = [];
  #name: string | undefined;
  #warmup: StepDraft | undefined;
  #cooldown: StepDraft | undefined;

  constructor(
    activity: CustomWorkout_ActivityType,
    name: string | undefined,
    options: WorkoutOptions,
  ) {
    this.#activity = activity;
    this.#name = name;
    this.#options = options;
  }

  /** Set or replace the workout name. */
  name(value: string): this {
    this.#name = value;
    return this;
  }

  warmup(input: StepInput, extras: StepExtras = {}): this {
    this.#warmup = { goal: this.#goal(input), ...extras };
    return this;
  }

  cooldown(input: StepInput, extras: StepExtras = {}): this {
    this.#cooldown = { goal: this.#goal(input), ...extras };
    return this;
  }

  /**
   * Start a repeating block: `.repeat(8).of(50)` is "8 × 50".
   *
   * The composer's picker offers 2–98, but 1 is valid on the wire — a single
   * unrepeated step is written as `iterations: 1` (spec §4) — so `.repeat(1)`
   * and {@link set} produce the same thing.
   */
  repeat(times: number): PendingRepeat {
    if (!Number.isInteger(times) || times < 1) {
      throw new RangeError(`repeat() needs a whole number of iterations >= 1, got ${times}`);
    }
    return new PendingRepeat(this, times);
  }

  /** A single unrepeated set. Equivalent to `.repeat(1).of(...)`. */
  set(input: StepInput): SetBuilder {
    return this.repeat(1).of(input);
  }

  /**
   * A standalone recovery block, with no work step.
   *
   * Recovery-only blocks are real: `Minimal` and `Activity_Cycle` both contain
   * one, so parsers and builders alike must not assume work/recovery pairing.
   */
  recovery(input: StepInput): SetBuilder {
    const block: BlockDraft = { iterations: 1, steps: [] };
    this.#blocks.push(block);
    const builder = new SetBuilder(this, block);
    return builder.rest(input);
  }

  /** @internal */
  addBlock(block: BlockDraft): void {
    this.#blocks.push(block);
  }

  /** @internal */
  toGoal(input: StepInput): GoalSpec {
    return this.#goal(input);
  }

  #goal(input: StepInput): GoalSpec {
    if (typeof input === "object" && input !== null && "open" in input) {
      return { kind: "open" };
    }
    if (typeof input === "object" && input !== null && "time" in input) {
      return { kind: "time", duration: parseDuration(input.time) };
    }
    return {
      kind: "distance",
      distance: parseDistance(input as DistanceInput, this.#options.defaultUnit ?? "m"),
    };
  }

  /** Build the protobuf message. Does not validate — call {@link validate} for that. */
  build(): WorkoutBinary {
    const workout = create(CustomWorkoutSchema, {
      activityType: this.#activity,
      locationType:
        this.#options.location === "indoor"
          ? CustomWorkout_LocationType.INDOOR
          : CustomWorkout_LocationType.OUTDOOR,
      intervalBlocks: this.#blocks.map(buildBlock),
    });
    if (this.#name !== undefined) workout.displayName = this.#name;
    if (this.#warmup !== undefined) workout.warmup = buildStep(this.#warmup);
    if (this.#cooldown !== undefined) workout.cooldown = buildStep(this.#cooldown);

    return create(WorkoutBinarySchema, {
      GUID: this.#options.guid ?? newWorkoutGuid(),
      customWorkout: workout,
      version: WIRE_VERSION,
      format: WIRE_FORMAT,
    });
  }

  validate(options?: ValidateOptions): ValidationResult {
    return validateWorkout(this.build(), options);
  }

  /**
   * Build, validate, and encode to `.workout` bytes.
   *
   * Validation errors throw. Warnings — which is what every unverified matrix
   * entry produces — do not.
   */
  toBytes(options: ValidateOptions & { readonly skipValidation?: boolean } = {}): Uint8Array {
    const binary = this.build();
    if (options.skipValidation !== true) assertValidWorkout(binary, options);
    return encode(binary);
  }
}

/** `.repeat(n)` before `.of(...)` has said what is being repeated. */
export class PendingRepeat {
  readonly #parent: WorkoutBuilder;
  readonly #times: number;

  constructor(parent: WorkoutBuilder, times: number) {
    this.#parent = parent;
    this.#times = times;
  }

  /** What is repeated. `.repeat(8).of(50)` → 8 × 50. */
  of(input: StepInput): SetBuilder {
    const block: BlockDraft = {
      iterations: this.#times,
      steps: [{ purpose: "work", step: { goal: this.#parent.toGoal(input) } }],
    };
    this.#parent.addBlock(block);
    return new SetBuilder(this.#parent, block);
  }
}

/**
 * A block under construction.
 *
 * Also forwards the workout-level methods, so a chain can keep flowing without
 * a `.end()` step: `.repeat(8).of(50).rest(30).repeat(4).of(100)`.
 */
export class SetBuilder {
  readonly #parent: WorkoutBuilder;
  readonly #block: BlockDraft;

  constructor(parent: WorkoutBuilder, block: BlockDraft) {
    this.#parent = parent;
    this.#block = block;
  }

  /** Rest between repetitions. `.rest(30)` is 30 seconds; `.rest(":20")` also works. */
  rest(input: StepInput | DurationInput): this {
    const goal: GoalSpec =
      typeof input === "object" && input !== null && ("time" in input || "open" in input)
        ? this.#parent.toGoal(input as StepInput)
        : { kind: "time", duration: parseDuration(input as DurationInput) };
    this.#block.steps.push({ purpose: "recovery", step: { goal } });
    return this;
  }

  /**
   * Turn the work step into a send-off: `.repeat(8).of(50).on("1:00")`.
   *
   * "8 × 50 on 1:00" — leave every 60 seconds regardless of finishing time. This
   * is `goal_type = 5` with a dedicated payload carrying both quantities; it
   * does not set `time_goal` and `distance_goal` together.
   *
   * Swimming-only. On any other sport the compatibility matrix rejects it, and
   * the error will say so.
   */
  on(sendOff: DurationInput): this {
    const target = this.#work();
    if (target.goal.kind !== "distance") {
      throw new TypeError(
        `.on() turns a distance into a send-off, but this step's goal is "${target.goal.kind}". ` +
          `Write .of(50).on("1:00"), not .of({ time: 30 }).on(...).`,
      );
    }
    target.goal = {
      kind: "distanceTime",
      distance: target.goal.distance,
      duration: parseDuration(sendOff),
    };
    return this;
  }

  /**
   * Label the work step.
   *
   * There is no stroke field in this format — the app expects the stroke typed
   * into the free-text name (spec §3), so this is where "Pull", "Backstroke" or
   * "Build" goes, and what {@link import("./totals.js").totalDistance} groups by.
   */
  label(text: string): this {
    this.#work().label = text;
    return this;
  }

  /** Attach an alert to the work step. Swimming offers heart rate only. */
  alert(spec: AlertSpec): this {
    this.#work().alert = spec;
    return this;
  }

  /** Heart-rate zone 1–5. Bounds resolve on-device against the wearer's own data. */
  hrZone(zone: number): this {
    return this.alert({ kind: "heartRateZone", zone });
  }

  /** Explicit heart-rate range in bpm. */
  hrRange(from: number, to: number): this {
    return this.alert({ kind: "heartRateRange", from, to });
  }

  #work(): StepDraft {
    const work = this.#block.steps.find((s) => s.purpose === "work");
    if (work === undefined) {
      throw new TypeError("This block has no work step to modify");
    }
    return work.step;
  }

  // --- forwarded workout-level methods, so the chain keeps flowing ---

  name(value: string): WorkoutBuilder {
    return this.#parent.name(value);
  }
  warmup(input: StepInput, extras: StepExtras = {}): WorkoutBuilder {
    return this.#parent.warmup(input, extras);
  }
  cooldown(input: StepInput, extras: StepExtras = {}): WorkoutBuilder {
    return this.#parent.cooldown(input, extras);
  }
  repeat(times: number): PendingRepeat {
    return this.#parent.repeat(times);
  }
  set(input: StepInput): SetBuilder {
    return this.#parent.set(input);
  }
  recovery(input: StepInput): SetBuilder {
    return this.#parent.recovery(input);
  }
  build(): WorkoutBinary {
    return this.#parent.build();
  }
  validate(options?: ValidateOptions): ValidationResult {
    return this.#parent.validate(options);
  }
  toBytes(options?: ValidateOptions & { readonly skipValidation?: boolean }): Uint8Array {
    return this.#parent.toBytes(options);
  }
}

export interface SingleGoalOptions extends WorkoutOptions {
  readonly name?: string;
}

/**
 * The simple non-custom workouts at `WorkoutBinary` field 10.
 *
 * One activity, one goal, no warm up, blocks or cool down. This is the only
 * place the ENERGY goal appears — the custom-workout composer never offers it.
 */
export function singleGoal(
  activity: CustomWorkout_ActivityType,
  goal: GoalSpec,
  options: SingleGoalOptions = {},
): WorkoutBinary {
  const workout = create(SingleGoalWorkoutSchema, {
    activityType: activity,
    locationType:
      options.location === "indoor"
        ? CustomWorkout_LocationType.INDOOR
        : CustomWorkout_LocationType.OUTDOOR,
    goal: toWorkoutGoal(goal),
  });
  // display_name here is PRESUMED — inferred by analogy with CustomWorkout and
  // never observed in a real file (spec §2). Only written when asked for.
  if (options.name !== undefined) workout.displayName = options.name;

  return create(WorkoutBinarySchema, {
    GUID: options.guid ?? newWorkoutGuid(),
    singleGoalWorkout: workout,
    version: WIRE_VERSION,
    format: WIRE_FORMAT,
  });
}

function buildBlock(draft: BlockDraft): IntervalBlock {
  return create(IntervalBlockSchema, {
    iterations: draft.iterations,
    intervalSteps: draft.steps.map((entry) =>
      create(IntervalBlock_IntervalStepSchema, {
        purpose:
          entry.purpose === "work"
            ? IntervalBlock_IntervalStep_IntervalPurpose.WORK
            : IntervalBlock_IntervalStep_IntervalPurpose.RECOVERY,
        workoutStep: buildStep(entry.step),
      }),
    ),
  });
}

function buildStep(draft: StepDraft): WorkoutStep {
  const step = create(WorkoutStepSchema, { workoutGoal: toWorkoutGoal(draft.goal) });
  if (draft.label !== undefined) step.displayName = draft.label;
  if (draft.alert !== undefined) step.workoutAlert = toWorkoutAlert(draft.alert);
  return step;
}
