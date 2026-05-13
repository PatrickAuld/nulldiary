import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    from: () => ({
      delete: () => ({
        lt: (col: string, val: string) => mockDelete(col, val),
      }),
    }),
  }),
}));

const { POST, GET } = await import("./route.js");

beforeEach(() => {
  mockDelete.mockReset().mockResolvedValue({ error: null });
  process.env.CRON_SECRET = "secret-shh";
});

describe("POST /api/cron/cleanup-page-views", () => {
  it("returns 401 with no secret", async () => {
    const req = new Request("http://localhost/x", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "x-cron-secret": "wrong" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("deletes rows older than the retention cutoff", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { authorization: "Bearer secret-shh" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; cutoff: string };
    expect(body.ok).toBe(true);
    expect(body.cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    const [col, cutoff] = mockDelete.mock.calls[0];
    expect(col).toBe("received_at");
    // cutoff should be ~60 days ago
    const ageMs = Date.now() - new Date(cutoff).getTime();
    expect(ageMs).toBeGreaterThan(59 * 86_400_000);
    expect(ageMs).toBeLessThan(61 * 86_400_000);
  });

  it("returns 500 when delete errors", async () => {
    mockDelete.mockResolvedValue({ error: { message: "boom" } });
    const req = new Request("http://localhost/x", {
      method: "POST",
      headers: { "x-cron-secret": "secret-shh" },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("GET acts as POST", async () => {
    const req = new Request("http://localhost/x", {
      method: "GET",
      headers: { "x-cron-secret": "secret-shh" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
