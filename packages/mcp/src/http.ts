import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { decode } from "@dotworkout/codec";
import {
  alertShapeFor,
  capabilitiesFor,
  formatDistance,
  formatDuration,
  readWorkoutLink,
  steps,
  totalDistance,
  workoutLink,
} from "@dotworkout/domain";
import { attachment, fileNameFor } from "./attach.js";
import { precheck } from "./precheck.js";
import { ACTIVITIES, buildWorkout, workoutShape, type Activity } from "./workout.js";

/**
 * The same tools as the stdio server, minus the parts that only mean anything
 * on a machine the caller owns.
 *
 * create_workout cannot write a file here: the disk this runs on is not the one
 * next to the caller's phone. It hands back a link instead — the workout
 * travels inside it, so opening it on a phone loads the composer with the
 * workout ready to download, and nothing is uploaded on the way. That makes the
 * link the deliverable rather than a courtesy, which is why it is also how
 * inspect_workout takes a workout back in.
 */
export interface ServerOptions {
  /** Where the composer is served, e.g. https://workout.example.dev */
  readonly site: string;
}

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function bullets(lines: readonly string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
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

export function createServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: "dotworkout", version: "0.5.0" });

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
        "Check a workout against what the sport supports, without building anything. Unverified combinations warn rather than fail.",
      inputSchema: workoutShape,
    },
    async (spec) => {
      const { errors, warnings } = precheck(spec);
      if (errors.length === 0 && warnings.length === 0) return text("Valid.");

      const parts = [errors.length === 0 ? "Valid, with warnings." : "Invalid."];
      if (errors.length > 0) parts.push(`Errors:\n${bullets(errors)}`);
      if (warnings.length > 0) parts.push(`Warnings:\n${bullets(warnings)}`);
      return text(parts.join("\n\n"));
    },
  );

  server.registerTool(
    "create_workout",
    {
      title: "Create a workout",
      description:
        "Build a .workout file and return a link that opens it on a phone, ready to download into the Workout app. Check list_activities first for what the activity supports.",
      inputSchema: workoutShape,
    },
    async (spec) => {
      const { errors, warnings } = precheck(spec);
      if (errors.length > 0) return text(`Not built:\n${bullets(errors)}`);

      let bytes;
      try {
        bytes = buildWorkout(spec).toBytes({ skipValidation: true });
      } catch (error) {
        return text(`Not built: ${(error as Error).message}`);
      }

      const custom = decode(bytes).customWorkout;
      const summary =
        custom === undefined
          ? ""
          : totalDistance(custom).total.byUnit.map(formatDistance).join(" + ");
      const link = workoutLink(bytes, {
        origin: options.site,
        ...(spec.name === undefined ? {} : { title: spec.name }),
      });
      const name = fileNameFor(spec.name ?? "workout");
      const head =
        `${custom === undefined ? 0 : steps(custom).length} steps` +
        (summary === "" ? "" : `, ${summary} total`) +
        ` — ${name} (${bytes.length} bytes)`;
      const warned = warnings.length === 0 ? "" : `\n\nWarnings:\n${bullets(warnings)}`;

      // Both, deliberately. The file is the thing to save where a client will
      // show it; the link is what gets it onto a phone, and it still works
      // where the file does not. Neither asks anyone to decode base64 by hand.
      return {
        content: [
          {
            type: "text" as const,
            text:
              `${head}${warned}\n\nThe file is attached. Save it and open it on your phone, ` +
              `or open this there instead:\n${link}`,
          },
          attachment(bytes, spec.name ?? "workout", link),
        ],
      };
    },
  );

  server.registerTool(
    "inspect_workout",
    {
      title: "Inspect a workout link",
      description:
        "Decode a dotworkout link and describe the workout inside it. Takes the link create_workout returned, or one shared from the composer.",
      inputSchema: { link: z.string().describe("a dotworkout URL, or just its #w=… fragment") },
    },
    async ({ link }) => {
      const at = link.indexOf("#");
      const inbound = readWorkoutLink(at === -1 ? link : link.slice(at));
      if (inbound === undefined) return text("That is not a dotworkout link — no workout in it.");

      let custom;
      try {
        custom = decode(inbound.bytes).customWorkout;
      } catch (error) {
        return text(`Could not read it: ${(error as Error).message}`);
      }
      if (custom === undefined) return text(`Single-goal workout named ${inbound.title}.`);

      const lines = [
        custom.displayName === "" ? inbound.title : custom.displayName,
        ...steps(custom).map((step) => {
          const goal =
            step.goal.kind === "distance"
              ? formatDistance(step.goal.distance)
              : step.goal.kind === "time"
                ? formatDuration(step.goal.duration)
                : step.goal.kind === "distanceTime"
                  ? `${formatDistance(step.goal.distance)} on ${formatDuration(step.goal.duration)}`
                  : step.goal.kind;
          const label = step.label === undefined || step.label === "" ? "" : `  ${step.label}`;
          return `  ${step.position.kind.padEnd(9)} ${goal}${label}`;
        }),
        `total ${totalDistance(custom).total.byUnit.map(formatDistance).join(" + ")}`,
      ];
      return text(lines.join("\n"));
    },
  );

  return server;
}

/**
 * One transport and one server per request, holding no session. There is no
 * state worth keeping between calls, and a server that keeps none cannot leak
 * one caller's workout into another's.
 */
export async function handle(request: Request, options: ServerOptions): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createServer(options);
  await server.connect(transport);
  return transport.handleRequest(request);
}
