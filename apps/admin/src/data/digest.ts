import type { Db } from "@nulldiary/db";
import { fetchTopReferrers, type RefererBucket } from "./page-views.js";

export interface SubmissionBreakdown {
  total: number;
  real: number;
  seeded: number;
  suspected_bot: number;
}

export interface DailyDigest {
  generated_at: string;
  window_start: string;
  window_end: string;
  pending_count: number;
  submissions: SubmissionBreakdown;
  approval_rate: number | null;
  approved_yesterday: number;
  denied_yesterday: number;
  cumulative_approved: number;
  anomalies: string[];
  baseline_median_last_7d: number;
  top_referrers: RefererBucket[];
}

interface MessageRow {
  id: string;
  metadata: Record<string, unknown> | null;
  content_hash: string | null;
  created_at: string;
  approved_at: string | null;
  denied_at: string | null;
  moderation_status: string;
}

/**
 * Count pending messages (any source).
 */
export async function countPending(db: Db): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "pending");

  if (error) throw error;
  return count ?? 0;
}

/**
 * Count cumulative approved messages (publicly visible).
 */
export async function countCumulativeApproved(db: Db): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved");

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch every message that arrived in [windowStart, windowEnd).
 * Used for breakdown + suspected-bot detection.
 */
export async function listMessagesInWindow(
  db: Db,
  windowStartIso: string,
  windowEndIso: string,
): Promise<MessageRow[]> {
  const { data, error } = await db
    .from("messages")
    .select(
      "id, metadata, content_hash, created_at, approved_at, denied_at, moderation_status",
    )
    .gte("created_at", windowStartIso)
    .lt("created_at", windowEndIso)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

/**
 * For a list of content hashes, return the set of hashes that appear two or
 * more times across messages received in the same window. Used to mark
 * "suspected_bot" submissions: duplicate content_hash within the 24h window.
 *
 * The check is done in-memory from the same window list, so this helper is
 * pure — it doesn't need the DB.
 */
export function detectSuspectedBotHashes(
  rows: Array<{ content_hash: string | null }>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.content_hash) continue;
    counts.set(row.content_hash, (counts.get(row.content_hash) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [hash, n] of counts) {
    if (n >= 2) dupes.add(hash);
  }
  return dupes;
}

/**
 * Classify each message in the window. A message is:
 * - `seeded` if metadata.seed is present (regardless of content_hash dupes)
 * - `suspected_bot` if its content_hash appears twice or more in the window
 *   AND it is not seeded
 * - `real` otherwise
 *
 * Returns the breakdown counts.
 */
export function breakdownSubmissions(rows: MessageRow[]): SubmissionBreakdown {
  const dupeHashes = detectSuspectedBotHashes(rows);
  let real = 0;
  let seeded = 0;
  let suspected_bot = 0;
  for (const row of rows) {
    const isSeeded =
      !!row.metadata &&
      typeof row.metadata === "object" &&
      "seed" in (row.metadata as Record<string, unknown>);
    if (isSeeded) {
      seeded++;
      continue;
    }
    if (row.content_hash && dupeHashes.has(row.content_hash)) {
      suspected_bot++;
      continue;
    }
    real++;
  }
  return { total: rows.length, real, seeded, suspected_bot };
}

/**
 * Approval rate over a window: approved / (approved + denied) for messages
 * that were *moderated* in the window. Returns null when neither approved nor
 * denied moderation happened (no signal).
 */
export async function approvalRateInWindow(
  db: Db,
  windowStartIso: string,
  windowEndIso: string,
): Promise<{ approved: number; denied: number; rate: number | null }> {
  const { count: approved, error: aErr } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .gte("approved_at", windowStartIso)
    .lt("approved_at", windowEndIso);

  if (aErr) throw aErr;

  const { count: denied, error: dErr } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "denied")
    .gte("denied_at", windowStartIso)
    .lt("denied_at", windowEndIso);

  if (dErr) throw dErr;

  const a = approved ?? 0;
  const d = denied ?? 0;
  const total = a + d;
  return {
    approved: a,
    denied: d,
    rate: total === 0 ? null : a / total,
  };
}

/**
 * Median submissions/day across the last N days (excluding the most recent
 * "yesterday" window). Used as the baseline for spike detection.
 */
export async function dailySubmissionBaseline(
  db: Db,
  endIso: string,
  days: number = 7,
): Promise<number> {
  const end = new Date(endIso);
  const buckets: number[] = [];
  for (let i = 1; i <= days; i++) {
    const bucketEnd = new Date(end.getTime() - (i - 1) * 86_400_000);
    const bucketStart = new Date(bucketEnd.getTime() - 86_400_000);
    const { count, error } = await db
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", bucketStart.toISOString())
      .lt("created_at", bucketEnd.toISOString());
    if (error) throw error;
    buckets.push(count ?? 0);
  }
  buckets.sort((a, b) => a - b);
  const mid = Math.floor(buckets.length / 2);
  return buckets.length % 2 === 0
    ? (buckets[mid - 1] + buckets[mid]) / 2
    : buckets[mid];
}

/**
 * Inspect submissions, baseline, approval rate, and the time of the most
 * recent submission. Returns human-readable anomaly flags suitable for the
 * digest body.
 */
