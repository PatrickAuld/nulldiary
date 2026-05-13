import { describe, it, expect, vi, beforeEach } from "vitest";

const mockBuildDigest = vi.fn();
const mockSend = vi.fn();

vi.mock("@/data/digest", async () => {
  const actual =
    await vi.importActual<typeof import("@/data/digest")>("@/data/digest");
  return {
    ...actual,
    buildDailyDigest: (...args: unknown[]) => mockBuildDigest(...args),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => "fake-db",
}));

vi.mock("@/lib/email", () => ({
  sendDigestEmail: (...args: unknown[]) => mockSend(...args),
}));

const { POST, GET } = await import("./route.js");

const sampleDigest = {
  generated_at: "2026-05-09T08:00:00.000Z",
  window_start: "2026-05-08T00:00:00.000Z",
  window_end: "2026-05-09T00:00:00.000Z",
  pending_count: 4,
  submissions: { total: 10, real: 5, seeded: 4, suspected_bot: 1 },
  approval_rate: 0.5,
  approved_yesterday: 3,
  denied_yesterday: 3,
  cumulative_approved: 100,
  anomalies: [],
  baseline_median_last_7d: 8,
};

beforeEach(() => {
  mockBuildDigest.mockReset().mockResolvedValue(sampleDigest);
  mockSend.mockReset().mockResolvedValue({
    sent: false,
    skipped: true,
    reason: "RESEND_API_KEY not set",
  });
  process.env.CRON_SECRET = "secret-shh";
});

describe("POST /api/cron/digest", () => {
  it("returns 401 when secret is missing", async () => {
    const req = new Request("http://localhost/api/cron/digest", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when secret is wrong", async () => {
    const req = new Request("http://localhost/api/cron/digest", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 500 when CRON_SECRET env is unset", async () => {
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost/api/cron/digest", {
      method: "POST",
      headers: { "x-cron-secret": "anything" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("accepts the bearer-token header form (Vercel Cron style)", async () => {
    const req = new Request("http://localhost/api/cron/digest", {
      method: "POST",
      headers: { authorization: "Bearer secret-shh" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; digest: unknown };
    expect(body.mode).toBe("daily");
    expect(body.digest).toBeDefined();
  });

  it("honors mode=weekly query param", async () => {
    const req = new Request("http://localhost/api/cron/digest?mode=weekly", {
      method: "POST",
      headers: { "x-cron-secret": "secret-shh" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; subject: string };
    expect(body.mode).toBe("weekly");
    expect(body.subject).toContain("weekly");
  });

  it("invokes sendDigestEmail with the rendered subject and bodies", async () => {
    const req = new Request("http://localhost/api/cron/digest", {
      method: "POST",
      headers: { "x-cron-secret": "secret-shh" },
    });
    await POST(req);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const arg = mockSend.mock.calls[0][0];
    expect(arg.subject).toContain("daily digest");
    expect(arg.text).toContain("pending: 4");
  });
});

describe("GET /api/cron/digest", () => {
  it("treats GET as POST so Vercel Cron's GET works", async () => {
    const req = new Request("http://localhost/api/cron/digest", {
      method: "GET",
      headers: { authorization: "Bearer secret-shh" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
