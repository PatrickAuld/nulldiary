import { describe, it, expect } from "vitest";
import { normalizeMessage, hashContent } from "./normalize.js";

describe("normalizeMessage", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeMessage("  hello  ")).toBe("hello");
  });

  it("collapses runs of whitespace to a single space", () => {
    expect(normalizeMessage("hello   world")).toBe("hello world");
    expect(normalizeMessage("a\t\nb")).toBe("a b");
  });

  it("lowercases text", () => {
    expect(normalizeMessage("Hello World")).toBe("hello world");
  });

  it("applies Unicode NFKC normalization (full-width → ASCII)", () => {
    // Ｈｅｌｌｏ (full-width) → hello
    expect(normalizeMessage("\uff28\uff45\uff4c\uff4c\uff4f")).toBe("hello");
  });

  it("normalizes composed and decomposed Unicode equivalents", () => {
    // é composed (U+00E9) vs decomposed (e + U+0301)
    const composed = "\u00e9";
    const decomposed = "e\u0301";
    expect(normalizeMessage(composed)).toBe(normalizeMessage(decomposed));
  });

  it("preserves emoji", () => {
    expect(normalizeMessage("hello 🌍")).toBe("hello 🌍");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeMessage("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeMessage("   \t\n  ")).toBe("");
  });
});

describe("hashContent", () => {
  it("returns a deterministic hex string", () => {
    const hash1 = hashContent("hello");
    const hash2 = hashContent("hello");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashContent("hello")).not.toBe(hashContent("world"));
  });
});
