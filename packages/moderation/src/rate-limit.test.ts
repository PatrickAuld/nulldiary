import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit.js";

type Bucket = { source_ip: string; bucket_at: string; count: number };

type FakeOp =
  | { kind: "select"; ip: string; from: string; to: string }
  | { kind: "upsert"; ip: string; bucketAt: string };

function makeFakeDb(initial: Bucket[] = []) {
  const rows = [...initial];
  const ops: FakeOp[] = [];

  const db = {
    from: (table: string) => {
      if (table !== "ingestion_rate_buckets") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        select: () => {
          let ipFilter: string | null = null;
          let gteFilter: string | null = null;
          let ltFilter: string | null = null;
          const builder = {
            eq(col: string, val: string) {
              if (col === "source_ip") ipFilter = val;
              return builder;
            },
            gte(col: string, val: string) {
              if (col === "bucket_at") gteFilter = val;
              return builder;
            },
            lt(col: string, val: string) {
              if (col === "bucket_at") ltFilter = val;
              return builder;
            },
            then(resolve: (v: { data: Bucket[]; error: null }) => unknown) {
              ops.push({
                kind: "select",
                ip: ipFilter ?? "",
                from: gteFilter ?? "",
                to: ltFilter ?? "",
              });
              const data = rows.filter(
                (r) =>
                  (ipFilter === null || r.source_ip === ipFilter) &&
                  (gteFilter === null || r.bucket_at >= gteFilter) &&
                  (ltFilter === null || r.bucket_at < ltFilter),
              );
              return Promise.resolve({ data, error: null }).then(resolve);
            },
          };
          return builder;
        },
        upsert: (values: {
          source_ip: string;
          bucket_at: string;
          count: number;
        }) => {
          ops.push({
            kind: "upsert",
            ip: values.source_ip,
            bucketAt: values.bucket_at,
          });
          const existing = rows.find(
            (r) =>
              r.source_ip === values.source_ip &&
              r.bucket_at === values.bucket_at,
          );
          if (existing) {
            existing.count = values.count;
          } else {
            rows.push({ ...values });
          }
          return Promise.resolve({ error: null });
        },
        rpc: undefined,
      };
    },
    rpc: (
      name: string,
      args: { p_ip: string; p_bucket_at: string; p_inc: number },
    ) => {
      if (name !== "ingestion_rate_bucket_increment") {
        throw new Error(`unexpected rpc: ${name}`);
      }
      ops.push({ kind: "upsert", ip: args.p_ip, bucketAt: args.p_bucket_at });
      const existing = rows.find(
        (r) => r.source_ip === args.p_ip && r.bucket_at === args.p_bucket_at,
      );
      if (existing) {
        existing.count += args.p_inc;
      } else {
        rows.push({
          source_ip: args.p_ip,
          bucket_at: args.p_bucket_at,
          count: args.p_inc,
        });
      }
      return Promise.resolve({ error: null });
    },
  };

  return { db, ops, rows };
}

const T0 = new Date("2026-01-01T00:00:10.000Z");
const fixedClock = () => T0;

describe("checkRateLimit", () => {
  it("derives bucket_at and resetAt deterministically from the injected clock", async () => {
    const fixed = new Date("2026-03-15T10:11:12.345Z");
    const { db, ops } = makeFakeDb();

    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: () => fixed,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    const expectedBucket = new Date("2026-03-15T10:11:12.000Z");
    const expectedReset = new Date(expectedBucket.getTime() + 1_000);

    expect(result.resetAt.toISOString()).toBe(expectedReset.toISOString());
    const upsert = ops.find((o) => o.kind === "upsert");
    expect(upsert?.bucketAt).toBe(expectedBucket.toISOString());
  });

  it("increments the current bucket only when allowed", async () => {
    const allowed = makeFakeDb();
    await checkRateLimit({
      ip: "1.2.3.4",
      db: allowed.db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });
    const allowedUpserts = allowed.ops.filter((o) => o.kind === "upsert");
    expect(allowedUpserts).toHaveLength(1);
    expect(allowedUpserts[0]).toMatchObject({ ip: "1.2.3.4" });
    const bucketRow = allowed.rows.find((r) => r.source_ip === "1.2.3.4");
    expect(bucketRow?.count).toBe(1);

    const denied = makeFakeDb([
      { source_ip: "1.2.3.4", bucket_at: T0.toISOString(), count: 10 },
    ]);
    await checkRateLimit({
      ip: "1.2.3.4",
      db: denied.db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });
    const deniedUpserts = denied.ops.filter((o) => o.kind === "upsert");
    expect(deniedUpserts).toHaveLength(0);
    const deniedRow = denied.rows.find((r) => r.source_ip === "1.2.3.4");
    expect(deniedRow?.count).toBe(10);
  });

  it("does not share counters across IPs", async () => {
    const { db } = makeFakeDb([
      { source_ip: "9.9.9.9", bucket_at: T0.toISOString(), count: 100 },
    ]);
    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("ignores buckets older than the window", async () => {
    const beforeWindow = new Date(T0.getTime() - 10_001).toISOString();
    const { db } = makeFakeDb([
      { source_ip: "1.2.3.4", bucket_at: beforeWindow, count: 100 },
    ]);
    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("denies once total counts in the window equal the limit", async () => {
    const { db } = makeFakeDb([
      { source_ip: "1.2.3.4", bucket_at: T0.toISOString(), count: 10 },
    ]);
    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("allows the call when prior counts equal limit-1 (boundary)", async () => {
    const { db } = makeFakeDb([
      { source_ip: "1.2.3.4", bucket_at: T0.toISOString(), count: 9 },
    ]);
    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("allows the first call when there are no prior buckets", async () => {
    const { db } = makeFakeDb();
    const result = await checkRateLimit({
      ip: "1.2.3.4",
      db: db as never,
      clock: fixedClock,
      limit: 10,
      windowMs: 10_000,
      bucketMs: 1_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeInstanceOf(Date);
  });
});
