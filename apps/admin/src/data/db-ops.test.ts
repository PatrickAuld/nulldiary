import { describe, it, expect } from "vitest";
import { deleteMessagesByStatusOlderThan } from "./db-ops.js";

function makeFakeDb() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const chainMethods = ["delete", "eq", "lt"] as const;
  const chain: Record<string, any> = {};
  for (const method of chainMethods) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }

  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ error: null, count: 123 });
  };

  return {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
    calls,
  };
}

describe("deleteMessagesByStatusOlderThan", () => {
  it("calls delete on messages with status and created_at filter", async () => {
    const db = makeFakeDb();

    const res = await deleteMessagesByStatusOlderThan(
      db as never,
      "pending",
      "2026-01-01T00:00:00.000Z",
    );

    expect(res.deleted).toBe(123);

    expect(db.calls[0]).toEqual({ method: "from", args: ["messages"] });
    expect(db.calls.find((c) => c.method === "delete")?.args).toEqual([
      { count: "exact" },
    ]);
    expect(db.calls.find((c) => c.method === "eq")?.args).toEqual([
      "moderation_status",
      "pending",
    ]);
    expect(db.calls.find((c) => c.method === "lt")?.args).toEqual([
      "created_at",
      "2026-01-01T00:00:00.000Z",
    ]);
  });
});
