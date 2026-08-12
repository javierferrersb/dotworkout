import { z } from "zod";
import {
  bike,
  hiit,
  run,
  swim,
  type AlertSpec,
  type StepInput,
  type WorkoutBuilder,
} from "@dotworkout/domain";

export const ACTIVITIES = [
  "SWIMMING",
  "RUNNING",
  "CYCLING",
  "HIGH_INTENSITY_INTERVAL_TRAINING",
] as const;

export type Activity = (typeof ACTIVITIES)[number];

const step = z.union([
  z.object({ distance: z.string().describe('e.g. "400", "1.2 km", "0.5mi"') }),
  z.object({ time: z.string().describe('e.g. "1:00", "90s", "10min"') }),
  z.object({ open: z.literal(true).describe("no goal; the wearer ends the step") }),
]);

const alert = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heartRateZone"), zone: z.number().int().min(1).max(5) }),
  z.object({ kind: z.literal("heartRateRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("cadence"), perMinute: z.number() }),
  z.object({ kind: z.literal("cadenceRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("power"), watts: z.number() }),
  z.object({ kind: z.literal("powerRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("speed"), metersPerSecond: z.number() }),
  z.object({ kind: z.literal("speedRange"), slower: z.number(), faster: z.number() }),
]);

const block = z.object({
  repeat: z.number().int().min(1).default(1),
  work: step,
  sendOff: z
    .string()
    .optional()
    .describe('swimming only: leave every "2:00" however fast you finish'),
  rest: z.string().optional().describe('recovery after each repetition, e.g. ":20"'),
  label: z.string().optional().describe("free text; this is where stroke goes"),
  alert: alert.optional(),
});

export const workoutShape = {
  activity: z.enum(ACTIVITIES),
  name: z.string().optional(),
  warmup: step.optional(),
  blocks: z.array(block).min(1),
  cooldown: step.optional(),
};

const workoutSchema = z.object(workoutShape);

export type WorkoutSpec = z.infer<typeof workoutSchema>;

const STARTERS: Record<Activity, (name?: string) => WorkoutBuilder> = {
  SWIMMING: swim,
  RUNNING: run,
  CYCLING: bike,
  HIGH_INTENSITY_INTERVAL_TRAINING: hiit,
};

function toStepInput(value: z.infer<typeof step>): StepInput {
  if ("distance" in value) return value.distance;
  if ("time" in value) return { time: value.time };
  return { open: true };
}

export function buildWorkout(spec: WorkoutSpec): WorkoutBuilder {
  const builder = STARTERS[spec.activity](spec.name);

  if (spec.warmup !== undefined) builder.warmup(toStepInput(spec.warmup));

  for (const entry of spec.blocks) {
    const set = builder.repeat(entry.repeat).of(toStepInput(entry.work));
    if (entry.sendOff !== undefined) set.on(entry.sendOff);
    if (entry.rest !== undefined) set.rest(entry.rest);
    if (entry.label !== undefined) set.label(entry.label);
    if (entry.alert !== undefined) set.alert(entry.alert as AlertSpec);
  }

  if (spec.cooldown !== undefined) builder.cooldown(toStepInput(spec.cooldown));

  return builder;
}
