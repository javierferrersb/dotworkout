import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface CorpusEntry {
  /** File stem, e.g. `Swim_DistTime`. */
  readonly name: string;
  readonly workoutPath: string;
  readonly jsonPath: string;
}

/**
 * Locate the repo root by walking up until we find the corpus directories,
 * rather than counting `..` segments from the compiled output. Tests run from
 * `packages/<pkg>/dist/test/`, and hard-coding that depth breaks the moment the
 * build layout changes.
 */
export function repoRoot(): string {
  let dir = import.meta.dirname;
  for (;;) {
    if (existsSync(join(dir, "testdata")) && existsSync(join(dir, "proto"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find the repo root (a directory containing both testdata/ and proto/) ` +
          `walking up from ${import.meta.dirname}`,
      );
    }
    dir = parent;
  }
}

export const TESTDATA_DIR: string = join(repoRoot(), "testdata");

/**
 * Every `.workout` file in `testdata/`, discovered rather than listed, so a new
 * corpus file is picked up by simply dropping it in — and so a file missing its
 * paired `.json` fails loudly instead of being silently skipped.
 */
export const corpus: readonly CorpusEntry[] = readdirSync(TESTDATA_DIR)
  .filter((f) => f.endsWith(".workout"))
  .sort()
  .map((file) => {
    const name = file.slice(0, -".workout".length);
    const jsonPath = resolve(TESTDATA_DIR, `${name}.json`);
    if (!existsSync(jsonPath)) {
      throw new Error(`${file} has no paired ${name}.json in testdata/`);
    }
    return { name, workoutPath: resolve(TESTDATA_DIR, file), jsonPath };
  });

export function readWorkoutBytes(entry: CorpusEntry): Uint8Array {
  return new Uint8Array(readFileSync(entry.workoutPath));
}

/**
 * The expected decoding.
 *
 * Note that the fixtures write doubles as `100.0`; `JSON.parse` yields the
 * number `100`. Comparisons must therefore be against parsed values, never
 * against the raw text.
 */
export function readExpectedJson(entry: CorpusEntry): unknown {
  return JSON.parse(readFileSync(entry.jsonPath, "utf8"));
}

export function findEntry(name: string): CorpusEntry {
  const entry = corpus.find((e) => e.name === name);
  if (entry === undefined) throw new Error(`No corpus entry named ${name}`);
  return entry;
}
