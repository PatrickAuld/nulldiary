import { describe, it, expect } from "vitest";
import { getApprovedMessages, getApprovedMessageById } from "./queries.js";

function makeApprovedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-1",
    content: "Hello world",
    metadata: {},
    created_at: "2024-01-15T00:00:00.000Z",
    approved_at: "2024-01-16T00:00:00.000Z",
    denied_at: null,
    moderation_status: "approved",
    moderated_by: "admin",
    tags: null,
    ...overrides,
  };
}

/**
 * Builds a fake Supabase client for list queries.
 * Two awaits per call: first for data rows, second for count.
 */
function makeFakeDb(resultData: unknown[] = [], countResult: number = 0) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let queryIndex = 0;

  const queryResults = [
    { data: resultData, error: null, count: null },
    { data: null, error: null, count: countResult },
  ];

  function makeChain() {
    const chainMethods = [
      "select",
      "eq",
      "not",
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

/**
 * Fake for queries that call .single() — resolves with a single object.
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
      "not",
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

describe("getApprovedMessages", () => {
  it("returns approved messages and total count", async () => {
    const rows = [makeApprovedMessage(), makeApprovedMessage({ id: "msg-2" })];
    const db = makeFakeDb(rows, 2);

    const result = await getApprovedMessages(db as never, {});

    expect(result.messages).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("defaults to limit 50 offset 0 via range(0, 49)", async () => {
    const db = makeFakeDb([], 0);

    await getApprovedMessages(db as never, {});

    const rangeCall = db.calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it("respects custom limit and offset", async () => {
    const db = makeFakeDb([], 0);

    await getApprovedMessages(db as never, { limit: 10, offset: 20 });

    const rangeCall = db.calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([20, 29]);
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
    const db = makeSingleDb(msg);

    const result = await getApprovedMessageById(db as never, "msg-1");

    expect(result).toEqual(msg);
  });

  it("returns null when not found", async () => {
    const db = makeSingleDb(null, {
      code: "PGRST116",
      message: "not found",
      details: "",
      hint: "",
    });

    const result = await getApprovedMessageById(db as never, "nonexistent");

    expect(result).toBeNull();
  });
});
