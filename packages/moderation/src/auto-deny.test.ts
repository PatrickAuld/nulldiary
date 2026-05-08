import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  findDupeByContentHash,
  applyAutoDeny,
  applyFlag,
  applyClear,
} from "./auto-deny.js";

const { mockUuidv7 } = vi.hoisted(() => ({ mockUuidv7: vi.fn() }));
vi.mock("uuidv7", () => ({ uuidv7: mockUuidv7 }));

beforeEach(() => {
  mockUuidv7.mockReset();
  mockUuidv7.mockReturnValue("01912345-6789-7abc-8def-0123456789ab");
});

type MessageRow = {
  id: string;
  content_hash: string;
  moderation_status: "pending" | "approved" | "denied";
  created_at: string;
};

function makeFakeDb(rows: MessageRow[] = []) {
  const ops: Array<{ kind: string; hash?: string }> = [];
  const db = {
    from: (table: string) => {
      if (table !== "messages") {
        throw new Error(`unexpected table: ${table}`);
      }
      let hashFilter: string | null = null;
      let orderCol: string | null = null;
      let orderDesc = false;
      let limit: number | null = null;
      const builder = {
        select: () => builder,
        eq(col: string, val: string) {
          if (col === "content_hash") hashFilter = val;
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderCol = col;
          orderDesc = opts?.ascending === false;
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        then(resolve: (v: { data: MessageRow[]; error: null }) => unknown) {
          ops.push({ kind: "select", hash: hashFilter ?? undefined });
          let result = rows.filter(
            (r) => hashFilter === null || r.content_hash === hashFilter,
          );
          if (orderCol === "created_at") {
            result = [...result].sort((a, b) =>
              orderDesc
                ? b.created_at.localeCompare(a.created_at)
                : a.created_at.localeCompare(b.created_at),
            );
          }
          if (limit !== null) result = result.slice(0, limit);
          return Promise.resolve({ data: result, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
  return { db, ops };
}

describe("findDupeByContentHash", () => {
  it("returns null when no message with that hash exists", async () => {
    const { db } = makeFakeDb();
    const result = await findDupeByContentHash(db as never, "deadbeef");
    expect(result).toBeNull();
  });

  it("returns the most recent match when multiple share the hash", async () => {
    const { db } = makeFakeDb([
      {
        id: "msg-old-approved",
        content_hash: "abc123",
        moderation_status: "approved",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "msg-new-denied",
        content_hash: "abc123",
        moderation_status: "denied",
        created_at: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "msg-mid-pending",
        content_hash: "abc123",
        moderation_status: "pending",
        created_at: "2026-01-15T00:00:00.000Z",
      },
    ]);
    const result = await findDupeByContentHash(db as never, "abc123");
    expect(result).toEqual({ status: "denied", messageId: "msg-new-denied" });
  });

  it("returns the match when one denied message has the hash", async () => {
    const { db } = makeFakeDb([
      {
        id: "msg-1",
        content_hash: "abc123",
        moderation_status: "denied",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const result = await findDupeByContentHash(db as never, "abc123");
    expect(result).toEqual({ status: "denied", messageId: "msg-1" });
  });

  it("propagates DB errors so callers can decide whether to fail open", async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                then: (
                  resolve: (v: {
                    data: null;
                    error: { code: string };
                  }) => unknown,
                ) =>
                  Promise.resolve({
                    data: null,
                    error: { code: "PGRST500" },
                  }).then(resolve),
              }),
            }),
          }),
        }),
      }),
    };
    await expect(
      findDupeByContentHash(db as never, "abc123"),
    ).rejects.toMatchObject({ code: "PGRST500" });
  });

  it("maps each moderation_status value through to the result", async () => {
    for (const status of ["pending", "approved", "denied"] as const) {
      const { db } = makeFakeDb([
        {
          id: `msg-${status}`,
          content_hash: "abc123",
          moderation_status: status,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ]);
      const result = await findDupeByContentHash(db as never, "abc123");
      expect(result).toEqual({ status, messageId: `msg-${status}` });
    }
  });
});

