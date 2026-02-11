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
    created_at: "2024-01-15T00:00:00.000Z",
    approved_at: null,
    denied_at: null,
    moderation_status: "pending",
    moderated_by: null,
    tags: null,
    ...overrides,
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    received_at: "2024-01-15T00:00:00.000Z",
    method: "POST",
    path: "/s/",
    query: {},
    headers: {},
    body: '{"message":"hi"}',
    source_ip: null,
    user_agent: "test-agent",
    raw_payload: null,
    parsed_message: "hi",
    parse_status: "success",
    message_id: "msg-1",
    ...overrides,
  };
}

/**
 * Builds a fake Supabase client that tracks chained calls.
 * Each `from()` call starts a new query chain that records method calls
 * and resolves with the configured result when awaited.
 */
function makeFakeDb(resultData: unknown[] = [], countResult: number = 0) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let queryIndex = 0;

  // Results for sequential queries: first for data, second for count
  const queryResults = [
    { data: resultData, error: null, count: null },
    { data: null, error: null, count: countResult },
  ];

  function makeChain() {
    const chainMethods = [
      "select",
      "eq",
      "ilike",
      "gt",
      "lt",
      "order",
      "range",
      "single",
    ];

    const chain: Record<string, unknown> = {};

    for (const method of chainMethods) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    }

    // Make the chain thenable so `await` resolves to the result
    chain.then = (resolve: (v: unknown) => void) => {
      const result = queryResults[queryIndex++] ?? {
        data: null,
        error: null,
        count: null,
      };
      resolve(result);
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

describe("listMessages", () => {
  it("returns messages and total count", async () => {
    const rows = [makeMessage(), makeMessage({ id: "msg-2" })];
    const db = makeFakeDb(rows, 2);

    const result = await listMessages(db as never, {});

    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("defaults to limit 50 offset 0 via range(0, 49)", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, {});

    const rangeCall = db.calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it("respects custom limit and offset", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, { limit: 10, offset: 20 });

    const rangeCall = db.calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([20, 29]);
  });

  it("returns empty results gracefully", async () => {
    const db = makeFakeDb([], 0);

    const result = await listMessages(db as never, { status: "approved" });

    expect(result.messages).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("applies status filter", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, { status: "pending" });

    const eqCalls = db.calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some(
        (c) => c.args[0] === "moderation_status" && c.args[1] === "pending",
      ),
    ).toBe(true);
  });

  it("applies search filter with ilike", async () => {
    const db = makeFakeDb([], 0);

    await listMessages(db as never, { search: "hello" });

    const ilikeCalls = db.calls.filter((c) => c.method === "ilike");
    expect(
      ilikeCalls.some(
        (c) => c.args[0] === "content" && c.args[1] === "%hello%",
      ),
    ).toBe(true);
  });

  it("applies date filters", async () => {
    const db = makeFakeDb([], 0);
    const after = new Date("2024-01-01");
    const before = new Date("2024-12-31");

    await listMessages(db as never, { after, before });

    const gtCalls = db.calls.filter((c) => c.method === "gt");
    expect(gtCalls.some((c) => c.args[0] === "created_at")).toBe(true);

    const ltCalls = db.calls.filter((c) => c.method === "lt");
    expect(ltCalls.some((c) => c.args[0] === "created_at")).toBe(true);
  });
});

describe("getMessageById", () => {
  it("returns the message when found", async () => {
    const msg = makeMessage();
    const singleDb = makeSingleDb(msg);

    const result = await getMessageById(singleDb as never, "msg-1");

    expect(result).toEqual(msg);
  });

  it("returns null when not found", async () => {
    const singleDb = makeSingleDb(null, {
      code: "PGRST116",
      message: "not found",
      details: "",
      hint: "",
    });

    const result = await getMessageById(singleDb as never, "nonexistent");

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

/**
 * Fake for queries that call .single() — resolves with a single object
 * (or error) instead of an array.
 */
function makeSingleDb(
  resultData: unknown | null,
  resultError: {
    code: string;
    message: string;
    details: string;
    hint: string;
  } | null = null,
) {
  function makeChain() {
    const chainMethods = [
      "select",
      "eq",
      "ilike",
      "gt",
      "lt",
      "order",
      "range",
      "single",
    ];

    const chain: Record<string, unknown> = {};

    for (const method of chainMethods) {
      chain[method] = () => chain;
    }

    chain.then = (resolve: (v: unknown) => void) => {
      resolve({ data: resultData, error: resultError });
    };

    return chain;
  }

  return {
    from: () => makeChain(),
  };
}
