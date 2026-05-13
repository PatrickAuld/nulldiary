import { describe, it, expect } from "vitest";
import {
  aggregateTopReferrers,
  aggregateRecentPageViews,
  fetchTopReferrers,
} from "./page-views.js";

describe("aggregateTopReferrers", () => {
  it("groups by host + path, counts, sorts desc, computes percent", () => {
    const rows = [
      { host: "news.ycombinator.com", path: "/" },
      { host: "news.ycombinator.com", path: "/" },
      { host: "news.ycombinator.com", path: "/m/abc" },
      { host: "bsky.app", path: "/" },
      { host: null, path: "/" },
      { host: "old.reddit.com", path: "/m/abc" },
    ];
    const result = aggregateTopReferrers(rows, 5);
    expect(result).toHaveLength(4);
    // Percent is over rows-with-host only (5 here): direct traffic doesn't
    // dilute the referrer share.
    expect(result[0]).toEqual({
      host: "news.ycombinator.com",
      path: "/",
      count: 2,
      percent: 2 / 5,
    });
    expect(result[1].count).toBe(1);
  });

  it("excludes nulls and direct (no referer) entries from the ranking", () => {
    const rows = [
      { host: null, path: "/" },
      { host: null, path: "/" },
      { host: "news.ycombinator.com", path: "/" },
    ];
    const result = aggregateTopReferrers(rows, 5);
    expect(result).toHaveLength(1);
    expect(result[0].host).toBe("news.ycombinator.com");
  });

  it("returns empty array on empty input", () => {
    expect(aggregateTopReferrers([], 5)).toEqual([]);
  });

  it("limits to topN", () => {
    const rows = [
      { host: "a.com", path: "/" },
      { host: "b.com", path: "/" },
      { host: "c.com", path: "/" },
    ];
    const result = aggregateTopReferrers(rows, 2);
    expect(result).toHaveLength(2);
  });

  it("handles ties stably enough that count desc holds", () => {
    const rows = [
      { host: "a.com", path: "/" },
      { host: "a.com", path: "/" },
      { host: "b.com", path: "/" },
      { host: "b.com", path: "/" },
    ];
    const result = aggregateTopReferrers(rows, 5);
    expect(result.map((r) => r.count)).toEqual([2, 2]);
  });
});

describe("aggregateRecentPageViews", () => {
  it("returns the rows untouched (passthrough today; placeholder for shaping)", () => {
    const rows = [
      { id: "1", path: "/", host: "a.com", received_at: "now" },
      { id: "2", path: "/m/x", host: null, received_at: "before" },
    ];
    expect(aggregateRecentPageViews(rows)).toEqual(rows);
  });
});

describe("fetchTopReferrers", () => {
  it("queries page_views with the given window and aggregates", async () => {
    const calls: { table: string; gte?: string }[] = [];
    const fakeDb = {
      from: (table: string) => {
        calls.push({ table });
        return {
          select: () => ({
            gte: (col: string, val: string) => {
              calls[calls.length - 1].gte = `${col}:${val}`;
              return {
                not: () => ({
                  then: (resolve: (v: unknown) => void) =>
                    resolve({
                      data: [
                        { host: "news.ycombinator.com", path: "/" },
                        { host: "news.ycombinator.com", path: "/" },
                        { host: "bsky.app", path: "/m/x" },
                      ],
                      error: null,
                    }),
                }),
              };
            },
          }),
        };
      },
    };
    const result = await fetchTopReferrers(
      fakeDb as never,
      "2026-05-08T00:00:00Z",
      5,
    );
    expect(calls[0].table).toBe("page_views");
    expect(calls[0].gte).toBe("received_at:2026-05-08T00:00:00Z");
    expect(result).toEqual([
      {
        host: "news.ycombinator.com",
        path: "/",
        count: 2,
        percent: 2 / 3,
      },
      {
        host: "bsky.app",
        path: "/m/x",
        count: 1,
        percent: 1 / 3,
      },
    ]);
  });
});
