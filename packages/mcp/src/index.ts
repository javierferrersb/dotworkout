#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { validateWorkout, type Issue } from "@dotworkout/domain";
import { decode } from "@dotworkout/codec";
import { qrBlock } from "./qr.js";
import { buildServer, type LocalAccess } from "./server.js";

/** Where the composer is served. Override to point at a local build. */
const SITE = process.env.DOTWORKOUT_SITE ?? "https://workout.javierferrersb.dev";

/** `~/Desktop/x.workout` means the home folder, as it would in a shell. */
function expand(path: string): string {
  return resolve(path.replace(/^~(?=$|[/\\])/, homedir()));
}

function lines(issues: readonly Issue[]): string[] {
  return issues.map((i) => `[${i.code}] ${i.path}: ${i.message}`);
}

/**
 * Running on the caller's own machine: the file can go where they ask, and
 * the strict validator is affordable because there is no cold start to pay.
 */
const local: LocalAccess = {
  write(path, bytes) {
    const target = expand(path);
    writeFileSync(target, bytes);
    return target;
  },
  read: (path) => readFileSync(expand(path)),
  validate(bytes) {
    const result = validateWorkout(decode(bytes));
    return { errors: lines(result.errors), warnings: lines(result.warnings) };
  },
  qr: qrBlock,
};

serveStdio(() => buildServer({ site: SITE, local }));