export function detectAnomalies(input: {
  yesterday_total: number;
  baseline_median: number;
  approval_rate: number | null;
  most_recent_submission_iso: string | null;
  now_iso: string;
}): string[] {
  const flags: string[] = [];
  const { yesterday_total, baseline_median, approval_rate } = input;

  if (baseline_median > 0 && yesterday_total > 3 * baseline_median) {
    flags.push(
      `submission spike: ${yesterday_total} vs. baseline median ${baseline_median.toFixed(1)} (>3x)`,
    );
  }

  if (approval_rate !== null && approval_rate < 0.05) {
    flags.push(
      `approval rate ${(approval_rate * 100).toFixed(1)}% < 5% (suggests garbage in queue)`,
    );
  }

  if (input.most_recent_submission_iso) {
    const lastMs = new Date(input.most_recent_submission_iso).getTime();
    const nowMs = new Date(input.now_iso).getTime();
    if (nowMs - lastMs > 12 * 3_600_000) {
      const hours = Math.floor((nowMs - lastMs) / 3_600_000);
      flags.push(`no submissions in ${hours}h (system may be down)`);
    }
  } else {
    // No submissions in the window AND no most-recent timestamp at all is
    // surfaced too — but the no-submissions-in-window case is implicit.
    // Don't double-flag if baseline is also zero (brand-new install).
    if (baseline_median > 0) {
      flags.push("no submissions in the digest window (system may be down)");
    }
  }

  return flags;
}

/**
 * Build the full digest. `now` is injected so tests are deterministic.
 *
 * The "yesterday" window is the 24h ending at the start of today (UTC).
 * That keeps the daily digest aligned to UTC day boundaries regardless of
 * cron firing time.
 */
export async function buildDailyDigest(
  db: Db,
  now: Date = new Date(),
): Promise<DailyDigest> {
  const startOfToday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);

  const windowStart = startOfYesterday.toISOString();
  const windowEnd = startOfToday.toISOString();

  // Sequential to keep order deterministic for tests and to avoid hammering
  // the connection pool with parallel count queries.
  const pending_count = await countPending(db);
  const cumulative_approved = await countCumulativeApproved(db);
  const rows = await listMessagesInWindow(db, windowStart, windowEnd);
  const approvalStats = await approvalRateInWindow(db, windowStart, windowEnd);
  const baseline_median = await dailySubmissionBaseline(db, windowStart, 7);
  let top_referrers: RefererBucket[] = [];
  try {
    top_referrers = await fetchTopReferrers(db, windowStart, 5);
  } catch {
    // page_views table may not exist on older DBs; degrade gracefully.
    top_referrers = [];
  }

  const submissions = breakdownSubmissions(rows);
  const mostRecent = rows.length > 0 ? rows[rows.length - 1].created_at : null;

  const anomalies = detectAnomalies({
    yesterday_total: submissions.total,
    baseline_median,
    approval_rate: approvalStats.rate,
    most_recent_submission_iso: mostRecent,
    now_iso: now.toISOString(),
  });

  return {
    generated_at: now.toISOString(),
    window_start: windowStart,
    window_end: windowEnd,
    pending_count,
    submissions,
    approval_rate: approvalStats.rate,
    approved_yesterday: approvalStats.approved,
    denied_yesterday: approvalStats.denied,
    cumulative_approved,
    anomalies,
    baseline_median_last_7d: baseline_median,
    top_referrers,
  };
}

/**
 * Render the digest as plaintext + HTML email-friendly bodies. The plaintext
 * body is also what we return in the cron response for debugging.
 */
export function renderDigestText(
  digest: DailyDigest,
  options: { admin_url: string; mode: "daily" | "weekly" } = {
    admin_url: "https://admin.nulldiary.io",
    mode: "daily",
  },
): { subject: string; text: string; html: string } {
  const dateLabel = digest.window_start.slice(0, 10);
  const subject =
    options.mode === "weekly"
      ? `nulldiary weekly digest — week of ${dateLabel}`
      : `nulldiary daily digest — ${dateLabel}`;

  const ratePct =
    digest.approval_rate === null
      ? "—"
      : `${(digest.approval_rate * 100).toFixed(1)}%`;

  const lines = [
    `nulldiary digest — ${dateLabel}`,
    "",
    `pending: ${digest.pending_count} (${options.admin_url}/messages)`,
    "",
    "submissions in window:",
    `  total:         ${digest.submissions.total}`,
    `  real:          ${digest.submissions.real}`,
    `  seeded:        ${digest.submissions.seeded}`,
    `  suspected_bot: ${digest.submissions.suspected_bot}`,
    "",
    `approval rate: ${ratePct}  (${digest.approved_yesterday} approved / ${digest.denied_yesterday} denied)`,
    `cumulative approved on public site: ${digest.cumulative_approved}`,
    "",
    `baseline median submissions/day (last 7d): ${digest.baseline_median_last_7d.toFixed(1)}`,
  ];

  if (digest.anomalies.length > 0) {
    lines.push("", "ANOMALIES:");
    for (const a of digest.anomalies) lines.push(`  - ${a}`);
  } else {
    lines.push("", "no anomalies");
  }

  if (digest.top_referrers.length > 0) {
    lines.push("", "top referrers (last 24h):");
    for (const r of digest.top_referrers) {
      const pct = (r.percent * 100).toFixed(1);
      lines.push(
        `  ${r.count.toString().padStart(4)}  ${pct.padStart(5)}%  ${r.host}${r.path}`,
      );
    }
  } else {
    lines.push("", "top referrers (last 24h): (none recorded)");
  }

  const text = lines.join("\n");
  const html = `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
