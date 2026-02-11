import { describe, it, expect, vi, beforeEach } from "vitest";
import { approveMessage, denyMessage } from "./actions.js";

const { mockUuidv7 } = vi.hoisted(() => ({
  mockUuidv7: vi.fn(),
}));
vi.mock("uuidv7", () => ({ uuidv7: mockUuidv7 }));

/**
 * Builds a fake Supabase client for moderation actions.
 * Supports .from().select().eq().single() for reads
 * and .from().update().eq() / .from().insert() for writes.
 */
function makeFakeDb() {
  const ops: Array<{ op: string; table?: string; args?: unknown }> = [];
  let selectResult: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  };

  const fakeDb = {
    from: (table: string) => {
      ops.push({ op: "from", table });

      return {
        select: (...args: unknown[]) => {
          ops.push({ op: "select", args });
          const chain: Record<string, unknown> = {};
          chain.eq = (...eqArgs: unknown[]) => {
            ops.push({ op: "eq", args: eqArgs });
            return chain;
          };
          chain.single = () => {
            ops.push({ op: "single" });
            return chain;
          };
          chain.then = (resolve: (v: unknown) => void) => {
            resolve(selectResult);
          };
          return chain;
        },
        update: (values: unknown) => {
          ops.push({ op: "update", args: [values] });
          const chain: Record<string, unknown> = {};
          chain.eq = (...args: unknown[]) => {
            ops.push({ op: "eq", args });
            return chain;
          };
          chain.then = (resolve: (v: unknown) => void) => {
            resolve({ error: null });
          };
          return chain;
        },
        insert: (values: unknown) => {
          ops.push({ op: "insert", table, args: [values] });
          const chain: Record<string, unknown> = {};
          chain.then = (resolve: (v: unknown) => void) => {
            resolve({ error: null });
          };
          return chain;
        },
      };
    },
    ops,
    setSelectResult: (data: unknown, error: unknown = null) => {
      selectResult = { data, error };
    },
  };

  return fakeDb;
}

const FIXED_UUID = "01912345-6789-7abc-8def-0123456789ab";

beforeEach(() => {
  mockUuidv7.mockReset().mockReturnValue(FIXED_UUID);
});

describe("approveMessage", () => {
  it("approves a pending message and inserts audit row", async () => {
    const db = makeFakeDb();
    db.setSelectResult({ id: "msg-1", moderation_status: "pending" });

    const result = await approveMessage(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
      reason: "Looks good",
    });

    expect(result).toEqual({ ok: true });

    const updateOp = db.ops.find((op) => op.op === "update");
    expect(updateOp).toBeTruthy();
    const updateValues = (updateOp?.args as unknown[])?.[0] as Record<
      string,
      unknown
    >;
    expect(updateValues.moderation_status).toBe("approved");
    expect(updateValues.moderated_by).toBe("admin@test.com");
    expect(updateValues.approved_at).toBeDefined();

    const insertOp = db.ops.find((op) => op.op === "insert");
    expect(insertOp).toBeTruthy();
    const insertValues = (insertOp?.args as unknown[])?.[0] as Record<
      string,
      unknown
    >;
    expect(insertValues).toMatchObject({
      id: FIXED_UUID,
      message_id: "msg-1",
      action: "approved",
      actor: "admin@test.com",
      reason: "Looks good",
    });
  });

  it("returns error when message not found", async () => {
    const db = makeFakeDb();
    db.setSelectResult(null, {
      code: "PGRST116",
      message: "not found",
      details: "",
      hint: "",
    });

    const result = await approveMessage(db as never, {
      messageId: "nonexistent",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Message not found" });
  });

  it("returns error when message is not pending", async () => {
    const db = makeFakeDb();
    db.setSelectResult({ id: "msg-1", moderation_status: "approved" });

    const result = await approveMessage(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
    });

    expect(result).toEqual({
      ok: false,
      error: "Message is not pending (current status: approved)",
    });
  });

  it("works without a reason", async () => {
    const db = makeFakeDb();
    db.setSelectResult({ id: "msg-1", moderation_status: "pending" });

    const result = await approveMessage(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: true });

    const insertOp = db.ops.find((op) => op.op === "insert");
    const insertValues = (insertOp?.args as unknown[])?.[0] as Record<
      string,
      unknown
    >;
    expect(insertValues.reason).toBeNull();
  });
});

describe("denyMessage", () => {
  it("denies a pending message and inserts audit row", async () => {
    const db = makeFakeDb();
    db.setSelectResult({ id: "msg-2", moderation_status: "pending" });

    const result = await denyMessage(db as never, {
      messageId: "msg-2",
      actor: "mod@test.com",
      reason: "Spam",
    });

    expect(result).toEqual({ ok: true });

    const updateOp = db.ops.find((op) => op.op === "update");
    const updateValues = (updateOp?.args as unknown[])?.[0] as Record<
      string,
      unknown
    >;
    expect(updateValues.moderation_status).toBe("denied");
    expect(updateValues.moderated_by).toBe("mod@test.com");
    expect(updateValues.denied_at).toBeDefined();
    expect(updateValues.approved_at).toBeUndefined();

    const insertOp = db.ops.find((op) => op.op === "insert");
    const insertValues = (insertOp?.args as unknown[])?.[0] as Record<
      string,
      unknown
    >;
    expect(insertValues).toMatchObject({
      action: "denied",
      actor: "mod@test.com",
      reason: "Spam",
    });
  });

  it("returns error when message not found", async () => {
    const db = makeFakeDb();
    db.setSelectResult(null, {
      code: "PGRST116",
      message: "not found",
      details: "",
      hint: "",
    });

    const result = await denyMessage(db as never, {
      messageId: "nonexistent",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Message not found" });
  });

  it("returns error when message is already denied", async () => {
    const db = makeFakeDb();
    db.setSelectResult({ id: "msg-2", moderation_status: "denied" });

    const result = await denyMessage(db as never, {
      messageId: "msg-2",
      actor: "admin@test.com",
    });

    expect(result).toEqual({
      ok: false,
      error: "Message is not pending (current status: denied)",
    });
  });
});
