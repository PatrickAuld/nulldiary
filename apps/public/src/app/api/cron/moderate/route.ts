import {
  classifyToxicity,
  detectPii,
  decide,
  applyAutoDeny,
  applyFlag,
  applyClear,
} from "@nulldiary/moderation";
import type { Db } from "@nulldiary/db";
import { getDb } from "@/lib/db";

const BATCH_SIZE = 50;
const CONCURRENCY = 4;
const ACTOR = "system:auto-mod@v1";

type PendingRow = { id: string; content: string };

type Stats = {
  processed: number;
  denied: number;
  flagged: number;
  cleared: number;
  skipped: number;
};

export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 },
    );
  }

  const db = getDb();
  const rows = await fetchPending(db);

  const stats: Stats = {
    processed: 0,
    denied: 0,
    flagged: 0,
    cleared: 0,
    skipped: 0,
  };

  await runWithConcurrency(rows, CONCURRENCY, async (row) => {
    stats.processed += 1;
    // Fail-open per message: a flake on any single row (toxicity API
    // outage, transient DB write error) must not poison the rest of
    // the batch. The next cron tick re-scans because scored_at stays
    // null until an applier writes it.
    try {
      const scores = await classifyToxicity(row.content, { apiKey });
      const piiHits = detectPii(row.content);
      const decision = decide(scores, piiHits);

      if (decision.action === "deny") {
        await applyAutoDeny(db, {
          messageId: row.id,
          reason: decision.reason,
          actor: ACTOR,
        });
        stats.denied += 1;
      } else if (decision.action === "flag") {
        await applyFlag(db, {
          messageId: row.id,
          riskScore: decision.riskScore,
          labels: decision.labels,
        });
        stats.flagged += 1;
      } else {
        await applyClear(db, row.id);
        stats.cleared += 1;
      }
    } catch {
      stats.skipped += 1;
    }
  });

  return Response.json(stats);
}

async function fetchPending(db: Db): Promise<PendingRow[]> {
  const { data, error } = (await db
    .from("messages")
    .select("id, content")
    .eq("moderation_status", "pending")
    .is("scored_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)) as { data: PendingRow[] | null; error: unknown };

  if (error) throw error;
  return data ?? [];
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
}
