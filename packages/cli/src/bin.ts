#!/usr/bin/env node
/**
 * Entry point and argument routing.
 *
 * Hand-rolled parsing rather than a library: the surface is three commands and
 * six flags, and the whole package is dependency-free by design.
 */

import { writeFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { applyLines } from "./notation/apply.js";
import { parseLine } from "./notation/parse.js";
import { build, slug } from "./commands/build.js";
import { show } from "./commands/show.js";
import { runComposer } from "./tui/composer.js";
import { Painter, detectCapabilities } from "./ui/ansi.js";

const HELP = `
  dotworkout — compose Apple .workout files from the keyboard

  USAGE
    dotworkout                          open the interactive composer
    dotworkout new [--name <text>]      the same, with a title
    dotworkout build <set>...           write a file without the UI
    dotworkout show <file.workout>      decode and inspect an existing file

  OPTIONS
    -n, --name <text>     workout title (default: "Workout")
    -o, --out <path>      output file (default: derived from the name)
        --json            machine-readable output
    -q, --quiet           print only the written path
    -f, --force           write even if validation fails
    -h, --help            this text
    -v, --version

  NOTATION
    400 warmup            warm up of 400 m
    8x50 on 1:00          8 x 50 m, leaving every 1:00   (send-off)
    4x100 pull rest :20   labelled "pull", 20 s rest after each
    4x1:00                4 x 1 minute
    8x50 z3               heart-rate zone 3
    100y                  100 yards, stored as yards
    200 cd                cool down

    A bare number is a distance. Times need a colon or a unit — ':30', '30s'.

  EXAMPLES
    dotworkout build -n "Thursday threshold" \\
      "400 warmup" "8x50 on 1:00 Build" "4x100 pull r:20" "200 cd"

    dotworkout show testdata/PoolSwim_2.workout
`;

interface Args {
  readonly command: string;
  readonly positional: string[];
  readonly name: string;
  readonly out: string | undefined;
  readonly json: boolean;
  readonly quiet: boolean;
  readonly force: boolean;
  readonly help: boolean;
  readonly version: boolean;
}

export function parseArgs(argv: readonly string[]): Args {
  const positional: string[] = [];
  let name = "Workout";
  let out: string | undefined;
  let json = false;
  let quiet = false;
  let force = false;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "-n":
      case "--name":
        name = argv[++i] ?? name;
        break;
      case "-o":
      case "--out":
        out = argv[++i];
        break;
      case "--json":
        json = true;
        break;
      case "-q":
      case "--quiet":
        quiet = true;
        break;
      case "-f":
      case "--force":
        force = true;
        break;
      case "-h":
      case "--help":
        help = true;
        break;
      case "-v":
      case "--version":
        version = true;
        break;
      default:
        if (arg.startsWith("--")) {
          const [flag, value] = arg.split("=", 2);
          if (flag === "--name" && value !== undefined) name = value;
          else if (flag === "--out" && value !== undefined) out = value;
          else positional.push(arg);
        } else {
          positional.push(arg);
        }
    }
  }

  const known = new Set(["new", "build", "show", "help"]);
  const command = positional.length > 0 && known.has(positional[0]!) ? positional.shift()! : "";
  return { command, positional, name, out, json, quiet, force, help, version };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.command === "help") {
    stdout.write(HELP);
    return 0;
  }
  if (args.version) {
    stdout.write("0.1.0\n");
    return 0;
  }

  switch (args.command) {
    case "show": {
      const path = args.positional[0];
      if (path === undefined) {
        process.stderr.write("show needs a file\n");
        return 64;
      }
      return show(path, { json: args.json });
    }

    case "build": {
      const sets = args.positional.length > 0 ? args.positional : await readStdinLines();
      return build(sets, {
        name: args.name,
        out: args.out,
        json: args.json,
        quiet: args.quiet,
        force: args.force,
      });
    }

    default:
      return await compose(args);
  }
}

async function compose(args: Args): Promise<number> {
  const caps = detectCapabilities();
  const painter = new Painter(caps);

  if (!caps.interactive) {
    process.stderr.write(
      "the composer needs a terminal — pipe sets to `dotworkout build` instead\n",
    );
    return 64;
  }

  const result = await runComposer(args.name === "Workout" ? {} : { name: args.name });
  if (!result.saved || result.lines.length === 0) {
    stdout.write(painter.paint("  nothing written\n", "dim"));
    return result.saved ? 0 : 130; // 130 = terminated by Ctrl+C
  }

  const name = result.name === "" ? "Workout" : result.name;
  const builder = applyLines(result.lines.map(parseLine), { name });
  const validation = builder.validate();

  for (const warning of validation.warnings) {
    process.stderr.write(`${painter.paint("warning", "yellow")} ${warning.message}\n`);
  }
  if (!validation.ok) {
    process.stderr.write(`${painter.paint("invalid workout", "red", "bold")}\n`);
    for (const issue of validation.errors) {
      process.stderr.write(`  ${painter.paint(issue.code, "red")} ${issue.message}\n`);
    }
    return 65;
  }

  const path = args.out ?? `${slug(name)}.workout`;
  writeFileSync(path, builder.toBytes({ skipValidation: true }));
  stdout.write(
    `  ${painter.paint(painter.glyph("✓", "+"), "green")} wrote ${painter.paint(path, "bold")}\n\n`,
  );
  return 0;
}

async function readStdinLines(): Promise<string[]> {
  if (stdin.isTTY) return [];
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 70; // EX_SOFTWARE
  });
