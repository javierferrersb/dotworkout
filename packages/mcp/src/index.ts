#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  CustomWorkout_ActivityType,
  WorkoutBinarySchema,
  decode,
  findUnknownFields,
} from "@dotworkout/codec";
import {
  COMPATIBILITY,
  formatDistance,
  formatDuration,
  steps,
  totalDistance,
  validateWorkout,
  type Issue,
} from "@dotworkout/domain";
import { ACTIVITIES, buildWorkout, workoutShape, type Activity } from "./workout.js";

interface MatrixEntry {
  readonly goalTypes: readonly string[];
  readonly alerts: readonly string[];
  readonly alertsUnverified?: readonly string[];
  readonly confidence: string;
  readonly note?: string;
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function issueLines(issues: readonly Issue[]): string {
  return issues.map((i) => `  [${i.code}] ${i.path}: ${i.message}`).join("\n");
}

function describe(activity: Activity): string {
  const entry: MatrixEntry = COMPATIBILITY.customWorkout[activity];
  const unverified: readonly string[] =
    COMPATIBILITY.customWorkoutUnverifiedActivities.activities;

  const lines = [
    `${activity} (confidence: ${entry.confidence}${
      unverified.includes(activity) ? ", activity itself unverified" : ""
    })`,
    `  goals:  ${entry.goalTypes.join(", ")}`,
    `  alerts: ${entry.alerts.length === 0 ? "none" : entry.alerts.join(", ")}`,
  ];

  if (entry.alertsUnverified !== undefined && entry.alertsUnverified.length > 0) {
    lines.push(`  alerts, unverified (allowed, will warn): ${entry.alertsUnverified.join(", ")}`);
  }
  if (entry.note !== undefined) lines.push(`  note:   ${entry.note}`);

  return lines.join("\n");
}

const server = new McpServer({ name: "dotworkout", version: "0.1.0" });

server.registerTool(
  "list_activities",
  {
    title: "List activities",
    description:
      "Activities that can be built, with the goals and alerts each one supports. Read this before building a workout: support differs per activity and guessing produces files the Watch rejects.",
    inputSchema: {},
  },
  async () => text(ACTIVITIES.map(describe).join("\n\n")),
);

server.registerTool(
  "describe_activity",
  {
    title: "Describe an activity",
    description:
      "Goals, alerts and caveats for one activity, from the compatibility matrix read off a real device.",
    inputSchema: { activity: z.enum(ACTIVITIES) },
  },
  async ({ activity }) => text(describe(activity)),
);

server.registerTool(
  "validate_workout",
  {
    title: "Validate a workout",
    description:
      "Check a workout without writing a file. Reports errors and warnings. Unverified combinations warn rather than fail.",
    inputSchema: workoutShape,
  },
  async (spec) => {
    let binary;
    try {
      binary = buildWorkout(spec).build();
    } catch (error) {
      return text(`Could not build: ${(error as Error).message}`);
    }

    const result = validateWorkout(binary);
    const parts = [result.ok ? "Valid." : "Invalid."];
    if (result.errors.length > 0) parts.push(`Errors:\n${issueLines(result.errors)}`);
    if (result.warnings.length > 0) parts.push(`Warnings:\n${issueLines(result.warnings)}`);
    return text(parts.join("\n\n"));
  },
);

server.registerTool(
  "create_workout",
  {
    title: "Create a workout file",
    description:
      "Build a .workout file and write it to disk. The file can be sent to a phone and opened in the Workout app. Check list_activities first for what the activity supports.",
    inputSchema: { ...workoutShape, outputPath: z.string().describe("where to write the file") },
  },
  async ({ outputPath, ...spec }) => {
    let bytes;
    try {
      bytes = buildWorkout(spec).toBytes();
    } catch (error) {
      return text(`Not written: ${(error as Error).message}`);
    }

    const target = resolve(outputPath);
    writeFileSync(target, bytes);

    const binary = decode(bytes);
    const totals = totalDistance(binary.customWorkout!);
    const summary = totals.total.byUnit.map(formatDistance).join(" + ");

    return text(
      `Wrote ${target} (${bytes.length} bytes)\n` +
        `${steps(binary.customWorkout!).length} steps` +
        (summary === "" ? "" : `, ${summary} total`),
    );
  },
);

server.registerTool(
  "inspect_workout",
  {
    title: "Inspect a workout file",
    description:
      "Decode an existing .workout file and describe it. Reports any fields this schema does not model.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => {
    let binary;
    try {
      binary = decode(readFileSync(resolve(path)));
    } catch (error) {
      return text(`Could not read: ${(error as Error).message}`);
    }

    const unknown = findUnknownFields(WorkoutBinarySchema, binary);
    const custom = binary.customWorkout;
    if (custom === undefined) {
      return text(`Single-goal workout. GUID ${binary.GUID}.`);
    }

    const activity = CustomWorkout_ActivityType[custom.activityType] ?? "unknown";
    const totals = totalDistance(custom);
    const lines = [
      `${custom.displayName === "" ? "(unnamed)" : custom.displayName} — ${activity}`,
      ...steps(custom).map((s) => {
        const goal =
          s.goal.kind === "distance"
            ? formatDistance(s.goal.distance)
            : s.goal.kind === "time"
              ? formatDuration(s.goal.duration)
              : s.goal.kind === "distanceTime"
                ? `${formatDistance(s.goal.distance)} on ${formatDuration(s.goal.duration)}`
                : s.goal.kind;
        const label = s.label === undefined || s.label === "" ? "" : `  ${s.label}`;
        return `  ${s.position.kind.padEnd(9)} ${goal}${label}`;
      }),
      `total ${totals.total.byUnit.map(formatDistance).join(" + ")}`,
    ];
    if (unknown.length > 0) lines.push(`unknown fields: ${unknown.length}`);
    return text(lines.join("\n"));
  },
);

await server.connect(new StdioServerTransport());
