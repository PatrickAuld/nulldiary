import { readFileSync } from "node:fs";

/**
 * Read the full content of a SKILL.md file at the given path.
 *
 * The seed harness exercises the *entire* skill (including frontmatter,
 * formatting rules, and submission examples) end-to-end, so this returns the
 * raw file contents verbatim — no parsing, no stripping.
 */
export function extractSkill(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read SKILL.md at ${path}: ${cause}`);
  }
}
