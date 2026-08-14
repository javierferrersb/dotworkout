import type { Distance, Duration } from "@dotworkout/domain";
import type { AlertMetric, AlertReading, AlertStyle, GoalKind } from "./activity.js";

export type BlockKind = "WARMUP" | "INTERVAL" | "RECOVERY" | "COOLDOWN";

/**
 * Speed and power bounds are stored slowest-first, which for pace reads
 * backwards: a quicker pace is a bigger number of metres per second. Whichever
 * order the two are entered in, the pair is sorted before it reaches the codec.
 */
export type AlertDraft =
  | { readonly metric: "HEART_RATE"; readonly style: "ZONE"; readonly zone: number }
  | {
      readonly metric: "HEART_RATE";
      readonly style: "RANGE";
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly metric: "SPEED";
      readonly style: "VALUE";
      readonly metersPerSecond: number;
      readonly reading: AlertReading;
    }
  | {
      readonly metric: "SPEED";
      readonly style: "RANGE";
      readonly slower: number;
      readonly faster: number;
      readonly reading: AlertReading;
    }
  | { readonly metric: "CADENCE"; readonly style: "VALUE"; readonly perMinute: number }
  | {
      readonly metric: "CADENCE";
      readonly style: "RANGE";
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly metric: "POWER";
      readonly style: "VALUE";
      readonly watts: number;
      readonly reading: AlertReading;
    }
  | {
      readonly metric: "POWER";
      readonly style: "RANGE";
      readonly from: number;
      readonly to: number;
      readonly reading: AlertReading;
    };

export interface BlockDraft {
  readonly kind?: BlockKind;
  readonly goalKind?: GoalKind;
  readonly distance?: Distance;
  readonly duration?: Duration;
  readonly sendOff?: Duration;
  readonly repetitions?: number;
  readonly recovery?: Duration;
  readonly alertMetric?: AlertMetric | "NONE";
  readonly alertReading?: AlertReading;
  readonly alertStyle?: AlertStyle;
  readonly alertFrom?: number;
  readonly alert?: AlertDraft;
  readonly label?: string;
  readonly skipped?: readonly string[];
}

export const EMPTY_BLOCK: BlockDraft = {};

export function blockKindTitle(kind: BlockKind): string {
  switch (kind) {
    case "WARMUP":
      return "Warm up";
    case "INTERVAL":
      return "Set";
    case "RECOVERY":
      return "Rest";
    case "COOLDOWN":
      return "Cool down";
  }
}

export function repeats(draft: BlockDraft): boolean {
  return draft.kind === "INTERVAL";
}
