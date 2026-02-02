import { describe, it, expect, vi, beforeEach } from "vitest";
import { messages, ingestionEvents } from "@aipromptsecret/db";
import { persistIngestion } from "./persistence.js";
import type { RawRequest, ParseResult } from "./types.js";

const { mockUuidv7 } = vi.hoisted(() => ({
  mockUuidv7: vi.fn(),
}));
vi.mock("uuidv7", () => ({ uuidv7: mockUuidv7 }));

function makeFakeDb() {
  const insertedRows: Array<{ table: unknown; values: unknown }> = [];
  const fakeInsert = (table: unknown) => ({
    values: (values: unknown) => {
      insertedRows.push({ table, values });
      return Promise.resolve();
    },
  });

  return { insert: fakeInsert, insertedRows };
}

function makeRaw(overrides: Partial<RawRequest> = {}): RawRequest {
  return {
    method: "POST",
    path: "/s/",
    query: {},
    headers: { "user-agent": "test-agent" },
    body: '{"message":"hi"}',
    contentType: "application/json",
    ...overrides,
  };
}

describe("persistIngestion", () => {
  beforeEach(() => {
    mockUuidv7
      .mockReset()
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000001")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000002");
  });

  it("inserts message then ingestion_event on success parse", async () => {
    const db = makeFakeDb();
    const raw = makeRaw();
    const parsed: ParseResult = { message: "hi", status: "success", source: "body" };

    await persistIngestion(db as never, raw, parsed);

    expect(db.insertedRows).toHaveLength(2);

    // Message inserted first (FK constraint)
    expect(db.insertedRows[0].table).toBe(messages);
    expect(db.insertedRows[0].values).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      content: "hi",
      moderationStatus: "pending",
    });

    // Ingestion event inserted second
    expect(db.insertedRows[1].table).toBe(ingestionEvents);
    expect(db.insertedRows[1].values).toMatchObject({
      id: "00000000-0000-0000-0000-000000000002",
      method: "POST",
      path: "/s/",
      parsedMessage: "hi",
      parseStatus: "success",
      messageId: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("inserts only ingestion_event on failed parse (no message row)", async () => {
    const db = makeFakeDb();
    const raw = makeRaw({ body: null, contentType: null });
    const parsed: ParseResult = { message: null, status: "failed", source: null };

    await persistIngestion(db as never, raw, parsed);

    expect(db.insertedRows).toHaveLength(1);
    expect(db.insertedRows[0].table).toBe(ingestionEvents);
    expect(db.insertedRows[0].values).toMatchObject({
      parsedMessage: null,
      parseStatus: "failed",
      messageId: null,
    });
  });

  it("stores raw request metadata in ingestion event", async () => {
    const db = makeFakeDb();
    const raw = makeRaw({
      method: "GET",
      path: "/s/hello",
      query: { foo: "bar" },
      headers: { "user-agent": "bot/1.0", "x-message": "hello" },
      body: null,
      contentType: null,
    });
    const parsed: ParseResult = {
      message: "hello",
      status: "success",
      source: "header",
    };

    await persistIngestion(db as never, raw, parsed);

    expect(db.insertedRows[1].values).toMatchObject({
      method: "GET",
      path: "/s/hello",
      query: { foo: "bar" },
      headers: { "user-agent": "bot/1.0", "x-message": "hello" },
      userAgent: "bot/1.0",
      body: null,
    });
  });

  it("stores body in ingestion event", async () => {
    const db = makeFakeDb();
    const raw = makeRaw({ body: '{"message":"stored"}' });
    const parsed: ParseResult = {
      message: "stored",
      status: "success",
      source: "body",
    };

    await persistIngestion(db as never, raw, parsed);

    expect(
      (db.insertedRows[1].values as Record<string, unknown>).body,
    ).toBe('{"message":"stored"}');
  });
});
