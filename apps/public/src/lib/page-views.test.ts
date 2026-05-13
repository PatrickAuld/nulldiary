import { describe, it, expect, vi } from "vitest";
import {
  classifyUserAgent,
  parseRefererHost,
  shouldRecordPageView,
  buildPageViewRow,
  recordPageView,
} from "./page-views.js";

describe("classifyUserAgent", () => {
  it("classifies known bots as 'bot'", () => {
    const bots = [
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Twitterbot/1.0",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (compatible; YandexBot/3.0)",
      "Slackbot-LinkExpanding 1.0",
      "Mozilla/5.0 (compatible; SemrushBot/7~bl)",
      "curl/7.81.0",
      "Wget/1.20.3",
      "python-requests/2.31.0",
      "node-fetch/1.0",
    ];
    for (const ua of bots) {
      expect(classifyUserAgent(ua)).toBe("bot");
    }
  });

  it("classifies Mozilla browsers as 'browser'", () => {
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      ),
    ).toBe("browser");
  });

  it("returns 'unknown' for empty/missing UA", () => {
    expect(classifyUserAgent(null)).toBe("unknown");
    expect(classifyUserAgent("")).toBe("unknown");
    expect(classifyUserAgent(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for unrecognized UAs", () => {
    expect(classifyUserAgent("PostmanRuntime/7.32.0")).toBe("unknown");
  });

  it("bot detection takes precedence over Mozilla prefix", () => {
    // Many bots claim Mozilla but also include their bot name.
    expect(
      classifyUserAgent(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe("bot");
  });
});

describe("parseRefererHost", () => {
  it("returns the lowercased host for valid URLs", () => {
    expect(parseRefererHost("https://news.ycombinator.com/item?id=1")).toBe(
      "news.ycombinator.com",
    );
    expect(parseRefererHost("HTTP://Example.COM/path")).toBe("example.com");
  });

  it("returns null for invalid or missing referers", () => {
    expect(parseRefererHost(null)).toBe(null);
    expect(parseRefererHost("")).toBe(null);
    expect(parseRefererHost("not a url")).toBe(null);
  });
});

describe("shouldRecordPageView", () => {
  it("records GET requests to public app routes", () => {
    expect(shouldRecordPageView({ method: "GET", path: "/" })).toBe(true);
    expect(shouldRecordPageView({ method: "GET", path: "/messages" })).toBe(
      true,
    );
    expect(shouldRecordPageView({ method: "GET", path: "/m/abc" })).toBe(true);
    expect(shouldRecordPageView({ method: "GET", path: "/about" })).toBe(true);
  });

  it("skips non-GET methods", () => {
    expect(shouldRecordPageView({ method: "POST", path: "/" })).toBe(false);
    expect(shouldRecordPageView({ method: "PUT", path: "/messages" })).toBe(
      false,
    );
  });

  it("skips API and ingestion routes", () => {
    expect(shouldRecordPageView({ method: "GET", path: "/api/foo" })).toBe(
      false,
    );
    expect(
      shouldRecordPageView({ method: "GET", path: "/s/some-message" }),
    ).toBe(false);
  });

  it("skips Next internals and static assets", () => {
    expect(
      shouldRecordPageView({ method: "GET", path: "/_next/static/x.js" }),
    ).toBe(false);
    expect(shouldRecordPageView({ method: "GET", path: "/favicon.ico" })).toBe(
      false,
    );
    expect(shouldRecordPageView({ method: "GET", path: "/og.png" })).toBe(
      false,
    );
    expect(shouldRecordPageView({ method: "GET", path: "/icon.svg" })).toBe(
      false,
    );
    expect(shouldRecordPageView({ method: "GET", path: "/og/some" })).toBe(
      false,
    );
  });
});

describe("buildPageViewRow", () => {
  it("produces a row with id, host, ua_class, normalized fields", () => {
    const row = buildPageViewRow({
      path: "/m/abc",
      referer: "https://news.ycombinator.com/item?id=1",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    });
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.path).toBe("/m/abc");
    expect(row.referer).toBe("https://news.ycombinator.com/item?id=1");
    expect(row.host).toBe("news.ycombinator.com");
    expect(row.ua_class).toBe("browser");
  });

  it("handles missing referer/UA", () => {
    const row = buildPageViewRow({
      path: "/",
      referer: null,
      userAgent: null,
    });
    expect(row.referer).toBe(null);
    expect(row.host).toBe(null);
    expect(row.ua_class).toBe("unknown");
  });
});

describe("recordPageView", () => {
  it("inserts into page_views and resolves true on success", async () => {
    const inserted: unknown[] = [];
    const db = {
      from: (table: string) => {
        expect(table).toBe("page_views");
        return {
          insert: async (row: unknown) => {
            inserted.push(row);
            return { error: null };
          },
        };
      },
    };
    const ok = await recordPageView(db as never, {
      path: "/",
      referer: null,
      userAgent: "Mozilla/5.0",
    });
    expect(ok).toBe(true);
    expect(inserted).toHaveLength(1);
  });

  it("swallows DB errors and resolves false (fire-and-forget)", async () => {
    const db = {
      from: () => ({
        insert: async () => ({ error: new Error("boom") }),
      }),
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await recordPageView(db as never, {
      path: "/",
      referer: null,
      userAgent: null,
    });
    expect(ok).toBe(false);
    errSpy.mockRestore();
  });

  it("swallows thrown exceptions and resolves false", async () => {
    const db = {
      from: () => {
        throw new Error("network down");
      },
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await recordPageView(db as never, {
      path: "/",
      referer: null,
      userAgent: null,
    });
    expect(ok).toBe(false);
    errSpy.mockRestore();
  });
});
