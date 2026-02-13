import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();

function makeFakeDb() {
  const ops: Array<{ op: string; args?: unknown[] }> = [];

  const chain: any = {
    select: (...args: unknown[]) => {
      ops.push({ op: "select", args });
      return chain;
    },
    eq: (...args: unknown[]) => {
      ops.push({ op: "eq", args });
      return chain;
    },
    maybeSingle: () => {
      ops.push({ op: "maybeSingle" });
      return chain;
    },
    insert: (...args: unknown[]) => {
      ops.push({ op: "insert", args });
      return chain;
    },
    delete: () => {
      ops.push({ op: "delete" });
      return chain;
    },
    then: (resolve: (v: unknown) => void) => {
      // default to no existing row, no errors
      resolve({ data: null, error: null });
    },
  };

  return {
    from: () => chain,
    ops,
  };
}

const fakeDb = makeFakeDb();

vi.mock("@/lib/db", () => ({
  getDb: () => fakeDb,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// uuidv7 used for inserts
vi.mock("uuidv7", () => ({ uuidv7: () => "uuid" }));

const { POST } = await import("./route.js");

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  fakeDb.ops.length = 0;
});

describe("POST /api/featured/membership", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/featured/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: "set", messageId: "msg", op: "add" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("adds membership", async () => {
    const req = new Request("http://localhost/api/featured/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: "set", messageId: "msg", op: "add" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fakeDb.ops.some((o) => o.op === "insert")).toBe(true);
  });

  it("removes membership", async () => {
    const req = new Request("http://localhost/api/featured/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: "set", messageId: "msg", op: "remove" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(fakeDb.ops.some((o) => o.op === "delete")).toBe(true);
  });
});
