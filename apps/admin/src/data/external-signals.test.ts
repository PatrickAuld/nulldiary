import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchHnSignal,
  fetchRedditSignal,
  fetchBlueskySignal,
  fetchMastodonSignal,
  withCache,
  __resetCacheForTests,
} from "./external-signals.js";

beforeEach(() => {
  __resetCacheForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-09T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("withCache", () => {
  it("memoizes a result for the cache TTL", async () => {
    const fn = vi.fn().mockResolvedValue("hello");
    const a = await withCache("k", 60_000, fn);
    const b = await withCache("k", 60_000, fn);
    expect(a).toBe("hello");
    expect(b).toBe("hello");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-invokes after TTL elapses", async () => {
    const fn = vi.fn().mockResolvedValue("hello");
    await withCache("k2", 60_000, fn);
    vi.advanceTimersByTime(61_000);
    await withCache("k2", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("fetchHnSignal", () => {
  it("returns score, comments, and id from the HN Firebase API", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          score: 314,
          descendants: 87,
          title: "Show HN: Nulldiary",
          url: "https://nulldiary.io",
        }),
        { status: 200 },
      ),
    );
    const result = await fetchHnSignal("12345");
    expect(result).toEqual({
      ok: true,
      id: "12345",
      score: 314,
      comments: 87,
      title: "Show HN: Nulldiary",
      url: "https://nulldiary.io",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("hacker-news.firebaseio.com"),
    );
  });

  it("returns ok=false when ID is missing/empty", async () => {
    const result = await fetchHnSignal("");
    expect(result.ok).toBe(false);
  });

  it("returns ok=false when fetch throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));
    const result = await fetchHnSignal("12345");
    expect(result.ok).toBe(false);
  });

  it("returns ok=false when API returns non-200", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("oops", { status: 500 }),
    );
    const result = await fetchHnSignal("12345");
    expect(result.ok).toBe(false);
  });
});

describe("fetchRedditSignal", () => {
  it("returns score and comments for a permalink", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            data: {
              children: [
                {
                  data: {
                    score: 142,
                    num_comments: 35,
                    title: "nulldiary.io",
                    permalink: "/r/InternetIsBeautiful/comments/abc/x/",
                  },
                },
              ],
            },
          },
        ]),
        { status: 200 },
      ),
    );
    const result = await fetchRedditSignal(
      "/r/InternetIsBeautiful/comments/abc/x/",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.score).toBe(142);
      expect(result.comments).toBe(35);
    }
  });

  it("returns ok=false when permalink is missing", async () => {
    expect((await fetchRedditSignal("")).ok).toBe(false);
  });

  it("returns ok=false on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("boom"));
    expect(
      (await fetchRedditSignal("/r/InternetIsBeautiful/comments/x/")).ok,
    ).toBe(false);
  });
});

describe("fetchBlueskySignal", () => {
  it("returns mention count and sample posts", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          posts: [
            {
              uri: "at://did:plc:x/app.bsky.feed.post/1",
              author: { handle: "alice.bsky.social" },
              record: { text: "check out nulldiary.io", createdAt: "..." },
            },
            {
              uri: "at://did:plc:y/app.bsky.feed.post/2",
              author: { handle: "bob.bsky.social" },
              record: { text: "nulldiary.io is fun", createdAt: "..." },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchBlueskySignal("nulldiary.io");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
      expect(result.recent).toHaveLength(2);
      expect(result.recent[0].handle).toBe("alice.bsky.social");
    }
  });

  it("returns ok=false on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("boom"));
    expect((await fetchBlueskySignal("nulldiary.io")).ok).toBe(false);
  });
});

describe("fetchMastodonSignal", () => {
  it("queries the configured instance and returns count", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          statuses: [
            { id: "1", account: { acct: "x@instance.tld" }, content: "x" },
            { id: "2", account: { acct: "y@instance.tld" }, content: "y" },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchMastodonSignal({
      instance: "mastodon.social",
      query: "nulldiary.io",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.count).toBe(2);
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("mastodon.social"),
    );
  });

  it("returns ok=false when instance is missing", async () => {
    expect(
      (await fetchMastodonSignal({ instance: "", query: "nulldiary.io" })).ok,
    ).toBe(false);
  });
});
