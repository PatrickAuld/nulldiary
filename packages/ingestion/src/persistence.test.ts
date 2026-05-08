import { describe, it, expect, vi, beforeEach } from "vitest";
import { persistIngestion } from "./persistence.js";
import { normalizeMessage, hashContent } from "./normalize.js";
import type { RawRequest, ParseResult } from "./types.js";

const { mockUuidv7 } = vi.hoisted(() => ({
  mockUuidv7: vi.fn(),
}));
vi.mock("uuidv7", () => ({ uuidv7: mockUuidv7 }));

function makeFakeDb() {
  const insertedRows: Array<{ table: string; values: unknown }> = [];

  return {
    from: (table: string) => ({
      insert: (values: unknown) => {
        insertedRows.push({ table, values });
        return Promise.resolve({ error: null });
      },
    }),
    insertedRows,
  };
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
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000002")
      .mockReturnValueOnce("00000000-0000-0000-0000-000000000003");
  });

  it("inserts message then ingestion_event on success parse", async () => {
    const db = makeFakeDb();
    const raw = makeRaw();
    const parsed: ParseResult = {
      message: "hi",
      status: "success",
      source: "body",
    };

    await persistIngestion(db as never, raw, parsed);

    expect(db.insertedRows).toHaveLength(2);

    // Message inserted first (FK constraint)
    expect(db.insertedRows[0].table).toBe("messages");
    expect(db.insertedRows[0].values).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      content: "hi",
      normalized_content: normalizeMessage("hi"),
      content_hash: hashContent(normalizeMessage("hi")),
      moderation_status: "pending",
    });

    // Ingestion event inserted second
    expect(db.insertedRows[1].table).toBe("ingestion_events");
    expect(db.insertedRows[1].values).toMatchObject({
      id: "00000000-0000-0000-0000-000000000002",
      method: "POST",
      path: "/s/",
      parsed_message: "hi",
      parse_status: "success",
      message_id: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("inserts only ingestion_event on failed parse (no message row)", async () => {
    const db = makeFakeDb();
    const raw = makeRaw({ body: null, contentType: null });
    const parsed: ParseResult = {
      message: null,
      status: "failed",
      source: null,
    };

    await persistIngestion(db as never, raw, parsed);

    expect(db.insertedRows).toHaveLength(1);
    expect(db.insertedRows[0].table).toBe("ingestion_events");
    expect(db.insertedRows[0].values).toMatchObject({
      parsed_message: null,
      parse_status: "failed",
      message_id: null,
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
      user_agent: "bot/1.0",
      body: null,
    });
  });

  it("inserts message as auto-denied when autoDecision is provided", async () => {
    const db = makeFakeDb();
    const raw = makeRaw();
    const parsed: ParseResult = {
      message: "hi",
      status: "success",
      source: "body",
    };

    await persistIngestion(db as never, raw, parsed, {
      action: "denied",
      reason: "dupe_of_denied",
      actor: "system:auto-mod@v1",
    });

    const messageInsert = db.insertedRows.find((r) => r.table === "messages");
    expect(messageInsert).toBeDefined();
    const values = messageInsert!.values as Record<string, unknown>;
    expect(values.moderation_status).toBe("denied");
    expect(values.auto_action).toBe("denied");
    expect(values.auto_action_reason).toBe("dupe_of_denied");
    expect(values.denied_at).toBeDefined();
    expect(typeof values.denied_at).toBe("string");
  });

  it("writes a moderation_actions audit row when autoDecision is provided", async () => {
    const db = makeFakeDb();
    const raw = makeRaw();
    const parsed: ParseResult = {
      message: "hi",
      status: "success",
      source: "body",
    };

    await persistIngestion(db as never, raw, parsed, {
      action: "denied",
      reason: "dupe_of_denied",
      actor: "system:auto-mod@v1",
    });

    const auditRow = db.insertedRows.find(
      (r) => r.table === "moderation_actions",
    );
    expect(auditRow).toBeDefined();
    expect(auditRow!.values).toMatchObject({
      message_id: "00000000-0000-0000-0000-000000000001",
      action: "denied",
      actor: "system:auto-mod@v1",
      reason: "dupe_of_denied",
    });

    // Audit row must reference the message, so messages must be inserted first.
    const messageIdx = db.insertedRows.findIndex((r) => r.table === "messages");
    const auditIdx = db.insertedRows.findIndex(
      (r) => r.table === "moderation_actions",
    );
    expect(messageIdx).toBeLessThan(auditIdx);
  });

  it("does not insert a message when autoDecision is provided but parse failed", async () => {
    const db = makeFakeDb();
    const raw = makeRaw({ body: null, contentType: null });
    const parsed: ParseResult = {
      message: null,
      status: "failed",
      source: null,
    };

    await persistIngestion(db as never, raw, parsed, {
      action: "denied",
      reason: "dupe_of_denied",
      actor: "system:auto-mod@v1",
    });

    expect(db.insertedRows.find((r) => r.table === "messages")).toBeUndefined();
    expect(
      db.insertedRows.find((r) => r.table === "moderation_actions"),
    ).toBeUndefined();
    expect(
      db.insertedRows.find((r) => r.table === "ingestion_events"),
    ).toBeDefined();
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

    expect((db.insertedRows[1].values as Record<string, unknown>).body).toBe(
      '{"message":"stored"}',
    );
  });
});
