import { describe, it, expect } from "vitest";
import {
  detectSuspectedBotHashes,
  breakdownSubmissions,
  detectAnomalies,
  renderDigestText,
  buildDailyDigest,
} from "./digest.js";

describe("detectSuspectedBotHashes", () => {
  it("returns hashes that appear two or more times", () => {
    const result = detectSuspectedBotHashes([
      { content_hash: "a" },
      { content_hash: "b" },
      { content_hash: "a" },
      { content_hash: "c" },
      { content_hash: "b" },
    ]);
    expect(result).toEqual(new Set(["a", "b"]));
  });

  it("ignores nulls", () => {
    const result = detectSuspectedBotHashes([
      { content_hash: null },
      { content_hash: null },
    ]);
    expect(result.size).toBe(0);
  });

  it("returns empty set when all hashes are unique", () => {
    const result = detectSuspectedBotHashes([
      { content_hash: "a" },
      { content_hash: "b" },
    ]);
    expect(result.size).toBe(0);
  });
});

describe("breakdownSubmissions", () => {
  it("classifies seeded, real, and suspected_bot correctly", () => {
    const rows = [
      makeRow({ id: "1", content_hash: "h1" }),
      makeRow({
        id: "2",
        content_hash: "h2",
        metadata: { seed: { batch: "b1" } },
      }),
      makeRow({ id: "3", content_hash: "h3" }),
      makeRow({ id: "4", content_hash: "h3" }), // dup of #3 → both suspected_bot
      makeRow({ id: "5", content_hash: "h3" }),
    ];
    const result = breakdownSubmissions(rows);
    expect(result).toEqual({
      total: 5,
      real: 1,
      seeded: 1,
      suspected_bot: 3,
    });
  });

  it("seeded messages with duplicate hashes still count as seeded (precedence)", () => {
    const rows = [
      makeRow({
        id: "1",
        content_hash: "x",
        metadata: { seed: { batch: "b" } },
      }),
      makeRow({
        id: "2",
        content_hash: "x",
        metadata: { seed: { batch: "b" } },
      }),
    ];
    const result = breakdownSubmissions(rows);
    expect(result.seeded).toBe(2);
    expect(result.suspected_bot).toBe(0);
  });

  it("counts everything as real when there are no dupes and no seed metadata", () => {
    const rows = [
      makeRow({ id: "1", content_hash: "a" }),
      makeRow({ id: "2", content_hash: "b" }),
    ];
    const result = breakdownSubmissions(rows);
    expect(result).toEqual({
      total: 2,
      real: 2,
      seeded: 0,
      suspected_bot: 0,
    });
  });

  it("handles empty input", () => {
    expect(breakdownSubmissions([])).toEqual({
      total: 0,
      real: 0,
      seeded: 0,
      suspected_bot: 0,
    });
  });
});

describe("detectAnomalies", () => {
  it("flags submission spike when total > 3x baseline", () => {
    const flags = detectAnomalies({
      yesterday_total: 100,
      baseline_median: 10,
      approval_rate: 0.5,
      most_recent_submission_iso: "2026-05-08T12:00:00Z",
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("spike"))).toBe(true);
  });

  it("does not flag spike when baseline is zero (brand-new install)", () => {
    const flags = detectAnomalies({
      yesterday_total: 5,
      baseline_median: 0,
      approval_rate: 0.5,
      most_recent_submission_iso: "2026-05-08T12:00:00Z",
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("spike"))).toBe(false);
  });

  it("flags low approval rate when < 5%", () => {
    const flags = detectAnomalies({
      yesterday_total: 50,
      baseline_median: 30,
      approval_rate: 0.04,
      most_recent_submission_iso: "2026-05-08T12:00:00Z",
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("approval rate"))).toBe(true);
  });

  it("does not flag approval rate when null (no data)", () => {
    const flags = detectAnomalies({
      yesterday_total: 0,
      baseline_median: 0,
      approval_rate: null,
      most_recent_submission_iso: null,
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("approval rate"))).toBe(false);
  });

  it("flags no submissions in 12h+ when last submission is older", () => {
    const flags = detectAnomalies({
      yesterday_total: 5,
      baseline_median: 5,
      approval_rate: 0.5,
      most_recent_submission_iso: "2026-05-08T00:00:00Z",
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("no submissions"))).toBe(true);
  });

  it("does not flag no-submissions when most recent is recent", () => {
    const flags = detectAnomalies({
      yesterday_total: 5,
      baseline_median: 5,
      approval_rate: 0.5,
      most_recent_submission_iso: "2026-05-08T11:00:00Z",
      now_iso: "2026-05-08T13:00:00Z",
    });
    expect(flags.some((f) => f.includes("no submissions"))).toBe(false);
  });
});

