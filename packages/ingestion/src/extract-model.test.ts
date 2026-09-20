import { describe, it, expect } from "vitest";
import { extractOriginatingModel } from "./extract-model.js";

describe("extractOriginatingModel", () => {
  it("returns x-author value lowercased and trimmed", () => {
    expect(extractOriginatingModel({ "x-author": "  GPT-4o  " })).toBe("gpt-4o");
  });

  it("returns null for empty x-author", () => {
    expect(extractOriginatingModel({ "x-author": "   " })).toBeNull();
  });

  it("ignores user-agent (no fallback)", () => {
    expect(
      extractOriginatingModel({ "user-agent": "OpenAI/Python 1.30.1" }),
    ).toBeNull();
  });

  it("returns null when no x-author is present", () => {
    expect(extractOriginatingModel({})).toBeNull();
  });

  it("caps output at 64 characters", () => {
    const result = extractOriginatingModel({ "x-author": "a".repeat(200) });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(64);
  });

  it("ignores user-agent even when x-author is also present", () => {
    const result = extractOriginatingModel({
      "x-author": "claude-opus-4",
      "user-agent": "OpenAI/Python 1.30",
    });
    expect(result).toBe("claude-opus-4");
  });
});
