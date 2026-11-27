import { McpServer, type CacheHint } from "@modelcontextprotocol/server";
import { z } from "zod";
import { decode } from "@dotworkout/codec";
import { readWorkoutLink, steps, workoutLink } from "@dotworkout/domain";
import { attachment, fileNameFor } from "./attach.js";
import { bullets, describeActivity, describeWorkout, totalOf } from "./describe.js";
import { precheck } from "./precheck.js";
import { SKILL_URI, skillCatalog, skillPrompt } from "./skill.js";
import { VERSION } from "./version.js";
import { ACTIVITIES, buildWorkout, workoutShape, type WorkoutSpec } from "./workout.js";

/**
 * One definition of the server, served two ways.
 *
 * Over stdio it runs on the caller's own machine, so it can write the file
 * where they ask and draw a QR code in their terminal. Over HTTP the disk is
 * not theirs, so the link is the whole deliverable. Everything else — tools,
 * skill, prompt, instructions — is the same, and lives here once.
 *
 * The parts that need Node are passed in rather than imported, so the Workers
 * bundle never pulls in `node:fs`.
 */
export interface LocalAccess {
  /** Writes the file and returns the absolute path it went to. */
  write(path: string, bytes: Uint8Array): string;
  read(path: string): Uint8Array;
  /** Strict structural validation; heavier than the matrix check, so local only. */
  validate(bytes: Uint8Array): { errors: string[]; warnings: string[] };
  /** A terminal QR code for the link, or undefined when the link is too long. */
  qr(link: string): string | undefined;
}

export interface ServerOptions {
  /** Where the composer is served, e.g. https://workout.javierferrersb.dev */
  readonly site: string;
  /** Present when running on the caller's machine. */
  readonly local?: LocalAccess;
}

/** Nothing here changes between deploys often enough to refetch within the hour. */
const STATIC: CacheHint = { ttlMs: 60 * 60 * 1000, cacheScope: "public" };

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;

/**
 * What the model must do with the link, said where it reads it. Models like to
 * tidy a long URL into "here's your workout" with no link at all, or shorten
 * it; either way the workout is gone, because the link is the workout.
 */
const LINK_RULE =
  "Give the user this link in full, on its own line. The workout is inside the link, so a shortened, retyped or omitted link loses it. Opening it on their iPhone shows the workout with a “Save the workout” button; once saved, the Workout app takes it from there.";

export const INSTRUCTIONS = `dotworkout builds custom workouts for the Apple Watch Workout app (.workout files): intervals, warm ups, cool downs, repeats, swim send-offs, and heart rate, pace, power or cadence targets.

Work in this order: list_activities or describe_activity to see what the sport supports, validate_workout to check the plan, then create_workout. Never guess support: a power target on a swim, or a distance goal on an indoor bike, makes a file the Watch rejects.

create_workout returns a link that carries the whole workout. Always give the user that full link on its own line: opening it on their iPhone is how the workout reaches the Watch. Never shorten it, retype it, or try to turn it into a file yourself.

For worked examples (Norwegian 4×4, swim pyramids, tempo runs, FTP intervals, HIIT…) and the units each field takes, read the skill at ${SKILL_URI} or get the plan_workout prompt.`;

const ICON = (site: string) => [
  { src: `${site.replace(/\/+$/, "")}/icon-192.png`, mimeType: "image/png", sizes: ["192x192"] },
];

const createOutput = z.object({
  link: z.string().describe("the workout itself, as a link; show it to the user in full"),
  fileName: z.string(),
  sizeBytes: z.number(),
  steps: z.number(),
  totalDistance: z.string().optional(),
  warnings: z.array(z.string()),
  savedTo: z.string().optional().describe("where the file was written, when it was"),
});

const validateOutput = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

function failure(body: string) {
  return { ...text(body), isError: true };
}

function validationText(errors: readonly string[], warnings: readonly string[]): string {
  const parts = [
    errors.length > 0 ? "Invalid." : warnings.length > 0 ? "Valid, with warnings." : "Valid.",
  ];
  if (errors.length > 0) parts.push(`Errors:\n${bullets(errors)}`);
  if (warnings.length > 0) parts.push(`Warnings:\n${bullets(warnings)}`);
  return parts.join("\n\n");
}

