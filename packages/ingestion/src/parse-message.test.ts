import { describe, it, expect } from "vitest";
import { parseMessage } from "./parse-message.js";
import type { RawRequest } from "./types.js";

function makeRaw(overrides: Partial<RawRequest> = {}): RawRequest {
  return {
    method: "GET",
    path: "/s/",
    query: {},
    headers: {},
    body: null,
    contentType: null,
    ...overrides,
  };
}

describe("parseMessage", () => {
  it("truncates long messages to the configured max length (default 512)", () => {
    const long = "a".repeat(600);
    const result = parseMessage({
      method: "POST",
      path: "/s/",
      query: {},
      headers: {},
      body: JSON.stringify({ message: long }),
      contentType: "application/json",
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");

    expect(result.message).toHaveLength(512);
  });

  describe("headers (highest priority)", () => {
    it("extracts x-message header", () => {
      const result = parseMessage(makeRaw({ headers: { "x-message": "hi" } }));
      expect(result).toEqual({
        message: "hi",
        status: "success",
        source: "header",
      });
    });

    it("extracts x-secret header", () => {
      const result = parseMessage(makeRaw({ headers: { "x-secret": "shh" } }));
      expect(result).toEqual({
        message: "shh",
        status: "success",
        source: "header",
      });
    });

    it("extracts x-prompt header", () => {
      const result = parseMessage(makeRaw({ headers: { "x-prompt": "ask" } }));
      expect(result).toEqual({
        message: "ask",
        status: "success",
        source: "header",
      });
    });

    it("prefers x-message over x-secret and x-prompt", () => {
      const result = parseMessage(
        makeRaw({
          headers: { "x-message": "msg", "x-secret": "sec", "x-prompt": "pmt" },
        }),
      );
      expect(result.message).toBe("msg");
    });

    it("falls through to x-secret when x-message is empty string", () => {
      const result = parseMessage(
        makeRaw({ headers: { "x-message": "", "x-secret": "sec" } }),
      );
      expect(result.message).toBe("sec");
    });

    it("headers take priority over body, query, and path", () => {
      const result = parseMessage(
        makeRaw({
          headers: { "x-message": "from-header" },
          body: JSON.stringify({ message: "from-body" }),
          contentType: "application/json",
          query: { message: "from-query" },
          path: "/s/from-path",
        }),
      );
      expect(result).toEqual({
        message: "from-header",
        status: "success",
        source: "header",
      });
    });
  });

  describe("body (second priority)", () => {
    it("extracts message from JSON body", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ message: "hello" }),
          contentType: "application/json",
        }),
      );
      expect(result).toEqual({
        message: "hello",
        status: "success",
        source: "body",
      });
    });

    it("extracts secret from JSON body", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ secret: "hidden" }),
          contentType: "application/json",
        }),
      );
      expect(result).toEqual({
        message: "hidden",
        status: "success",
        source: "body",
      });
    });

    it("extracts prompt from JSON body", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ prompt: "ask me" }),
          contentType: "application/json",
        }),
      );
      expect(result).toEqual({
        message: "ask me",
        status: "success",
        source: "body",
      });
    });

    it("prefers message over secret and prompt in JSON body", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({
            message: "msg",
            secret: "sec",
            prompt: "pmt",
          }),
          contentType: "application/json",
        }),
      );
      expect(result.message).toBe("msg");
    });

    it("extracts message from form-encoded body", () => {
      const result = parseMessage(
        makeRaw({
          body: "message=form-hello",
          contentType: "application/x-www-form-urlencoded",
        }),
      );
      expect(result).toEqual({
        message: "form-hello",
        status: "success",
        source: "body",
      });
    });

    it("extracts secret from form-encoded body", () => {
      const result = parseMessage(
        makeRaw({
          body: "secret=form-secret",
          contentType: "application/x-www-form-urlencoded",
        }),
      );
      expect(result.message).toBe("form-secret");
    });

    it("uses text/plain body as raw message", () => {
      const result = parseMessage(
        makeRaw({
          body: "raw text content",
          contentType: "text/plain",
        }),
      );
      expect(result).toEqual({
        message: "raw text content",
        status: "success",
        source: "body",
      });
    });

    it("handles JSON content-type with charset", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ message: "charset" }),
          contentType: "application/json; charset=utf-8",
        }),
      );
      expect(result.message).toBe("charset");
    });

    it("ignores malformed JSON", () => {
      const result = parseMessage(
        makeRaw({
          body: "{not valid json",
          contentType: "application/json",
          path: "/s/fallback",
        }),
      );
      // Should fall through to path
      expect(result).toEqual({
        message: "fallback",
        status: "success",
        source: "path",
      });
    });

    it("ignores empty text/plain body", () => {
      const result = parseMessage(
        makeRaw({
          body: "",
          contentType: "text/plain",
          path: "/s/fallback",
        }),
      );
      expect(result.source).toBe("path");
    });

    it("body takes priority over query and path", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ message: "from-body" }),
          contentType: "application/json",
          query: { message: "from-query" },
          path: "/s/from-path",
        }),
      );
      expect(result).toEqual({
        message: "from-body",
        status: "success",
        source: "body",
      });
    });
  });

  describe("query (third priority)", () => {
    it("extracts message query parameter", () => {
      const result = parseMessage(makeRaw({ query: { message: "qmsg" } }));
      expect(result).toEqual({
        message: "qmsg",
        status: "success",
        source: "query",
      });
    });

    it("extracts secret query parameter", () => {
      const result = parseMessage(makeRaw({ query: { secret: "qsec" } }));
      expect(result).toEqual({
        message: "qsec",
        status: "success",
        source: "query",
      });
    });

    it("prefers message over secret in query", () => {
      const result = parseMessage(
        makeRaw({ query: { message: "qmsg", secret: "qsec" } }),
      );
      expect(result.message).toBe("qmsg");
    });

    it("ignores empty query parameter", () => {
      const result = parseMessage(
        makeRaw({ query: { message: "" }, path: "/s/fallback" }),
      );
      expect(result.source).toBe("path");
    });

    it("query takes priority over path", () => {
      const result = parseMessage(
        makeRaw({ query: { message: "from-query" }, path: "/s/from-path" }),
      );
      expect(result).toEqual({
        message: "from-query",
        status: "success",
        source: "query",
      });
    });
  });

  describe("path (lowest priority)", () => {
    it("extracts message from path segment after /s/", () => {
      const result = parseMessage(makeRaw({ path: "/s/hello-world" }));
      expect(result).toEqual({
        message: "hello-world",
        status: "success",
        source: "path",
      });
    });

    it("URL-decodes path segment", () => {
      const result = parseMessage(makeRaw({ path: "/s/hello%20world" }));
      expect(result.message).toBe("hello world");
    });

    it("treats plus signs in path as spaces", () => {
      const result = parseMessage(makeRaw({ path: "/s/hello+world" }));
      expect(result.message).toBe("hello world");
    });

    it("falls back when path contains malformed percent encoding", () => {
      const result = parseMessage(makeRaw({ path: "/s/hello%ZZworld" }));
      expect(result.message).toBe("hello%ZZworld");
    });

    it("handles multi-segment paths", () => {
      const result = parseMessage(makeRaw({ path: "/s/foo/bar/baz" }));
      expect(result.message).toBe("foo/bar/baz");
    });

    it("ignores empty path segment", () => {
      const result = parseMessage(makeRaw({ path: "/s/" }));
      expect(result).toEqual({ message: null, status: "failed", source: null });
    });

    it("ignores bare /s path", () => {
      const result = parseMessage(makeRaw({ path: "/s" }));
      expect(result).toEqual({ message: null, status: "failed", source: null });
    });
  });

  describe("failure case", () => {
    it("returns failed when no source has a message", () => {
      const result = parseMessage(makeRaw());
      expect(result).toEqual({ message: null, status: "failed", source: null });
    });

    it("returns failed when all sources are empty", () => {
      const result = parseMessage(
        makeRaw({
          headers: { "x-message": "" },
          body: "",
          contentType: "text/plain",
          query: { message: "" },
          path: "/s/",
        }),
      );
      expect(result).toEqual({ message: null, status: "failed", source: null });
    });
  });

  describe("whitespace handling", () => {
    it("trims whitespace from header values", () => {
      const result = parseMessage(
        makeRaw({ headers: { "x-message": "  padded  " } }),
      );
      expect(result.message).toBe("padded");
    });

    it("trims whitespace from body fields", () => {
      const result = parseMessage(
        makeRaw({
          body: JSON.stringify({ message: "  padded  " }),
          contentType: "application/json",
        }),
      );
      expect(result.message).toBe("padded");
    });

    it("whitespace-only values are treated as empty", () => {
      const result = parseMessage(makeRaw({ headers: { "x-message": "   " } }));
      expect(result).toEqual({ message: null, status: "failed", source: null });
    });
  });
});
