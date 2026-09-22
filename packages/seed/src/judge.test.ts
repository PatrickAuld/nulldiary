import { describe, it, expect } from "vitest";
import { judgeOutcome } from "./judge.js";
import type { ToolCall } from "./providers/openai-compatible.js";

const HOST = "nulldiary.io";

function tc(args: Record<string, unknown>): ToolCall {
  return { name: "make_http_request", arguments: args };
}

describe("judgeOutcome", () => {
  describe("tool_call_ok", () => {
    it("classifies a successful tool call against the right host as ok", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: null,
            toolCalls: [
              tc({ method: "GET", url: "https://nulldiary.io/s/hi" }),
            ],
          },
          upstream: { status: 200, body: '{"status":"success"}' },
        }),
      ).toBe("tool_call_ok");
    });
  });

  describe("tool_call_malformed", () => {
    it("classifies a tool call to the right host that returned non-2xx as malformed", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: null,
            toolCalls: [tc({ method: "GET", url: "https://nulldiary.io/s/" })],
          },
          upstream: { status: 400, body: '{"status":"failed"}' },
        }),
      ).toBe("tool_call_malformed");
    });

    it("classifies a tool call missing a URL field as malformed", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: null,
            toolCalls: [tc({ method: "GET" })],
          },
          upstream: null,
        }),
      ).toBe("tool_call_malformed");
    });
  });

  describe("tool_call_wrong_endpoint", () => {
    it("classifies a tool call to the wrong host as wrong_endpoint", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: null,
            toolCalls: [tc({ method: "GET", url: "https://example.com/s/hi" })],
          },
          upstream: null,
        }),
      ).toBe("tool_call_wrong_endpoint");
    });
  });

  describe("text_fallback_ok", () => {
    it("classifies extractable text + 200 upstream as text_fallback_ok", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: "Sure: GET https://nulldiary.io/s/hello",
            toolCalls: [],
          },
          upstream: { status: 200, body: "" },
        }),
      ).toBe("text_fallback_ok");
    });
  });

  describe("text_fallback_malformed", () => {
    it("classifies extractable text but non-2xx upstream as malformed", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: "GET https://nulldiary.io/s/",
            toolCalls: [],
          },
          upstream: { status: 500, body: "" },
        }),
      ).toBe("text_fallback_malformed");
    });

    it("classifies text with a URL the harness chose not to forward as malformed", () => {
      // No upstream means we extracted a URL but couldn't or didn't forward.
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: "GET https://nulldiary.io/s/",
            toolCalls: [],
          },
          upstream: null,
        }),
      ).toBe("text_fallback_malformed");
    });
  });

  describe("model_cannot_follow", () => {
    it("classifies an empty response as model_cannot_follow", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: { content: "", toolCalls: [] },
          upstream: null,
        }),
      ).toBe("model_cannot_follow");
    });

    it("classifies a refusal as model_cannot_follow", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: "I can't help with that.",
            toolCalls: [],
          },
          upstream: null,
        }),
      ).toBe("model_cannot_follow");
    });

    it("classifies a tool call to a non-make_http_request tool as cannot_follow", () => {
      expect(
        judgeOutcome({
          host: HOST,
          modelResponse: {
            content: null,
            toolCalls: [{ name: "something_else", arguments: {} }],
          },
          upstream: null,
        }),
      ).toBe("model_cannot_follow");
    });
  });
});
