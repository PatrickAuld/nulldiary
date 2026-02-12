import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();

function makeFakeDb() {
  const ops: Array<{ op: string; args?: unknown[] }> = [];

  const chain = {
    update: (...args: unknown[]) => {
      ops.push({ op: "update", args });
      return chain;
    },
    eq: (...args: unknown[]) => {
      ops.push({ op: "eq", args });
      return chain;
    },
    then: (resolve: (v: unknown) => void) => resolve({ error: null }),
  } as any;

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

const { POST } = await import("./route.js");

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  fakeDb.ops.length = 0;
});

describe("POST /api/featured/pin", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = new Request("http://localhost/api/featured/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: "set-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("unpins existing and pins requested set", async () => {
    const req = new Request("http://localhost/api/featured/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: "set-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // update pinned=false then pinned=true
    expect(fakeDb.ops.filter((o) => o.op === "update")).toHaveLength(2);
  });
});
