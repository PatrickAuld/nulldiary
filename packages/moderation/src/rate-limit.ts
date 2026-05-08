import type { Db } from "@nulldiary/db";
import {
  RATE_LIMIT_BUCKET_MS_DEFAULT,
  RATE_LIMIT_DEFAULT,
  RATE_LIMIT_WINDOW_MS_DEFAULT,
} from "./thresholds.js";

export type RateLimitInput = {
  ip: string;
  db: Db;
  clock?: () => Date;
  limit?: number;
  windowMs?: number;
  bucketMs?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type BucketRow = { count: number };

export async function checkRateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  const limit = input.limit ?? RATE_LIMIT_DEFAULT;
  const windowMs = input.windowMs ?? RATE_LIMIT_WINDOW_MS_DEFAULT;
  const bucketMs = input.bucketMs ?? RATE_LIMIT_BUCKET_MS_DEFAULT;
  const now = (input.clock ?? (() => new Date()))();

  const bucketAt = new Date(Math.floor(now.getTime() / bucketMs) * bucketMs);
  const windowStart = new Date(now.getTime() - windowMs);
  const windowEnd = new Date(bucketAt.getTime() + bucketMs);

  const { data, error } = (await input.db
    .from("ingestion_rate_buckets")
    .select("count")
    .eq("source_ip", input.ip)
    .gte("bucket_at", windowStart.toISOString())
    .lt("bucket_at", windowEnd.toISOString())) as {
    data: BucketRow[] | null;
    error: unknown;
  };

  if (error) throw error;

  const used = (data ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0);
  const allowed = used + 1 <= limit;

  if (allowed) {
    const { error: incError } = await input.db.rpc(
      "ingestion_rate_bucket_increment",
      {
        p_ip: input.ip,
        p_bucket_at: bucketAt.toISOString(),
        p_inc: 1,
      },
    );
    if (incError) throw incError;
  }

  return {
    allowed,
    remaining: Math.max(0, limit - used - 1),
    resetAt: windowEnd,
  };
}
