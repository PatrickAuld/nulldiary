import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractSkill } from "./extract-skill.js";

describe("extractSkill", () => {
  it("returns the full content of a SKILL.md fixture", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-skill-"));
    const skillPath = join(dir, "SKILL.md");
    const content = "---\nname: test\n---\n\n# Heading\n\nbody text.\n";
    writeFileSync(skillPath, content, "utf8");

    try {
      expect(extractSkill(skillPath)).toBe(content);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws a clear error when the skill file is missing", () => {
    expect(() => extractSkill("/nonexistent/path/SKILL.md")).toThrow(
      /SKILL\.md/,
    );
  });

  it("preserves UTF-8 content verbatim", () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-skill-"));
    const skillPath = join(dir, "SKILL.md");
    const content = "thoughts — em dashes — and unicode ✦ stay intact\n";
    writeFileSync(skillPath, content, "utf8");

    try {
      expect(extractSkill(skillPath)).toBe(content);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
