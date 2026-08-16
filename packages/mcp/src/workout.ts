import { z } from "zod";
import {
  SPORTS,
  findSport,
  custom,
  type AlertSpec,
  type StepExtras,
  type StepInput,
  type WorkoutBuilder,
} from "@dotworkout/domain";

/** Every sport WorkoutKit accepts, straight from the library catalogue. */
const NAMES = SPORTS.map((sport) => sport.name);
export const ACTIVITIES = [NAMES[0]!, ...NAMES.slice(1)] as [string, ...string[]];

export type Activity = string;

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

/** A warm up or cool down carries the same target, label and send-off a set does. */
const edgeStep = z.intersection(
  step,
  z.object({
    alert: alert.optional(),
    label: z.string().optional(),
    sendOff: z
      .string()
      .optional()
      .describe('leave on the clock, e.g. "2:00"; needs a distance goal'),
  }),
);

export const workoutShape = {
  activity: z.enum(ACTIVITIES),
  location: z
    .enum(["outdoor", "indoor"])
    .optional()
    .describe("indoor changes what a sport offers: a stationary bike has no speed or distance"),
  name: z.string().optional(),
  warmup: edgeStep.optional(),
  blocks: z.array(block).min(1),
  cooldown: edgeStep.optional(),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- built only to derive WorkoutSpec via z.infer; the lint rule doesn't recognise that as a use
const workoutSchema = z.object(workoutShape);

export type WorkoutSpec = z.infer<typeof workoutSchema>;

function extrasOf(value: z.infer<typeof edgeStep>): StepExtras {
  return {
    ...(value.alert === undefined ? {} : { alert: value.alert as AlertSpec }),
    ...(value.label === undefined ? {} : { label: value.label }),
    ...(value.sendOff === undefined ? {} : { sendOff: value.sendOff }),
  };
}

function toStepInput(value: z.infer<typeof step>): StepInput {
  if ("distance" in value) return value.distance;
  if ("time" in value) return { time: value.time };
  return { open: true };
}

export function buildWorkout(spec: WorkoutSpec): WorkoutBuilder {
  const sport = findSport(spec.activity);
  if (sport === undefined) throw new Error(`Unknown activity ${spec.activity}`);

  const builder: WorkoutBuilder = custom(sport.type, spec.name, {
    defaultUnit: sport.defaultUnit,
    location: spec.location ?? sport.locations[0] ?? "outdoor",
  });

  if (spec.warmup !== undefined) builder.warmup(toStepInput(spec.warmup), extrasOf(spec.warmup));

  for (const entry of spec.blocks) {
    const set = builder.repeat(entry.repeat).of(toStepInput(entry.work));
    if (entry.sendOff !== undefined) set.on(entry.sendOff);
    if (entry.rest !== undefined) set.rest(entry.rest);
    if (entry.label !== undefined) set.label(entry.label);
    if (entry.alert !== undefined) set.alert(entry.alert as AlertSpec);
  }

  if (spec.cooldown !== undefined)
    builder.cooldown(toStepInput(spec.cooldown), extrasOf(spec.cooldown));

  return builder;
}
