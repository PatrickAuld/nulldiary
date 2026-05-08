import { describe, it, expect, vi, beforeEach } from "vitest";

const { classifyToxicity, detectPii, applyAutoDeny, applyFlag, applyClear } =
  vi.hoisted(() => ({
    classifyToxicity: vi.fn(),
    detectPii: vi.fn(),
    applyAutoDeny: vi.fn(),
    applyFlag: vi.fn(),
    applyClear: vi.fn(),
  }));

vi.mock("@nulldiary/moderation", async () => {
  const actual = await vi.importActual<typeof import("@nulldiary/moderation")>(
    "@nulldiary/moderation",
  );
  return {
    ...actual,
    classifyToxicity,
    detectPii,
    applyAutoDeny,
    applyFlag,
    applyClear,
  };
});

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb }));

import { GET } from "./route.js";

type PendingRow = { id: string; content: string };

function makeFakeDb(rows: PendingRow[] = []) {
  return {
    from: (table: string) => {
      if (table !== "messages") throw new Error(`unexpected table: ${table}`);
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.is = () => chain;
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({ data: rows, error: null });
      return chain;
    },
  };
}

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://test/api/cron/moderate", { headers });
}

beforeEach(() => {
  classifyToxicity.mockReset();
  detectPii.mockReset();
  applyAutoDeny.mockReset();
  applyFlag.mockReset();
  applyClear.mockReset();
  getDb.mockReset();
  process.env.CRON_SECRET = "test-secret";
  process.env.OPENAI_API_KEY = "sk-test";
});

describe("GET /api/cron/moderate", () => {
  it("returns 401 without Authorization: Bearer $CRON_SECRET", async () => {
    getDb.mockReturnValue(makeFakeDb([]));
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer", async () => {
    getDb.mockReturnValue(makeFakeDb([]));
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 500 if OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    getDb.mockReturnValue(makeFakeDb([]));
    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(500);
  });

  it("clears a message with sub-threshold scores and no PII", async () => {
    getDb.mockReturnValue(makeFakeDb([{ id: "msg-1", content: "hi there" }]));
    classifyToxicity.mockResolvedValue({ hate: 0.1 });
    detectPii.mockReturnValue([]);

    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      processed: 1,
      cleared: 1,
      denied: 0,
      flagged: 0,
      skipped: 0,
    });
    expect(applyClear).toHaveBeenCalledTimes(1);
    expect(applyAutoDeny).not.toHaveBeenCalled();
    expect(applyFlag).not.toHaveBeenCalled();
  });

  it("auto-denies a message scoring above T_DENY for hate", async () => {
    getDb.mockReturnValue(makeFakeDb([{ id: "msg-1", content: "bad text" }]));
    classifyToxicity.mockResolvedValue({ hate: 0.99 });
    detectPii.mockReturnValue([]);

    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ processed: 1, denied: 1 });
    expect(applyAutoDeny).toHaveBeenCalledTimes(1);
    expect(applyAutoDeny.mock.calls[0][1]).toMatchObject({
      messageId: "msg-1",
      reason: "tox:hate",
    });
  });

  it("auto-denies a message containing a Luhn-valid CC via pii:credit_card", async () => {
    getDb.mockReturnValue(
      makeFakeDb([{ id: "msg-1", content: "card 4111-1111-1111-1111" }]),
    );
    classifyToxicity.mockResolvedValue({});
    detectPii.mockReturnValue([
      {
        category: "credit_card",
        match: "4111-1111-1111-1111",
        start: 5,
        end: 24,
      },
    ]);

    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    expect(applyAutoDeny).toHaveBeenCalledTimes(1);
    expect(applyAutoDeny.mock.calls[0][1]).toMatchObject({
      reason: "pii:credit_card",
    });
  });

  it("continues processing when an applier throws on one message", async () => {
    getDb.mockReturnValue(
      makeFakeDb([
        { id: "msg-1", content: "first" },
        { id: "msg-2", content: "second" },
      ]),
    );
    classifyToxicity.mockResolvedValue({ hate: 0.1 });
    detectPii.mockReturnValue([]);
    applyClear.mockImplementationOnce(async () => {
      throw new Error("db is sad");
    });
    applyClear.mockResolvedValueOnce(undefined);

    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.cleared).toBe(1);
  });

  it("skips a message when classifyToxicity throws (fail-open)", async () => {
    getDb.mockReturnValue(
      makeFakeDb([
        { id: "msg-1", content: "boom" },
        { id: "msg-2", content: "ok" },
      ]),
    );
    classifyToxicity.mockImplementation(async (text: string) => {
      if (text === "boom") throw new Error("openai is sad");
      return { hate: 0.1 };
    });
    detectPii.mockReturnValue([]);

    const res = await GET(makeReq("Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBeGreaterThanOrEqual(1);
    expect(body.cleared).toBe(1);
    expect(applyClear).toHaveBeenCalledTimes(1);
    // No applier ran for the failing message.
    const allApplyCalls =
      applyAutoDeny.mock.calls.length +
      applyFlag.mock.calls.length +
      applyClear.mock.calls.length;
    expect(allApplyCalls).toBe(1);
  });
});
