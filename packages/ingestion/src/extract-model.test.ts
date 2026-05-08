import { describe, it, expect } from "vitest";
import { extractOriginatingModel } from "./extract-model.js";

describe("extractOriginatingModel", () => {
  it("returns x-model value lowercased and trimmed", () => {
    expect(extractOriginatingModel({ "x-model": "  GPT-4o  " })).toBe("gpt-4o");
  });

  it("ignores empty x-model and falls through", () => {
    expect(extractOriginatingModel({ "x-model": "   " })).toBeNull();
  });

  it("falls back to user-agent — OpenAI", () => {
    expect(
      extractOriginatingModel({ "user-agent": "OpenAI/Python 1.30.1" }),
    ).toBe("openai");
  });

  it("falls back to user-agent — Anthropic", () => {
    expect(
      extractOriginatingModel({ "user-agent": "Anthropic/0.21.3" }),
    ).toBe("anthropic");
  });

  it("falls back to user-agent — Google Gemini", () => {
    expect(
      extractOriginatingModel({
        "user-agent": "google-genai/0.5 Gemini/Python",
      }),
    ).toBe("gemini");
  });

  it("returns null for unknown user-agents", () => {
    expect(extractOriginatingModel({ "user-agent": "curl/7.0" })).toBeNull();
  });

  it("returns null when no relevant headers are present", () => {
    expect(extractOriginatingModel({})).toBeNull();
  });

  it("caps output at 64 characters", () => {
    const result = extractOriginatingModel({ "x-model": "a".repeat(200) });
    expect(result).not.toBeNull();
    expect(result!.length).toBe(64);
  });

  it("prefers x-model over user-agent", () => {
    const result = extractOriginatingModel({
      "x-model": "claude-opus-4",
      "user-agent": "OpenAI/Python 1.30",
    });
    expect(result).toBe("claude-opus-4");
  });
});