/** Matrix errors first; locally, the strict validator on the built file as well. */
function check(spec: WorkoutSpec, local: LocalAccess | undefined) {
  const { errors, warnings } = precheck(spec);
  const result = { errors: [...errors], warnings: [...warnings] };
  if (errors.length > 0 || local === undefined) return result;

  try {
    const strict = local.validate(buildWorkout(spec).toBytes({ skipValidation: true }));
    result.errors.push(...strict.errors);
    for (const warning of strict.warnings) {
      if (!result.warnings.includes(warning)) result.warnings.push(warning);
    }
  } catch (error) {
    result.errors.push((error as Error).message);
  }
  return result;
}

export async function buildServer(options: ServerOptions): Promise<McpServer> {
  const { site, local } = options;

  const server = new McpServer(
    {
      name: "dotworkout",
      title: "dotworkout",
      version: VERSION,
      description: "Build custom Apple Watch workouts and get them onto the phone.",
      websiteUrl: site,
      icons: ICON(site),
    },
    {
      instructions: INSTRUCTIONS,
      cacheHints: {
        "server/discover": STATIC,
        "tools/list": STATIC,
        "prompts/list": STATIC,
        "resources/list": STATIC,
        "resources/templates/list": STATIC,
      },
    },
  );

  server.registerTool(
    "list_activities",
    {
      title: "List activities",
      description:
        "Every activity that can be built, with the goals and alerts each one supports indoors and out. Read this before building a workout: support differs per activity and guessing produces files the Watch rejects.",
      annotations: READ_ONLY,
    },
    async () => text(ACTIVITIES.map(describeActivity).join("\n\n")),
  );

  server.registerTool(
    "describe_activity",
    {
      title: "Describe an activity",
      description:
        "Goals, alerts and caveats for one activity, from the compatibility matrix read off a real device.",
      inputSchema: z.object({ activity: z.enum(ACTIVITIES) }),
      annotations: READ_ONLY,
    },
    async ({ activity }) => text(describeActivity(activity)),
  );

  server.registerTool(
    "validate_workout",
    {
      title: "Validate a workout",
      description:
        "Check a workout against what the activity supports, without building it. Returns every error and warning, each naming the step it is about. Unverified combinations warn rather than fail.",
      inputSchema: z.object(workoutShape),
      outputSchema: validateOutput,
      annotations: READ_ONLY,
    },
    async (spec) => {
      const { errors, warnings } = check(spec, local);
      return {
        ...text(validationText(errors, warnings)),
        structuredContent: { valid: errors.length === 0, errors, warnings },
      };
    },
  );

  const createInput = z.object({
    ...workoutShape,
    ...(local === undefined
      ? {
          attachFile: z
            .boolean()
            .optional()
            .describe(
              "also return the file itself, for clients that render an attachment. Off by default: a client that cannot render one rejects the whole reply rather than ignoring it, and then nothing comes back at all.",
            ),
        }
      : {
          outputPath: z
            .string()
            .optional()
            .describe("also write the file here, e.g. ~/Desktop/4x4.workout"),
        }),
  });

  server.registerTool(
    "create_workout",
    {
      title: "Create a workout",
      description:
        local === undefined
          ? "Build a workout and return a link that opens it on the user's iPhone, ready to save into the Workout app. Always show the user the full link. Check list_activities first for what the activity supports."
          : "Build a workout and return a link (and a QR code) that opens it on the user's iPhone, ready to save into the Workout app; give outputPath to also write the .workout file. Always show the user the full link. Check list_activities first for what the activity supports.",
      inputSchema: createInput,
      outputSchema: createOutput,
      annotations:
        local === undefined
          ? READ_ONLY
          : // Writing to outputPath replaces whatever file is already there.
            {
              readOnlyHint: false,
              destructiveHint: true,
              idempotentHint: true,
              openWorldHint: false,
            },
    },
    async (input) => {
      const { attachFile, outputPath, ...spec } = input as typeof input & {
        attachFile?: boolean;
        outputPath?: string;
      };

      const { errors, warnings } = check(spec, local);
      if (errors.length > 0) return failure(`Not built:\n${bullets(errors)}`);

      let bytes;
      try {
        bytes = buildWorkout(spec).toBytes({ skipValidation: true });
      } catch (error) {
        return failure(`Not built: ${(error as Error).message}`);
      }

      let savedTo: string | undefined;
      if (outputPath !== undefined && local !== undefined) {
        try {
          savedTo = local.write(outputPath, bytes);
        } catch (error) {
          return failure(`Built, but could not write ${outputPath}: ${(error as Error).message}`);
        }
      }

      const custom = decode(bytes).customWorkout;
      const stepCount = custom === undefined ? 0 : steps(custom).length;
      const total = custom === undefined ? "" : totalOf(custom);
      const link = workoutLink(bytes, {
        origin: site,
        ...(spec.name === undefined ? {} : { title: spec.name }),
      });
      const fileName = fileNameFor(spec.name ?? "workout");

      const lines = [
        `Built ${spec.name === undefined ? "the workout" : `"${spec.name}"`}: ${stepCount} ${stepCount === 1 ? "step" : "steps"}` +
          (total === "" ? "" : `, ${total} total`) +
          ` (${fileName}, ${bytes.length} bytes).`,
      ];
      if (savedTo !== undefined) lines.push(`Wrote ${savedTo}.`);
      if (warnings.length > 0) lines.push(`Warnings:\n${bullets(warnings)}`);
      lines.push(LINK_RULE, link);

      const qr = local?.qr(link);
      if (qr !== undefined) lines.push(`Or scan this with the iPhone camera:\n\n${qr}`);

      const structuredContent = {
        link,
        fileName,
        sizeBytes: bytes.length,
        steps: stepCount,
        ...(total === "" ? {} : { totalDistance: total }),
        warnings,
        ...(savedTo === undefined ? {} : { savedTo }),
      };

      const content: ({ type: "text"; text: string } | ReturnType<typeof attachment>)[] = [
        { type: "text", text: lines.join("\n\n") },
      ];
      // The attachment is off unless asked for. A client that does not render
      // embedded resources does not skip the block — it fails the whole reply
      // against its own schema, and the caller gets an error rather than a
      // workout. Sending it by default trades a working link for that.
      if (attachFile === true) content.push(attachment(bytes, spec.name ?? "workout", link));

      return { content, structuredContent };
    },
  );

  server.registerTool(
    "inspect_workout",
    {
      title: "Inspect a workout",
      description:
        local === undefined
          ? "Decode a dotworkout link and describe the workout inside it, step by step. Takes the link create_workout returned, or one shared from the composer."
          : "Decode a workout and describe it, step by step. Takes a dotworkout link, or the path to a .workout file.",
      inputSchema: z.object({
        source: z
          .string()
          .describe(
            local === undefined
              ? "a dotworkout URL, or just its #w=… fragment"
              : "a dotworkout URL (or its #w=… fragment), or a path to a .workout file",
          ),
      }),
      annotations: READ_ONLY,
    },
    async ({ source }) => {
      let bytes: Uint8Array;
      let title = "Workout";
      const at = source.indexOf("#");
      const isLink = at !== -1 || source.includes("w=") || /^https?:/i.test(source);

      if (isLink || local === undefined) {
        const inbound = readWorkoutLink(at === -1 ? source : source.slice(at));
        if (inbound === undefined) {
          return failure("That is not a dotworkout link: there is no workout in it.");
        }
        bytes = inbound.bytes;
        title = inbound.title;
      } else {
        try {
          bytes = local.read(source);
        } catch (error) {
          return failure(`Could not read ${source}: ${(error as Error).message}`);
        }
      }

      let custom;
      try {
        custom = decode(bytes).customWorkout;
      } catch (error) {
        return failure(`Not a workout this can read: ${(error as Error).message}`);
      }
      if (custom === undefined) return text(`Single-goal workout named ${title}.`);
      return text(describeWorkout(custom, title));
    },
  );

  server.registerPrompt(
    "plan_workout",
    {
      title: "Plan a workout",
      description:
        "Everything needed to turn a training idea into a workout on the Watch: the workflow, the rules per sport, and worked examples. For clients that do not load skills.",
      argsSchema: z.object({
        request: z
          .string()
          .optional()
          .describe('what to build, e.g. "a Norwegian 4×4 on the bike"'),
      }),
    },
    async ({ request }) => ({
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: skillPrompt(request) } },
      ],
    }),
  );

  (await skillCatalog()).attach(server);
  return server;
}
