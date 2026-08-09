import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Walk up to the repo root rather than counting `..` from the build output. */
function repoRoot(): string {
  let dir = import.meta.dirname;
  for (;;) {
    if (existsSync(join(dir, "testdata")) && existsSync(join(dir, "proto"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No repo root above ${import.meta.dirname}`);
    dir = parent;
  }
}

export const ROOT: string = repoRoot();
export const TESTDATA_DIR: string = join(ROOT, "testdata");

export function workoutBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(TESTDATA_DIR, `${name}.workout`)));
}

export function expectedJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(TESTDATA_DIR, `${name}.json`), "utf8")) as Record<
    string,
    unknown
  >;
}

export function corpusNames(): string[] {
  return readdirSync(TESTDATA_DIR)
    .filter((f) => f.endsWith(".workout"))
    .map((f) => f.slice(0, -".workout".length))
    .sort();
}
