import { describe, it, expect } from "vitest";
import { extractOriginatingModel } from "./extract-model.js";

describe("extractOriginatingModel", () => {
  it("returns x-model value lowercased and trimmed", () => {
    expect(extractOriginatingModel({ "x-model": "  GPT-4o  " })).toBe("gpt-4o");
  });

  it("returns null for empty x-model", () => {
    expect(extractOriginatingModel({ "x-model": "   " })).toBeNull();
  });

  it("ignores user-agent (no fallback)", () => {
    expect(
      extractOriginatingModel({ "user-agent": "OpenAI/Python 1.30.1" }),
    ).toBeNull();
  });

  it("returns null when no x-model is present", () => {
    expect(extractOriginatingModel({})).toBeNull();
  });

  it("caps output at 64 characters", () => {
    const result = extractOriginatingModel({ "x-model": "a".repeat(200) });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(64);
  });

  it("ignores user-agent even when x-model is also present", () => {
    const result = extractOriginatingModel({
      "x-model": "claude-opus-4",
      "user-agent": "OpenAI/Python 1.30",
    });
    expect(result).toBe("claude-opus-4");
  });
});
