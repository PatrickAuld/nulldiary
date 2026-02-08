import { describe, it, expect } from "vitest";
import {
  listMessages,
  getMessageById,
  getIngestionEventsByMessageId,
} from "./queries.js";

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    content: "Hello world",
    metadata: {},
    createdAt: new Date("2024-01-15"),
    approvedAt: null,
    deniedAt: null,
    moderationStatus: "pending",
    moderatedBy: null,
    tags: null,
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    receivedAt: new Date("2024-01-15"),
    method: "POST",
    path: "/s/",
    query: {},
    headers: {},
    body: '{"message":"hi"}',
    sourceIp: null,
    userAgent: "test-agent",
    rawPayload: null,
    parsedMessage: "hi",
    parseStatus: "success",
    messageId: "msg-1",
    ...overrides,
  };
}

/**
 * Builds a fake db that tracks chained calls so we can assert
 * which tables, conditions, orderings, limits, and offsets are used.
 */
function makeFakeDb(resultRows: unknown[] = [], countResult: number = 0) {
  const calls: Array<{ method: string; args?: unknown }> = [];
  let callIndex = 0;

  // Two query chains are expected: one for rows, one for count
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

    // Terminal — returns the result
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

describe("listMessages", () => {
  it("returns messages and total count", async () => {
    const rows = [makeMessage(), makeMessage({ id: "msg-2" })];
    const db = makeFakeDb(rows, 2);

    const result = await listMessages(db as never, {});

    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("defaults to limit 50 and offset 0", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, {});

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args?.[0]).toBe(50);

    const offsetCall = db.calls.find((c) => c.method === "offset");
    expect(offsetCall?.args?.[0]).toBe(0);
  });

  it("respects custom limit and offset", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, { limit: 10, offset: 20 });

    const limitCall = db.calls.find((c) => c.method === "limit");
    expect(limitCall?.args?.[0]).toBe(10);

    const offsetCall = db.calls.find((c) => c.method === "offset");
    expect(offsetCall?.args?.[0]).toBe(20);
  });

  it("returns empty results gracefully", async () => {
    const db = makeFakeDb([], 0);

    const result = await listMessages(db as never, { status: "approved" });

    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("getMessageById", () => {
  it("returns the message when found", async () => {
    const msg = makeMessage();
    const db = makeFakeDb([msg]);

    const result = await getMessageById(db as never, "msg-1");

    expect(result).toEqual(msg);
  });

  it("returns null when not found", async () => {
    const db = makeFakeDb([]);

    const result = await getMessageById(db as never, "nonexistent");

    expect(result).toBeNull();
  });
});

describe("getIngestionEventsByMessageId", () => {
  it("returns events for a message", async () => {
    const events = [makeEvent(), makeEvent({ id: "evt-2" })];
    const db = makeFakeDb(events);

    const result = await getIngestionEventsByMessageId(db as never, "msg-1");

    expect(result).toHaveLength(2);
  });

  it("returns empty array when no events exist", async () => {
    const db = makeFakeDb([]);

    const result = await getIngestionEventsByMessageId(db as never, "msg-1");

    expect(result).toEqual([]);
  });
});
