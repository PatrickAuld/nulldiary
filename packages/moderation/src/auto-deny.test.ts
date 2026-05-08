import { describe, it, expect } from "vitest";
import { findDupeByContentHash } from "./auto-deny.js";

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
