// Emits packages/domain/src/generated/compatibility-data.ts from
// constraints/compatibility.json.
//
// The matrix is loaded at BUILD time, not read from disk at runtime, so the
// domain layer stays usable in a browser and carries no filesystem dependency.
// It is emitted verbatim: no reshaping, no filtering, no "simplifying". The
// moment this script starts interpreting the data, constraints/README.md's
// single-source-of-truth guarantee stops holding, because the interpretation
// would live here rather than in the file.
//
// A SHA-256 of the source is emitted alongside it. `compatibility.test.ts`
// recomputes it and fails if the JSON has changed without regeneration, so the
// two cannot drift silently.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(repoRoot, "constraints", "compatibility.json");
const outPath = join(
  repoRoot,
  "packages",
  "domain",
  "src",
  "generated",
  "compatibility-data.ts",
);

const raw = readFileSync(sourcePath, "utf8");
// Hash the text with line endings normalised. Git checks this file out as CRLF
// on Windows, so hashing the bytes as they sit on disk gives a constant that
// depends on who ran the generator and fails CI on Linux.
const sha256 = createHash("sha256").update(raw.replace(/\r\n/g, "\n"), "utf8").digest("hex");
const data = JSON.parse(raw);

const banner = `// @generated from constraints/compatibility.json — DO NOT EDIT.
//
// Regenerate with \`npm run generate:constraints\`.
//
// constraints/compatibility.json is the single source of truth for which goals
// and alerts each sport allows. This file is a build-time transcription of it so
// the validator has no runtime filesystem dependency. Editing it by hand, or
// restating the matrix anywhere else in TypeScript or prose, reintroduces
// exactly the drift the data file exists to prevent.
`;

const body = `${banner}
/** SHA-256 of constraints/compatibility.json at generation time. */
export const COMPATIBILITY_SOURCE_SHA256 =
  ${JSON.stringify(sha256)};

/** Path of the source file, relative to the repo root. */
export const COMPATIBILITY_SOURCE_PATH = "constraints/compatibility.json";

export const COMPATIBILITY = ${JSON.stringify(data, null, 2)} as const;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, body.replaceAll("\r\n", "\n"), "utf8");

process.stdout.write(
  `wrote ${outPath.slice(repoRoot.length + 1)} (source sha256 ${sha256.slice(0, 12)}…)\n`,
);
