import { describe, it, expect } from "vitest";
import { getApprovedMessages, getApprovedMessageById } from "./queries.js";

function makeApprovedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    content: "Hello world",
    metadata: {},
    createdAt: new Date("2024-01-15"),
    approvedAt: new Date("2024-01-16"),
    deniedAt: null,
    moderationStatus: "approved",
    moderatedBy: "admin",
    tags: null,
    ...overrides,
  };
}

/**
 * Builds a fake db that tracks chained calls so we can assert
 * which tables, conditions, orderings, limits, and offsets are used.
 *
 * Same pattern as the admin app tests — two query chains per call:
 * one for rows, one for count.
 */
function makeFakeDb(resultRows: unknown[] = [], countResult: number = 0) {
  const calls: Array<{ method: string; args?: unknown }> = [];
  let callIndex = 0;

  const results = [resultRows, [{ count: countResult }]];

  function makeChain(): Record<string, (...args: unknown[]) => unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const chainMethods = ["from", "where", "orderBy", "limit", "offset"];

    for (const method of chainMethods) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    }

    chain.then = (resolve: (v: unknown) => void) => {
      resolve(results[callIndex++]);
    };

    return chain;
  }

  const fakeDb = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return makeChain();
    },
    calls,
  };

  return fakeDb;
}

/**
 * Single-result fake db for getApprovedMessageById — only one query chain,
 * no count query.
 */
function makeSingleResultDb(resultRows: unknown[] = []) {
  const calls: Array<{ method: string; args?: unknown }> = [];

  function makeChain(): Record<string, (...args: unknown[]) => unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const chainMethods = ["from", "where", "orderBy", "limit", "offset"];

    for (const method of chainMethods) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    }

    chain.then = (resolve: (v: unknown) => void) => {
      resolve(resultRows);
    };

    return chain;
  }

  const fakeDb = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return makeChain();
    },
    calls,
  };

  return fakeDb;
}

describe("getApprovedMessages", () => {
  it("returns approved messages and total count", async () => {
    const rows = [
      makeApprovedMessage(),
      makeApprovedMessage({ id: "msg-2" }),
    ];
    const db = makeFakeDb(rows, 2);

    const result = await getApprovedMessages(db as never, {});

    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("defaults to limit 50 and offset 0", async () => {
    const db = makeFakeDb([], 0);

    await getApprovedMessages(db as never, {});

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args?.[0]).toBe(50);

    const offsetCall = db.calls.find((c) => c.method === "offset");
    expect(offsetCall?.args?.[0]).toBe(0);
  });

  it("respects custom limit and offset", async () => {
    const db = makeFakeDb([], 0);

    await getApprovedMessages(db as never, { limit: 10, offset: 20 });

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args?.[0]).toBe(10);

    const offsetCall = db.calls.find((c) => c.method === "offset");
    expect(offsetCall?.args?.[0]).toBe(20);
  });

  it("returns empty results gracefully", async () => {
    const db = makeFakeDb([], 0);

    const result = await getApprovedMessages(db as never, {});

    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("getApprovedMessageById", () => {
  it("returns the message when found and approved", async () => {
    const msg = makeApprovedMessage();
    const db = makeSingleResultDb([msg]);

    const result = await getApprovedMessageById(db as never, "msg-1");

    expect(result).toEqual(msg);
  });

  it("returns null when not found", async () => {
    const db = makeSingleResultDb([]);

    const result = await getApprovedMessageById(db as never, "nonexistent");

    expect(result).toBeNull();
  });
});
