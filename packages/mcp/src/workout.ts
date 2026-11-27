import { z } from "zod";
import {
  SPORTS,
  findSport,
  custom,
  paceToMetersPerSecond,
  speedToMetersPerSecond,
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

const PACE = /^\s*(\d+(?::\d{1,2}){0,2})\s*\/\s*(km|mi)\s*$/i;

const pace = z
  .string()
  .regex(PACE, 'a pace like "4:30/km" or "7:15/mi"')
  .describe('time per km or mile, e.g. "4:30/km", "7:15/mi"');

const alert = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("heartRateZone"), zone: z.number().int().min(1).max(5) }),
  z.object({
    kind: z.literal("heartRateRange"),
    from: z.number().describe("beats per minute"),
    to: z.number(),
  }),
  z.object({ kind: z.literal("cadence"), perMinute: z.number() }),
  z.object({ kind: z.literal("cadenceRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("power"), watts: z.number() }),
  z.object({ kind: z.literal("powerRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("pace"), pace: pace }),
  z.object({
    kind: z.literal("paceRange"),
    from: pace.describe('one end of the band, e.g. "4:40/km"'),
    to: pace.describe('the other end, e.g. "4:20/km"; order does not matter'),
  }),
  z.object({ kind: z.literal("kmh"), kmh: z.number().describe("speed in km/h, e.g. 30") }),
  z.object({ kind: z.literal("kmhRange"), from: z.number(), to: z.number() }),
  z.object({ kind: z.literal("speed"), metersPerSecond: z.number() }),
  z.object({ kind: z.literal("speedRange"), slower: z.number(), faster: z.number() }),
]);

export type AlertInput = z.infer<typeof alert>;

/**
 * A pace as metres per second. Runners think in minutes per kilometre and the
 * file stores metres per second, and asking a model to do that division is
 * asking for a target that is quietly wrong.
 */
function paceSpeed(text: string): number {
  const match = PACE.exec(text);
  if (match === null) throw new Error(`Cannot read "${text}" as a pace (try "4:30/km")`);
  return paceToMetersPerSecond(match[1]!, match[2]!.toLowerCase() as "km" | "mi");
}

/** The alert as the library takes it: paces and km/h become metres per second. */
export function toAlertSpec(input: AlertInput): AlertSpec {
  switch (input.kind) {
    case "pace":
      return { kind: "speed", metersPerSecond: paceSpeed(input.pace) };
    case "paceRange": {
      const [a, b] = [paceSpeed(input.from), paceSpeed(input.to)];
      return { kind: "speedRange", slower: Math.min(a, b), faster: Math.max(a, b) };
    }
    case "kmh":
      return { kind: "speed", metersPerSecond: speedToMetersPerSecond(input.kmh) };
    case "kmhRange": {
      const [a, b] = [speedToMetersPerSecond(input.from), speedToMetersPerSecond(input.to)];
      return { kind: "speedRange", slower: Math.min(a, b), faster: Math.max(a, b) };
    }
    default:
      return input;
  }
}

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
  activity: z.enum(ACTIVITIES).describe("call list_activities for what each one supports"),
  location: z
    .enum(["outdoor", "indoor"])
    .optional()
    .describe("indoor changes what a sport offers: a stationary bike has no speed or distance"),
  name: z.string().optional().describe('shown in the Workout app, e.g. "Norwegian 4×4"'),
  warmup: edgeStep.optional(),
  blocks: z.array(block).min(1),
  cooldown: edgeStep.optional(),
};

export const workoutSchema = z.object(workoutShape);

export type WorkoutSpec = z.infer<typeof workoutSchema>;

function extrasOf(value: z.infer<typeof edgeStep>): StepExtras {
  return {
    ...(value.alert === undefined ? {} : { alert: toAlertSpec(value.alert) }),
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
    if (entry.alert !== undefined) set.alert(toAlertSpec(entry.alert));
  }

  if (spec.cooldown !== undefined)
    builder.cooldown(toStepInput(spec.cooldown), extrasOf(spec.cooldown));

  return builder;
}
