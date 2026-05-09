import { describe, it, expect } from "vitest";
import { extractSeedMetadata } from "./extract-seed.js";

describe("extractSeedMetadata", () => {
  it("returns null when no x-seed-* headers are present", () => {
    expect(extractSeedMetadata({})).toBeNull();
    expect(
      extractSeedMetadata({ "x-model": "gpt-4o", "user-agent": "test" }),
    ).toBeNull();
  });

  it("lifts a single x-seed-* header into the seed block", () => {
    expect(
      extractSeedMetadata({ "x-seed-batch": "batch-2026-05-08-01" }),
    ).toEqual({
      batch: "batch-2026-05-08-01",
    });
  });

  it("lifts the canonical four x-seed-* headers", () => {
    expect(
      extractSeedMetadata({
        "x-seed-batch": "batch-2026-05-08-01",
        "x-seed-run": "anthropic-opus",
        "x-seed-model": "claude-opus-4-7",
        "x-seed-skill-version": "2.0",
      }),
    ).toEqual({
      batch: "batch-2026-05-08-01",
      run: "anthropic-opus",
      model: "claude-opus-4-7",
      skill_version: "2.0",
    });
  });

  it("normalizes header keys to lowercase before stripping the prefix", () => {
    expect(
      extractSeedMetadata({
        "x-seed-batch": "b1",
        "X-Seed-Run": "r1" as unknown as string,
      } as Record<string, string>),
    ).toMatchObject({ batch: "b1" });
  });

  it("strips the x-seed- prefix and converts dashes to underscores", () => {
    expect(
      extractSeedMetadata({
        "x-seed-skill-version": "2.0",
        "x-seed-extra-field": "value",
      }),
    ).toEqual({
      skill_version: "2.0",
      extra_field: "value",
    });
  });

  it("ignores unrelated headers", () => {
    expect(
      extractSeedMetadata({
        "x-seed-batch": "b1",
        "x-model": "gpt-4o",
        "user-agent": "ua",
        "x-forwarded-for": "1.2.3.4",
      }),
    ).toEqual({ batch: "b1" });
  });

  it("returns null for headers with empty values", () => {
    expect(extractSeedMetadata({ "x-seed-batch": "   " })).toBeNull();
  });

  it("trims whitespace in seed values", () => {
    expect(extractSeedMetadata({ "x-seed-batch": "  b1  " })).toEqual({
      batch: "b1",
    });
  });
});
