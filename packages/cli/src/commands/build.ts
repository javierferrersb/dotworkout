/**
 * `dotworkout build` — non-interactive generation, for scripts and pipes.
 *
 * Takes notation as arguments, one set per argument, or on stdin one per line.
 * Exists so the composer is not the only way in: a workout you swim every week
 * belongs in a shell script, not retyped.
 */

import { writeFileSync } from "node:fs";
import { applyLines } from "@dotworkout/notation";
import { parseLine, type ParsedLine } from "@dotworkout/notation";
import { NotationError } from "@dotworkout/notation";
import { Painter, detectCapabilities } from "../ui/ansi.js";
import { renderHeader, renderRows, renderTotals, summarize } from "../ui/format.js";

export interface BuildOptions {
  readonly name: string;
  readonly out: string | undefined;
  readonly json: boolean;
  readonly quiet: boolean;
  /** Write the file even if validation reports errors. */
  readonly force: boolean;
}

export function build(sets: readonly string[], options: BuildOptions): number {
  const caps = detectCapabilities();
  const painter = new Painter(caps);
  const width = Math.max(48, caps.columns);

  const parsed: ParsedLine[] = [];
  for (const [index, text] of sets.entries()) {
    try {
      parsed.push(parseLine(text));
    } catch (error) {
      if (error instanceof NotationError) {
        // Point at the character, not just the argument — the same diagnostic
        // the composer shows live.
        process.stderr.write(
          `${painter.paint("error", "red", "bold")} in set ${index + 1}: ${error.message}\n\n` +
            `  ${text}\n` +
            `  ${painter.paint(error.caret(), "red")}\n` +
            (error.hint === undefined ? "" : `\n  ${painter.paint(error.hint, "dim")}\n`),
        );
        return 64; // EX_USAGE
      }
      throw error;
    }
  }

  if (parsed.length === 0) {
    process.stderr.write("nothing to build — pass sets as arguments or on stdin\n");
    return 64;
  }

  const builder = applyLines(parsed, { name: options.name });
  const binary = builder.build();
  const validation = builder.validate();

  for (const warning of validation.warnings) {
    if (!options.quiet) {
      process.stderr.write(`${painter.paint("warning", "yellow")} ${warning.message}\n`);
    }
  }

  if (!validation.ok && !options.force) {
    process.stderr.write(`${painter.paint("invalid workout", "red", "bold")}\n`);
    for (const issue of validation.errors) {
      process.stderr.write(`  ${painter.paint(issue.code, "red")} ${issue.message}\n`);
    }
    process.stderr.write(`\nUse --force to write it anyway.\n`);
    return 65; // EX_DATAERR
  }

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({ name: options.name, guid: binary.GUID, sets: [...sets] }, null, 2)}\n`,
    );
    return 0;
  }

  const path = options.out ?? `${slug(options.name)}.workout`;
  writeFileSync(path, builder.toBytes({ skipValidation: true }));

  if (!options.quiet) {
    const workout = binary.customWorkout;
    const out: string[] = [""];
    if (workout !== undefined) {
      out.push(renderHeader(options.name, workout, painter, width));
      out.push("");
      out.push(...renderRows(summarize(workout), { painter, width }));
      out.push(...renderTotals(workout, painter, width));
    }
    out.push("");
    out.push(`  ${painter.paint(painter.glyph("✓", "+"), "green")} wrote ${painter.paint(path, "bold")}`);
    out.push("");
    process.stdout.write(`${out.join("\n")}\n`);
  } else {
    process.stdout.write(`${path}\n`);
  }

  return 0;
}

/** A filename that survives being sent over WhatsApp and back. */
export function slug(name: string): string {
  const cleaned = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned === "" ? "workout" : cleaned;
}
