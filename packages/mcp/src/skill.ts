import {
  SkillsExtension,
  memorySkillFiles,
  type SkillCatalog,
} from "@modelcontextprotocol/server/ext/skills";
import { SKILL_FILES } from "./skills.generated.js";

/**
 * The skill, served through the MCP Skills extension (SEP-2640).
 *
 * A host that supports the extension lists it with skills/list and loads it
 * like any local skill, tagged as coming from this server. Most hosts do not
 * yet, so the same text also reaches the model two other ways: the server
 * instructions point at the skill's URI (readable with plain resources/read),
 * and the plan_workout prompt carries the text itself.
 */
export const SKILL_NAME = "apple-watch-workouts";
export const SKILL_URI = `skill://dotworkout/${SKILL_NAME}/SKILL.md`;

let catalog: Promise<SkillCatalog> | undefined;

/**
 * Built on first use rather than at import: building hashes every file, and a
 * Worker may not do async work while its module is being evaluated. The
 * content is compiled in, so one build serves every request after it.
 */
export function skillCatalog(): Promise<SkillCatalog> {
  catalog ??= SkillsExtension.load(memorySkillFiles({ ...SKILL_FILES }), {
    prefix: "dotworkout",
    // A broken skill is a bug in this repo, not something to serve around.
    strict: true,
    cacheHint: { ttlMs: 60 * 60 * 1000, cacheScope: "public" },
  });
  return catalog;
}

function withoutFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n+/, "");
}

/** The skill as one message, for the plan_workout prompt. */
export function skillPrompt(request: string | undefined): string {
  const guide = withoutFrontmatter(SKILL_FILES[`${SKILL_NAME}/SKILL.md`] ?? "");
  const examples = SKILL_FILES[`${SKILL_NAME}/references/examples.md`] ?? "";
  const ask =
    request === undefined || request.trim() === ""
      ? "Ask me what workout I want, then build it."
      : `Build this workout: ${request.trim()}`;
  return `${guide}\n\n---\n\n${examples}\n\n---\n\n${ask}`;
}
