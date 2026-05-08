import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApproveMessage = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/data/actions", () => ({
  approveMessage: (...args: unknown[]) => mockApproveMessage(...args),
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
  mockApproveMessage.mockReset();
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
});

describe("POST /api/moderation/approve", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("approves a message with actor from session", async () => {
    mockApproveMessage.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: "msg-1",
        reason: "Good",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockApproveMessage).toHaveBeenCalledWith("fake-db", {
      messageId: "msg-1",
      actor: "admin@test.com",
      reason: "Good",
    });
  });

  it("uses user id as actor when email is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: null } },
    });
    mockApproveMessage.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockApproveMessage).toHaveBeenCalledWith("fake-db", {
      messageId: "msg-1",
      actor: "user-1",
      reason: undefined,
    });
  });

  it("returns 400 when messageId is missing", async () => {
    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 404 when message not found", async () => {
    mockApproveMessage.mockResolvedValue({
      ok: false,
      error: "Message not found",
    });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "nonexistent" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Message not found");
  });

  it("forwards override=true to approveMessage", async () => {
    mockApproveMessage.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-9", override: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockApproveMessage).toHaveBeenCalledWith("fake-db", {
      messageId: "msg-9",
      actor: "admin@test.com",
      reason: undefined,
      editedContent: undefined,
      override: true,
    });
  });

  it("does not forward override when omitted", async () => {
    mockApproveMessage.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    await POST(req);
    const call = mockApproveMessage.mock.calls[0][1] as { override?: boolean };
    expect(call.override).toBeUndefined();
  });

  it("returns 400 when message is not pending", async () => {
    mockApproveMessage.mockResolvedValue({
      ok: false,
      error: "Message is not pending (current status: approved)",
    });

    const req = new Request("http://localhost/api/moderation/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
