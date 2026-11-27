import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { decode } from "@dotworkout/codec";
import { validateWorkout } from "@dotworkout/domain";
import { precheck } from "../src/precheck.js";
import { SKILL_FILES } from "../src/skills.generated.js";
import { VERSION } from "../src/version.js";
import { buildWorkout, workoutSchema } from "../src/workout.js";

// Tests run from dist/test, two levels below the package root.
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const skillsDir = join(packageRoot, "skills");

/** Every fenced json block in a markdown file, with the word after `json`. */
function jsonBlocks(markdown: string): { tag: string; body: string; line: number }[] {
  const blocks = [];
  const fence = /^```json([^\n]*)\n([\s\S]*?)^```/gm;
  for (let match = fence.exec(markdown); match !== null; match = fence.exec(markdown)) {
    const line = markdown.slice(0, match.index).split("\n").length;
    blocks.push({ tag: match[1]!.trim(), body: match[2]!, line });
  }
  return blocks;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("the skill's examples", () => {
  const files = ["SKILL.md", "references/examples.md"].map((name) => ({
    name,
    blocks: jsonBlocks(SKILL_FILES[`apple-watch-workouts/${name}`] ?? ""),
  }));

  it("has plenty of them", () => {
    const valid = files.flatMap((f) => f.blocks).filter((b) => b.tag === "");
    assert.ok(valid.length >= 20, `only ${valid.length} examples`);
  });

  for (const { name, blocks } of files) {
    for (const { tag, body, line } of blocks) {
      const where = `${name}:${line}`;
      const spec = workoutSchema.parse(JSON.parse(body));

      if (tag === "") {
        it(`${where} (${spec.name ?? spec.activity}) builds a file the Watch accepts`, () => {
          const { errors, warnings } = precheck(spec);
          assert.deepEqual(errors, [], where);
          assert.deepEqual(warnings, [], where);
          // toBytes runs the strict validator too, and throws on any error.
          const result = validateWorkout(decode(buildWorkout(spec).toBytes()));
          assert.deepEqual(result.errors, [], where);
        });
      } else if (tag === "invalid") {
        it(`${where} is refused, as the page says`, () => {
          assert.notDeepEqual(precheck(spec).errors, [], where);
        });
      } else if (tag === "warning") {
        it(`${where} warns but builds, as the page says`, () => {
          const { errors, warnings } = precheck(spec);
          assert.deepEqual(errors, [], where);
          assert.notDeepEqual(warnings, [], where);
        });
      } else {
        it(`${where} has a tag the test knows`, () => assert.fail(`unknown tag "${tag}"`));
      }
    }
  }
});

describe("the compiled-in skill", () => {
  it("matches the markdown it was generated from", () => {
    const onDisk = Object.fromEntries(
      walk(skillsDir).map((path) => [
        relative(skillsDir, path).split(sep).join("/"),
        readFileSync(path, "utf8").replace(/\r\n/g, "\n"),
      ]),
    );
    assert.deepEqual({ ...SKILL_FILES }, onDisk, "skills/ changed: run npm run generate:skills");
  });
});

describe("the reported version", () => {
  it("is the package version", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
      version: string;
    };
    assert.equal(VERSION, pkg.version);
  });
});
