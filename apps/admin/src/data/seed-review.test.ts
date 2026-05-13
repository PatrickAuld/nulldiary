import { describe, it, expect } from "vitest";
import {
  getLatestPendingBatch,
  countPendingInBatch,
  listPendingInBatch,
  revertModeration,
} from "./seed-review.js";

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    content: "Hello world",
    metadata: {},
    created_at: "2024-01-15T00:00:00.000Z",
    approved_at: null,
    denied_at: null,
    moderation_status: "pending",
    moderated_by: null,
    tags: null,
    ...overrides,
  };
}

/**
 * Records every chained call and returns a configurable result. The chain
 * supports the methods seed-review queries use: select, eq, not, order, limit,
 * single, update, insert.
 */
function makeFakeDb(
  results: Array<{
    data?: unknown;
    error?: unknown;
    count?: number;
  }> = [],
) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let resultIndex = 0;

  function makeChain() {
    const methods = [
      "select",
      "eq",
      "not",
      "ilike",
      "gt",
      "lt",
      "order",
      "range",
      "limit",
      "single",
      "update",
      "insert",
    ];
    const chain: Record<string, unknown> = {};
    for (const m of methods) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => void) => {
      const result = results[resultIndex++] ?? {
        data: null,
        error: null,
        count: 0,
      };
      resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      });
    };
    return chain;
  }

  return {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return makeChain();
    },
    calls,
  };
}

describe("getLatestPendingBatch", () => {
  it("returns the batch from the newest pending seeded message", async () => {
    const db = makeFakeDb([
      {
        data: [
          {
            metadata: { seed: { batch: "batch-2026-05-08-01" } },
            created_at: "2026-05-08T12:00:00Z",
          },
        ],
      },
    ]);

    const result = await getLatestPendingBatch(db as never);

    expect(result).toBe("batch-2026-05-08-01");
  });

  it("filters on moderation_status = pending and seeded metadata", async () => {
    const db = makeFakeDb([{ data: [] }]);

    await getLatestPendingBatch(db as never);

    const eqCalls = db.calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some(
        (c) => c.args[0] === "moderation_status" && c.args[1] === "pending",
      ),
    ).toBe(true);

    const notCalls = db.calls.filter((c) => c.method === "not");
    expect(notCalls.some((c) => c.args[0] === "metadata->seed->>batch")).toBe(
      true,
    );
  });

  it("orders by created_at descending and limits to 1", async () => {
    const db = makeFakeDb([{ data: [] }]);

    await getLatestPendingBatch(db as never);

    const orderCall = db.calls.find((c) => c.method === "order");
    expect(orderCall?.args[0]).toBe("created_at");
    expect(orderCall?.args[1]).toEqual({ ascending: false });

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args).toEqual([1]);
  });

  it("returns null when there are no pending seeded messages", async () => {
    const db = makeFakeDb([{ data: [] }]);

    const result = await getLatestPendingBatch(db as never);

    expect(result).toBeNull();
  });

  it("returns null when metadata.seed.batch is missing or non-string", async () => {
    const db = makeFakeDb([{ data: [{ metadata: { seed: { batch: 42 } } }] }]);

    const result = await getLatestPendingBatch(db as never);

    expect(result).toBeNull();
  });
});

describe("countPendingInBatch", () => {
  it("returns the count for the given batch", async () => {
    const db = makeFakeDb([{ count: 47 }]);

    const result = await countPendingInBatch(db as never, "batch-foo");

    expect(result).toBe(47);
  });

  it("filters on both moderation_status and the JSONB batch field", async () => {
    const db = makeFakeDb([{ count: 0 }]);

    await countPendingInBatch(db as never, "batch-bar");

    const eqCalls = db.calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some(
        (c) => c.args[0] === "moderation_status" && c.args[1] === "pending",
      ),
    ).toBe(true);
    expect(
      eqCalls.some(
        (c) =>
          c.args[0] === "metadata->seed->>batch" && c.args[1] === "batch-bar",
      ),
    ).toBe(true);
  });

  it("returns 0 when no rows match", async () => {
    const db = makeFakeDb([{ count: 0 }]);

    const result = await countPendingInBatch(db as never, "batch-empty");

    expect(result).toBe(0);
  });
});

describe("listPendingInBatch", () => {
  it("returns messages in the batch", async () => {
    const rows = [makeMessage(), makeMessage({ id: "msg-2" })];
    const db = makeFakeDb([{ data: rows }]);

    const result = await listPendingInBatch(db as never, "batch-x");

    expect(result).toHaveLength(2);
  });

  it("orders chronologically (ascending) so reviewer walks oldest-first", async () => {
    const db = makeFakeDb([{ data: [] }]);

    await listPendingInBatch(db as never, "batch-x");

    const orderCall = db.calls.find((c) => c.method === "order");
    expect(orderCall?.args[0]).toBe("created_at");
    expect(orderCall?.args[1]).toEqual({ ascending: true });
  });

  it("applies a default cap of 500 messages", async () => {
    const db = makeFakeDb([{ data: [] }]);

    await listPendingInBatch(db as never, "batch-x");

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args).toEqual([500]);
  });

  it("respects an explicit limit override", async () => {
    const db = makeFakeDb([{ data: [] }]);

    await listPendingInBatch(db as never, "batch-x", 50);

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args).toEqual([50]);
  });
});

describe("revertModeration", () => {
  it("returns ok and resets a denied message back to pending", async () => {
    const db = makeFakeDb([
      // select message: id + status
      { data: { id: "msg-1", moderation_status: "denied" } },
      // update messages: ok
      { error: null },
    ]);

    const result = await revertModeration(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: true });

    const updateCall = db.calls.find((c) => c.method === "update");
    const values = updateCall?.args[0] as Record<string, unknown>;
    expect(values.moderation_status).toBe("pending");
    expect(values.approved_at).toBeNull();
    expect(values.denied_at).toBeNull();
    expect(values.moderated_by).toBe("admin@test.com");
  });

  it("returns error when message is not found", async () => {
    const db = makeFakeDb([{ data: null, error: { code: "PGRST116" } }]);

    const result = await revertModeration(db as never, {
      messageId: "nope",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Message not found" });
  });

  it("returns error when message is already pending (nothing to undo)", async () => {
    const db = makeFakeDb([
      { data: { id: "msg-1", moderation_status: "pending" } },
    ]);

    const result = await revertModeration(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/already pending/);
    }
  });
});
