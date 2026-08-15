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
  alertShapeFor,
  capabilitiesFor,
  formatDistance,
  formatDuration,
  steps,
  totalDistance,
  validateWorkout,
  workoutLink,
  type Issue,
} from "@dotworkout/domain";
import { qrBlock } from "./qr.js";
import { ACTIVITIES, buildWorkout, workoutShape, type Activity } from "./workout.js";

/** Where the composer is served. Override to point at a local build. */
const SITE = process.env.DOTWORKOUT_SITE ?? "https://workout.javierferrersb.dev";

/**
 * The file is on this machine and the Watch is not, so the useful thing to
 * hand back is a way onto the phone: the workout travels inside the link, so
 * scanning it opens the composer with the workout already loaded and nothing
 * is uploaded on the way.
 */
function handoff(bytes: Uint8Array, title: string | undefined): string {
  const link = workoutLink(bytes, { origin: SITE, ...(title === undefined ? {} : { title }) });
  const qr = qrBlock(link);
  const how = "Scan to open it on your phone, then download it there:";
  return qr === undefined
    ? `Too long for a QR code. Open on your phone:\n${link}`
    : `${how}\n\n${qr}\n\n${link}`;
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function issueLines(issues: readonly Issue[]): string {
  return issues.map((i) => `  [${i.code}] ${i.path}: ${i.message}`).join("\n");
}

function describe(activity: Activity): string {
  const outdoor = capabilitiesFor(activity, "outdoor");
  const indoor = capabilitiesFor(activity, "indoor");

  const lines = [
    activity + (outdoor.enumerated ? "" : " (never enumerated: anything allowed, with a warning)"),
    `  goals:  ${outdoor.goals.join(", ")}`,
    `  alerts: ${outdoor.alerts.length === 0 ? "none" : outdoor.alerts.join(", ")}`,
  ];

  const differsIndoors =
    indoor.goals.join() !== outdoor.goals.join() || indoor.alerts.join() !== outdoor.alerts.join();
  if (differsIndoors) {
    lines.push(`  indoors: goals ${indoor.goals.join(", ")} · alerts ${indoor.alerts.join(", ")}`);
  }

  if (outdoor.unverifiedAlerts.length > 0) {
    lines.push(`  alerts, unverified (allowed, will warn): ${outdoor.unverifiedAlerts.join(", ")}`);
  }
  if (outdoor.advisory !== undefined) lines.push(`  note:   ${outdoor.advisory}`);

  for (const metric of outdoor.alerts) {
    const shape = alertShapeFor(metric);
    const readings = shape.readings ? " · current or average" : "";
    lines.push(`    ${metric}: ${shape.styles.join(" | ")}${readings}`);
  }

  return lines.join("\n");
}

const server = new McpServer({ name: "dotworkout", version: "0.3.1" });

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
        (summary === "" ? "" : `, ${summary} total`) +
        `\n\n${handoff(bytes, spec.name)}`,
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