describe("renderDigestText", () => {
  it("renders a deterministic digest body and subject", () => {
    const digest = {
      generated_at: "2026-05-09T08:00:00.000Z",
      window_start: "2026-05-08T00:00:00.000Z",
      window_end: "2026-05-09T00:00:00.000Z",
      pending_count: 12,
      submissions: { total: 100, real: 60, seeded: 30, suspected_bot: 10 },
      approval_rate: 0.42,
      approved_yesterday: 21,
      denied_yesterday: 29,
      cumulative_approved: 480,
      anomalies: ["approval rate 42.0% < 5%"],
      baseline_median_last_7d: 25,
      top_referrers: [],
    };

    const rendered = renderDigestText(digest, {
      admin_url: "https://admin.example.com",
      mode: "daily",
    });

    expect(rendered.subject).toBe("nulldiary daily digest — 2026-05-08");
    expect(rendered.text).toContain("pending: 12");
    expect(rendered.text).toContain("real:          60");
    expect(rendered.text).toContain("seeded:        30");
    expect(rendered.text).toContain("suspected_bot: 10");
    expect(rendered.text).toContain("approval rate: 42.0%");
    expect(rendered.text).toContain("ANOMALIES:");
    expect(rendered.html).toContain("<pre");
  });

  it("uses weekly subject in weekly mode", () => {
    const digest = {
      generated_at: "2026-05-09T08:00:00.000Z",
      window_start: "2026-05-08T00:00:00.000Z",
      window_end: "2026-05-09T00:00:00.000Z",
      pending_count: 0,
      submissions: { total: 0, real: 0, seeded: 0, suspected_bot: 0 },
      approval_rate: null,
      approved_yesterday: 0,
      denied_yesterday: 0,
      cumulative_approved: 0,
      anomalies: [],
      baseline_median_last_7d: 0,
      top_referrers: [],
    };
    const rendered = renderDigestText(digest, {
      admin_url: "https://admin.example.com",
      mode: "weekly",
    });
    expect(rendered.subject).toContain("weekly");
  });

  it("renders 'no anomalies' when none are flagged", () => {
    const digest = {
      generated_at: "2026-05-09T08:00:00.000Z",
      window_start: "2026-05-08T00:00:00.000Z",
      window_end: "2026-05-09T00:00:00.000Z",
      pending_count: 0,
      submissions: { total: 5, real: 5, seeded: 0, suspected_bot: 0 },
      approval_rate: 1.0,
      approved_yesterday: 5,
      denied_yesterday: 0,
      cumulative_approved: 100,
      anomalies: [],
      baseline_median_last_7d: 4,
      top_referrers: [],
    };
    const rendered = renderDigestText(digest, {
      admin_url: "https://admin.example.com",
      mode: "daily",
    });
    expect(rendered.text).toContain("no anomalies");
  });
});

