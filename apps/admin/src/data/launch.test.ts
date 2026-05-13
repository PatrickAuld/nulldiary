import { describe, it, expect } from "vitest";
import {
  bucketSubmissions,
  classifySource,
  trendingArrow,
  truncateIp,
  approvalRateOverLast,
  pendingHealth,
} from "./launch.js";

describe("classifySource", () => {
  it("returns 'seeded' when metadata.seed is present", () => {
    expect(
      classifySource({
        metadata: { seed: { batch: "x" } },
      } as never),
    ).toBe("seeded");
  });

  it("returns 'real' otherwise", () => {
    expect(classifySource({ metadata: null } as never)).toBe("real");
    expect(classifySource({ metadata: {} } as never)).toBe("real");
  });
});

describe("bucketSubmissions", () => {
  it("buckets messages into N equal time slices, separating real and seeded", () => {
    const now = new Date("2026-05-09T10:00:00Z");
    // Window: last 4 hours; 4 buckets of 1h each.
    const messages = [
      // Bucket 0: 06:00-07:00 (oldest)
      { created_at: "2026-05-09T06:30:00Z", metadata: null },
      // Bucket 1: 07:00-08:00
      { created_at: "2026-05-09T07:30:00Z", metadata: { seed: { b: "x" } } },
      { created_at: "2026-05-09T07:45:00Z", metadata: null },
      // Bucket 2: 08:00-09:00 (empty)
      // Bucket 3: 09:00-10:00 (most recent)
      { created_at: "2026-05-09T09:30:00Z", metadata: null },
      { created_at: "2026-05-09T09:45:00Z", metadata: { seed: { b: "x" } } },
    ];
    const buckets = bucketSubmissions(
      messages as never,
      now,
      4 * 3600 * 1000,
      4,
    );
    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toEqual({ real: 1, seeded: 0, total: 1 });
    expect(buckets[1]).toEqual({ real: 1, seeded: 1, total: 2 });
    expect(buckets[2]).toEqual({ real: 0, seeded: 0, total: 0 });
    expect(buckets[3]).toEqual({ real: 1, seeded: 1, total: 2 });
  });

  it("ignores messages outside the window", () => {
    const now = new Date("2026-05-09T10:00:00Z");
    const messages = [
      // Way before
      { created_at: "2024-01-01T00:00:00Z", metadata: null },
      // After "now" — shouldn't happen but be defensive
      { created_at: "2026-05-09T11:00:00Z", metadata: null },
      // In window
      { created_at: "2026-05-09T09:30:00Z", metadata: null },
    ];
    const buckets = bucketSubmissions(messages as never, now, 3600 * 1000, 1);
    expect(buckets[0].total).toBe(1);
  });
});

describe("trendingArrow", () => {
  it("returns 'up' when last 25 average exceeds prior 75 by >10%", () => {
    // approvals: 75 messages with 30% approval, last 25 with 60% approval
    const prior = Array.from({ length: 75 }, (_, i) =>
      i < 23 ? "approved" : "denied",
    );
    const last = Array.from({ length: 25 }, (_, i) =>
      i < 15 ? "approved" : "denied",
    );
    const messages = [...prior, ...last]; // chronological
    expect(trendingArrow(messages)).toBe("up");
  });

  it("returns 'down' when last 25 average is meaningfully lower", () => {
    const prior = Array.from({ length: 75 }, () => "approved");
    const last = Array.from({ length: 25 }, () => "denied");
    expect(trendingArrow([...prior, ...last])).toBe("down");
  });

  it("returns 'flat' when fewer than 100 messages", () => {
    const m = Array.from({ length: 30 }, () => "approved");
    expect(trendingArrow(m)).toBe("flat");
  });

  it("returns 'flat' when last and prior are within 5 percentage points", () => {
    const prior = Array.from({ length: 75 }, (_, i) =>
      i < 38 ? "approved" : "denied",
    ); // 50.6%
    const last = Array.from({ length: 25 }, (_, i) =>
      i < 13 ? "approved" : "denied",
    ); // 52%
    expect(trendingArrow([...prior, ...last])).toBe("flat");
  });
});

describe("truncateIp", () => {
  it("truncates IPv4 to /24", () => {
    expect(truncateIp("192.168.1.42")).toBe("192.168.1.0/24");
  });

  it("truncates IPv6 to /48", () => {
    expect(truncateIp("2001:db8:1234:5678::1")).toBe("2001:db8:1234::/48");
  });

  it("returns null when input is null/empty", () => {
    expect(truncateIp(null)).toBe(null);
    expect(truncateIp("")).toBe(null);
  });

  it("returns the original string when it doesn't parse cleanly", () => {
    expect(truncateIp("not-an-ip")).toBe("not-an-ip");
  });
});

describe("approvalRateOverLast", () => {
  it("returns the approval rate for the moderated set", () => {
    const result = approvalRateOverLast([
      { moderation_status: "approved" },
      { moderation_status: "approved" },
      { moderation_status: "approved" },
      { moderation_status: "denied" },
    ] as never);
    expect(result.rate).toBe(0.75);
    expect(result.count).toBe(4);
  });

  it("returns null rate when no moderated entries", () => {
    expect(approvalRateOverLast([])).toEqual({ rate: null, count: 0 });
  });
});

describe("pendingHealth", () => {
  it("flags 'red' when pending grew by >10 in 1h while approvals < 5", () => {
    expect(
      pendingHealth({
        pending_now: 50,
        pending_1h_ago: 30,
        approved_in_last_1h: 2,
      }),
    ).toBe("red");
  });

  it("flags 'green' when pending shrank or held flat", () => {
    expect(
      pendingHealth({
        pending_now: 20,
        pending_1h_ago: 25,
        approved_in_last_1h: 5,
      }),
    ).toBe("green");
  });

  it("flags 'amber' when pending grew but moderation kept up", () => {
    expect(
      pendingHealth({
        pending_now: 25,
        pending_1h_ago: 12,
        approved_in_last_1h: 8,
      }),
    ).toBe("amber");
  });

  it("flags 'green' when growth is small", () => {
    expect(
      pendingHealth({
        pending_now: 12,
        pending_1h_ago: 10,
        approved_in_last_1h: 0,
      }),
    ).toBe("green");
  });
});
