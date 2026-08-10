/**
 * Turning parsed lines into a workout, and describing them back to the user.
 *
 * The echo matters as much as the build. A terse notation is only trustworthy
 * if you can see what it was understood as — `8x50 on 1:00` echoing back as
 * "8 × 50 m, leaving every 1:00" is what makes it safe to type quickly.
 */

import { formatDistance, formatDuration, swim, type WorkoutBuilder } from "@dotworkout/domain";
import { restText } from "./swimtime.js";
import type { ParsedLine, Quantity } from "./parse.js";

export interface ComposeOptions {
  readonly name?: string;
  readonly guid?: string;
}

/** Build a workout from parsed lines, in the order they were written. */
export function applyLines(lines: readonly ParsedLine[], options: ComposeOptions = {}): WorkoutBuilder {
  const builder = swim(options.name ?? "Workout", options.guid === undefined ? {} : { guid: options.guid });

  for (const line of lines) {
    switch (line.kind) {
      case "warmup":
        builder.warmup(quantityInput(line.work));
        break;

      case "cooldown":
        builder.cooldown(quantityInput(line.work));
        break;

      case "rest":
        builder.recovery({ time: line.duration });
        break;

      case "set": {
        const set = builder.repeat(line.reps).of(quantityInput(line.work));
        // Order matters: .on() must see a distance goal, so it runs before
        // anything else can reshape the step.
        if (line.sendOff !== undefined) set.on(line.sendOff);
        if (line.label !== undefined) set.label(line.label);
        if (line.alert !== undefined) set.alert(line.alert);
        if (line.rest !== undefined) set.rest({ time: line.rest });
        break;
      }
    }
  }

  return builder;
}

/** Plain-English echo of one parsed line, shown live as you type. */
export function describeLine(line: ParsedLine): string {
  switch (line.kind) {
    case "warmup":
      return `warm up ${describeQuantity(line.work)}${labelSuffix(line.label)}`;
    case "cooldown":
      return `cool down ${describeQuantity(line.work)}${labelSuffix(line.label)}`;
    case "rest":
      return `rest ${formatDuration(line.duration)}`;
    case "set": {
      const parts = [`${line.reps} × ${describeQuantity(line.work)}`];
      if (line.sendOff !== undefined) parts.push(`leaving every ${formatDuration(line.sendOff)}`);
      if (line.rest !== undefined) parts.push(`${restText(line.rest)} rest`);
      if (line.alert?.kind === "heartRateZone") parts.push(`HR zone ${line.alert.zone}`);
      if (line.label !== undefined) parts.push(`“${line.label}”`);
      return parts.join(" · ");
    }
  }
}

/** Distance this line contributes, in metres, or undefined when it has none. */
export function lineMeters(line: ParsedLine): number | undefined {
  const quantity = line.kind === "rest" ? undefined : line.work;
  if (quantity === undefined || quantity.kind !== "distance") return undefined;
  const reps = line.kind === "set" ? line.reps : 1;
  return metersOf(quantity) * reps;
}

function describeQuantity(quantity: Quantity): string {
  switch (quantity.kind) {
    case "distance":
      return formatDistance(quantity.distance);
    case "time":
      return formatDuration(quantity.duration);
    case "open":
      return "open";
  }
}

function quantityInput(quantity: Quantity) {
  switch (quantity.kind) {
    case "distance":
      return quantity.distance;
    case "time":
      return { time: quantity.duration };
    case "open":
      return { open: true as const };
  }
}

function labelSuffix(label: string | undefined): string {
  return label === undefined ? "" : ` “${label}”`;
}

const METERS_PER: Record<string, number> = {
  m: 1,
  km: 1000,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

function metersOf(quantity: Extract<Quantity, { kind: "distance" }>): number {
  return quantity.distance.value * (METERS_PER[quantity.distance.unit] ?? 1);
}
