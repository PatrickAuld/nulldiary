import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateEdited = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/data/actions", () => ({
  updateEditedContent: (...args: unknown[]) => mockUpdateEdited(...args),
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
  mockUpdateEdited.mockReset();
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
});

describe("POST /api/messages/edit", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/messages/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", editedContent: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("updates edited content without changing status", async () => {
    mockUpdateEdited.mockResolvedValue({ ok: true });

    const req = new Request("http://localhost/api/messages/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "msg-1", editedContent: "  hi  " }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(mockUpdateEdited).toHaveBeenCalledWith("fake-db", {
      messageId: "msg-1",
      actor: "admin@test.com",
      editedContent: "hi",
    });
  });

  it("returns 400 when messageId missing", async () => {
    const req = new Request("http://localhost/api/messages/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedContent: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when message not found", async () => {
    mockUpdateEdited.mockResolvedValue({
      ok: false,
      error: "Message not found",
    });

    const req = new Request("http://localhost/api/messages/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: "missing", editedContent: "x" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