type WriteOp =
  | {
      op: "update";
      table: string;
      values: Record<string, unknown>;
      filters: Array<[string, unknown]>;
    }
  | {
      op: "insert";
      table: string;
      values: Record<string, unknown>;
    };

function makeWriterDb(opts: { updateRows?: unknown[] } = {}) {
  const ops: WriteOp[] = [];
  const updateRows = opts.updateRows ?? [{ id: "msg-1" }];
  const db = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const chain: Record<string, unknown> = {};
        chain.eq = (col: string, val: unknown) => {
          filters.push([col, val]);
          return chain;
        };
        chain.select = () => {
          ops.push({ op: "update", table, values, filters });
          return Promise.resolve({ data: updateRows, error: null });
        };
        chain.then = (resolve: (v: unknown) => void) => {
          ops.push({ op: "update", table, values, filters });
          resolve({ data: updateRows, error: null });
        };
        return chain;
      },
      insert: (values: Record<string, unknown>) => {
        ops.push({ op: "insert", table, values });
        return {
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: null, error: null }),
        };
      },
    }),
  };
  return { db, ops };
}

describe("applyAutoDeny", () => {
  const FIXED_UUID = "01912345-6789-7abc-8def-0123456789ab";

  it("updates the message to denied (filtered to still-pending) and inserts an audit row", async () => {
    mockUuidv7.mockReturnValue(FIXED_UUID);
    const { db, ops } = makeWriterDb({ updateRows: [{ id: "msg-1" }] });

    await applyAutoDeny(db as never, {
      messageId: "msg-1",
      reason: "tox:hate",
      actor: "system:auto-mod@v1",
    });

    const update = ops.find((o) => o.op === "update");
    expect(update?.table).toBe("messages");
    expect(update?.values).toMatchObject({
      moderation_status: "denied",
      auto_action: "denied",
      auto_action_reason: "tox:hate",
      moderated_by: "system:auto-mod@v1",
    });
    expect(update?.values.denied_at).toBeDefined();
    if (update?.op !== "update") throw new Error();
    expect(update.filters).toEqual(
      expect.arrayContaining([
        ["id", "msg-1"],
        ["moderation_status", "pending"],
      ]),
    );

    const insert = ops.find((o) => o.op === "insert");
    expect(insert?.table).toBe("moderation_actions");
    expect(insert?.values).toMatchObject({
      id: FIXED_UUID,
      message_id: "msg-1",
      action: "denied",
      actor: "system:auto-mod@v1",
      reason: "tox:hate",
    });
  });

  it("no-ops (no audit row) if the message is no longer pending", async () => {
    const { db, ops } = makeWriterDb({ updateRows: [] });

    await applyAutoDeny(db as never, {
      messageId: "msg-1",
      reason: "tox:hate",
      actor: "system:auto-mod@v1",
    });

    expect(ops.find((o) => o.op === "insert")).toBeUndefined();
  });
});

describe("applyFlag", () => {
  it("writes risk_score, risk_labels, auto_action='flagged', scored_at; no audit row", async () => {
    const { db, ops } = makeWriterDb();
    await applyFlag(db as never, {
      messageId: "msg-1",
      riskScore: 0.7,
      labels: [{ category: "hate", score: 0.7 }],
    });
    const update = ops.find((o) => o.op === "update");
    expect(update?.values).toMatchObject({
      auto_action: "flagged",
      auto_action_reason: null,
      risk_score: 0.7,
      risk_labels: [{ category: "hate", score: 0.7 }],
    });
    expect(update?.values.scored_at).toBeDefined();
    expect(ops.find((o) => o.op === "insert")).toBeUndefined();
  });
});

describe("applyClear", () => {
  it("writes auto_action='cleared' and scored_at only", async () => {
    const { db, ops } = makeWriterDb();
    await applyClear(db as never, "msg-1");
    const update = ops.find((o) => o.op === "update");
    expect(update?.values).toMatchObject({ auto_action: "cleared" });
    expect(update?.values.scored_at).toBeDefined();
    expect(update?.values).not.toHaveProperty("moderation_status");
    expect(ops.find((o) => o.op === "insert")).toBeUndefined();
  });
});
