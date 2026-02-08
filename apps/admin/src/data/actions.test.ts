import { describe, it, expect, vi, beforeEach } from "vitest";
import { messages, moderationActions } from "@nulldiary/db";
import { approveMessage, denyMessage } from "./actions.js";

const { mockUuidv7 } = vi.hoisted(() => ({
  mockUuidv7: vi.fn(),
}));
vi.mock("uuidv7", () => ({ uuidv7: mockUuidv7 }));

function makeFakeDb() {
  const ops: Array<{
    op: string;
    table?: unknown;
    values?: unknown;
    where?: unknown;
  }> = [];
  let selectResult: unknown[] = [];

  const whereChain = {
    where: (_cond: unknown) => {
      ops.push({ op: "where", where: _cond });
      return Promise.resolve(selectResult);
    },
  };

  const fromChain = {
    from: (table: unknown) => {
      ops.push({ op: "from", table });
      return whereChain;
    },
  };

  const setChain = {
    set: (values: unknown) => {
      ops.push({ op: "set", values });
      return whereChain;
    },
  };

  const fakeDb = {
    select: () => {
      ops.push({ op: "select" });
      return fromChain;
    },
    update: (table: unknown) => {
      ops.push({ op: "update", table });
      return setChain;
    },
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        ops.push({ op: "insert", table, values });
        return Promise.resolve();
      },
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(fakeDb);
    },
    ops,
    setSelectResult: (rows: unknown[]) => {
      selectResult = rows;
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
    const pendingMessage = {
      id: "msg-1",
      moderationStatus: "pending",
    };
    db.setSelectResult([pendingMessage]);

    const result = await approveMessage(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
      reason: "Looks good",
    });

    expect(result).toEqual({ ok: true });

    // Should have: select, from, where, update, set, where, insert
    const updateOp = db.ops.find(
      (op) => op.op === "update" && op.table === messages,
    );
    expect(updateOp).toBeTruthy();

    const setOp = db.ops.find((op) => op.op === "set");
    expect((setOp?.values as Record<string, unknown>).moderationStatus).toBe(
      "approved",
    );
    expect((setOp?.values as Record<string, unknown>).moderatedBy).toBe(
      "admin@test.com",
    );
    expect(
      (setOp?.values as Record<string, unknown>).approvedAt,
    ).toBeInstanceOf(Date);

    const insertOp = db.ops.find(
      (op) => op.op === "insert" && op.table === moderationActions,
    );
    expect(insertOp).toBeTruthy();
    expect(insertOp?.values as Record<string, unknown>).toMatchObject({
      id: FIXED_UUID,
      messageId: "msg-1",
      action: "approved",
      actor: "admin@test.com",
      reason: "Looks good",
    });
  });

  it("returns error when message not found", async () => {
    const db = makeFakeDb();
    db.setSelectResult([]);

    const result = await approveMessage(db as never, {
      messageId: "nonexistent",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Message not found" });
  });

  it("returns error when message is not pending", async () => {
    const db = makeFakeDb();
    db.setSelectResult([{ id: "msg-1", moderationStatus: "approved" }]);

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
    db.setSelectResult([{ id: "msg-1", moderationStatus: "pending" }]);

    const result = await approveMessage(db as never, {
      messageId: "msg-1",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: true });

    const insertOp = db.ops.find(
      (op) => op.op === "insert" && op.table === moderationActions,
    );
    expect(
      (insertOp?.values as Record<string, unknown>).reason,
    ).toBeUndefined();
  });
});

describe("denyMessage", () => {
  it("denies a pending message and inserts audit row", async () => {
    const db = makeFakeDb();
    db.setSelectResult([{ id: "msg-2", moderationStatus: "pending" }]);

    const result = await denyMessage(db as never, {
      messageId: "msg-2",
      actor: "mod@test.com",
      reason: "Spam",
    });

    expect(result).toEqual({ ok: true });

    const setOp = db.ops.find((op) => op.op === "set");
    expect((setOp?.values as Record<string, unknown>).moderationStatus).toBe(
      "denied",
    );
    expect((setOp?.values as Record<string, unknown>).moderatedBy).toBe(
      "mod@test.com",
    );
    expect((setOp?.values as Record<string, unknown>).deniedAt).toBeInstanceOf(
      Date,
    );
    // deniedAt, not approvedAt
    expect(
      (setOp?.values as Record<string, unknown>).approvedAt,
    ).toBeUndefined();

    const insertOp = db.ops.find(
      (op) => op.op === "insert" && op.table === moderationActions,
    );
    expect(insertOp?.values as Record<string, unknown>).toMatchObject({
      action: "denied",
      actor: "mod@test.com",
      reason: "Spam",
    });
  });

  it("returns error when message not found", async () => {
    const db = makeFakeDb();
    db.setSelectResult([]);

    const result = await denyMessage(db as never, {
      messageId: "nonexistent",
      actor: "admin@test.com",
    });

    expect(result).toEqual({ ok: false, error: "Message not found" });
  });

  it("returns error when message is already denied", async () => {
    const db = makeFakeDb();
    db.setSelectResult([{ id: "msg-2", moderationStatus: "denied" }]);

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
