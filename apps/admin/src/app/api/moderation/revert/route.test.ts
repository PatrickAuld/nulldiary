import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRevert = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/data/seed-review", () => ({
  revertModeration: (...args: unknown[]) => mockRevert(...args),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => "fake-db",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

const { POST } = await import("./route.js");

const fakeUser = { id: "user-1", email: "admin@test.com" };

beforeEach(() => {
  mockRevert.mockReset();
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
});

describe("POST /api/moderation/revert", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/moderation/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when messageId missing", async () => {
    const req = new Request("http://localhost/api/moderation/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on successful revert", async () => {
    mockRevert.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/moderation/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockRevert).toHaveBeenCalledWith("fake-db", {
      messageId: "msg-1",
      actor: "admin@test.com",
    });
  });

  it("returns 404 when message not found", async () => {
    mockRevert.mockResolvedValue({ ok: false, error: "Message not found" });

    const req = new Request("http://localhost/api/moderation/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "missing" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when message is already pending", async () => {
    mockRevert.mockResolvedValue({
      ok: false,
      error: "Message is already pending",
    });

    const req = new Request("http://localhost/api/moderation/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
