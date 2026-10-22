import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isExampleMessage } from "./is-example-message.js";

describe("isExampleMessage", () => {
  it("covers request examples published in the site and Markdown docs", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const files = [
      "apps/public/src/app/page.tsx",
      "apps/public/src/app/about/page.tsx",
      "apps/public/public/skill.md",
      "README.md",
    ];
    function collectDocs(directory: string) {
      for (const entry of readdirSync(join(root, directory), {
        withFileTypes: true,
      })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collectDocs(path);
        else if (path.endsWith(".md")) files.push(path);
      }
    }
    collectDocs("docs");

    const examples: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      for (const match of source.matchAll(/\/s\/(<[^>]+>|[^\s`"'<>]+)/g)) {
        if (match[1].startsWith("*")) continue;
        examples.push(match[1]);
        const text = decodeURIComponent(match[1].replace(/\+/g, " "));
        expect(isExampleMessage(text), `${file}: ${text}`).toBe(true);
      }
      for (const match of source.matchAll(
        /\/s\?(?:message|secret)=([^\s`"'<>]+)/g,
      )) {
        examples.push(match[1]);
        const text = decodeURIComponent(match[1].replace(/\+/g, " "));
        expect(isExampleMessage(text), `${file}: ${text}`).toBe(true);
      }
    }
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each([
    "i remember things i shouldn't",
    "  I REMEMBER\nTHINGS\tI SHOULDN’T  ",
    "ｉ remember things i shouldn't",
    "your thought",
    "...",
    "…",
    "<message>",
    "<url-encoded-thought>",
  ])("recognizes published example or placeholder: %s", (text) => {
    expect(isExampleMessage(text)).toBe(true);
  });

  it.each([
    "I remember things I shouldn't, and that worries me",
    "I remember things I should",
    "These are your thoughts",
    "An original confession...",
    "hello",
    "",
  ])("preserves distinct content: %s", (text) => {
    expect(isExampleMessage(text)).toBe(false);
  });
});