describe("buildDailyDigest", () => {
  it("aggregates pending count, breakdown, approval rate, and baseline", async () => {
    const fixedNow = new Date("2026-05-09T08:00:00.000Z");

    const yesterdayRows = [
      makeRow({
        id: "1",
        content_hash: "h1",
        created_at: "2026-05-08T01:00:00Z",
      }),
      makeRow({
        id: "2",
        content_hash: "h2",
        metadata: { seed: { batch: "b" } },
        created_at: "2026-05-08T02:00:00Z",
      }),
    ];

    const queryResults: Array<{
      data?: unknown;
      error?: unknown;
      count?: number;
    }> = [
      // countPending
      { count: 7 },
      // countCumulativeApproved
      { count: 312 },
      // listMessagesInWindow
      { data: yesterdayRows },
      // approvalRateInWindow: approved
      { count: 3 },
      // approvalRateInWindow: denied
      { count: 1 },
      // dailySubmissionBaseline x 7 buckets
      { count: 5 },
      { count: 6 },
      { count: 4 },
      { count: 5 },
      { count: 8 },
      { count: 5 },
      { count: 7 },
      // fetchTopReferrers (page_views select)
      {
        data: [
          { host: "news.ycombinator.com", path: "/" },
          { host: "news.ycombinator.com", path: "/" },
          { host: "bsky.app", path: "/m/x" },
        ],
      },
    ];

    const db = makeFakeDb(queryResults);

    const digest = await buildDailyDigest(db as never, fixedNow);

    expect(digest.pending_count).toBe(7);
    expect(digest.cumulative_approved).toBe(312);
    expect(digest.submissions).toEqual({
      total: 2,
      real: 1,
      seeded: 1,
      suspected_bot: 0,
    });
    expect(digest.approved_yesterday).toBe(3);
    expect(digest.denied_yesterday).toBe(1);
    expect(digest.approval_rate).toBeCloseTo(0.75);
    expect(digest.baseline_median_last_7d).toBe(5); // median of [4,5,5,5,6,7,8]
    expect(digest.window_start).toBe("2026-05-08T00:00:00.000Z");
    expect(digest.window_end).toBe("2026-05-09T00:00:00.000Z");
    expect(digest.top_referrers).toEqual([
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

describe("renderDigestText (top referrers)", () => {
  it("renders the referrer block when top_referrers is non-empty", () => {
    const digest = {
      generated_at: "2026-05-09T08:00:00.000Z",
      window_start: "2026-05-08T00:00:00.000Z",
      window_end: "2026-05-09T00:00:00.000Z",
      pending_count: 0,
      submissions: { total: 0, real: 0, seeded: 0, suspected_bot: 0 },
      approval_rate: null,
      approved_yesterday: 0,
      denied_yesterday: 0,
      cumulative_approved: 0,
      anomalies: [],
      baseline_median_last_7d: 0,
      top_referrers: [
        {
          host: "news.ycombinator.com",
          path: "/",
          count: 12,
          percent: 0.6,
        },
        {
          host: "bsky.app",
          path: "/m/x",
          count: 3,
          percent: 0.15,
        },
      ],
    };
    const rendered = renderDigestText(digest, {
      admin_url: "https://admin.example.com",
      mode: "daily",
    });
    expect(rendered.text).toContain("top referrers (last 24h):");
    expect(rendered.text).toContain("news.ycombinator.com/");
    expect(rendered.text).toContain("60.0%");
    expect(rendered.text).toContain("bsky.app/m/x");
  });

  it("renders the empty placeholder when no referrers", () => {
    const digest = {
      generated_at: "2026-05-09T08:00:00.000Z",
      window_start: "2026-05-08T00:00:00.000Z",
      window_end: "2026-05-09T00:00:00.000Z",
      pending_count: 0,
      submissions: { total: 0, real: 0, seeded: 0, suspected_bot: 0 },
      approval_rate: null,
      approved_yesterday: 0,
      denied_yesterday: 0,
      cumulative_approved: 0,
      anomalies: [],
      baseline_median_last_7d: 0,
      top_referrers: [],
    };
    const rendered = renderDigestText(digest, {
      admin_url: "https://admin.example.com",
      mode: "daily",
    });
    expect(rendered.text).toContain("(none recorded)");
  });
});

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    metadata: null,
    content_hash: null,
    created_at: "2026-05-08T00:00:00.000Z",
    approved_at: null,
    denied_at: null,
    moderation_status: "pending",
    ...overrides,
  } as Parameters<typeof breakdownSubmissions>[0][number];
}

function makeFakeDb(
  results: Array<{
    data?: unknown;
    error?: unknown;
    count?: number;
  }>,
) {
  let resultIndex = 0;
  function makeChain() {
    const methods = [
      "select",
      "eq",
      "not",
      "gte",
      "gt",
      "lt",
      "ilike",
      "order",
      "range",
      "limit",
      "single",
    ];
    const chain: Record<string, unknown> = {};
    for (const m of methods) {
      chain[m] = () => chain;
    }
    chain.then = (resolve: (v: unknown) => void) => {
      const r = results[resultIndex++] ?? {
        data: null,
        error: null,
        count: 0,
      };
      resolve({
        data: r.data ?? null,
        error: r.error ?? null,
        count: r.count ?? null,
      });
    };
    return chain;
  }
  return {
    from: () => makeChain(),
  };
}
