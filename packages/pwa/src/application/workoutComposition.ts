import type { WorkoutBinary } from "@dotworkout/codec";
import {
  custom,
  totalDistance,
  validateWorkout,
  type AlertSpec,
  type StepInput,
  type ValidationResult,
  type WorkoutTotals,
} from "@dotworkout/domain";
import type { Activity } from "../domain/activity.js";
import type { AlertDraft, BlockDraft } from "../domain/block.js";

export interface WorkoutDraft {
  readonly title: string;
  readonly activity: Activity;
  readonly blocks: readonly BlockDraft[];
}

function stepInput(draft: BlockDraft): StepInput {
  if (draft.goalKind === "OPEN") return { open: true };
  if (draft.duration !== undefined) return { time: draft.duration };
  if (draft.distance !== undefined) return draft.distance;
  return { open: true };
}

function alertSpec(alert: AlertDraft): AlertSpec {
  switch (alert.metric) {
    case "HEART_RATE":
      return alert.style === "ZONE"
        ? { kind: "heartRateZone", zone: alert.zone }
        : { kind: "heartRateRange", from: alert.from, to: alert.to };
    case "SPEED":
      return { kind: "speed", metersPerSecond: alert.metersPerSecond };
    case "CADENCE":
      return { kind: "cadence", perMinute: alert.perMinute };
    case "POWER":
      return { kind: "power", watts: alert.watts };
  }
}

export function compose(draft: WorkoutDraft): WorkoutBinary {
  const builder = custom(draft.activity.type, draft.title, {
    defaultUnit: draft.activity.defaultDistanceUnit,
  });

  for (const block of draft.blocks) {
    if (block.kind === "WARMUP") {
      builder.warmup(stepInput(block));
      continue;
    }
    if (block.kind === "COOLDOWN") {
      builder.cooldown(stepInput(block));
      continue;
    }
    if (block.kind === "RECOVERY") {
      builder.recovery({ time: block.duration ?? { value: 30, unit: "s" } });
      continue;
    }

    const set = builder.repeat(block.repetitions ?? 1).of(stepInput(block));
    if (block.sendOff !== undefined) set.on(block.sendOff);
    if (block.label !== undefined && block.label !== "") set.label(block.label);
    if (block.alert !== undefined) set.alert(alertSpec(block.alert));
    if (block.recovery !== undefined) set.rest({ time: block.recovery });
  }

  return builder.build();
}

export function inspect(draft: WorkoutDraft): {
  readonly totals: WorkoutTotals | undefined;
  readonly validation: ValidationResult | undefined;
} {
  if (draft.blocks.length === 0) return { totals: undefined, validation: undefined };
  try {
    const binary = compose(draft);
    return {
      totals: binary.customWorkout === undefined ? undefined : totalDistance(binary.customWorkout),
      validation: validateWorkout(binary),
    };
  } catch {
    return { totals: undefined, validation: undefined };
  }
}
