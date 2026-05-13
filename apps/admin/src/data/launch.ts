import type { Db, Message, IngestionEvent } from "@nulldiary/db";

export type Source = "real" | "seeded";

export function classifySource(message: {
  metadata: Record<string, unknown> | null;
}): Source {
  const meta = message.metadata;
  if (
    meta &&
    typeof meta === "object" &&
    "seed" in (meta as Record<string, unknown>)
  ) {
    return "seeded";
  }
  return "real";
}

export interface SubmissionBucket {
  real: number;
  seeded: number;
  total: number;
}

/**
 * Bucket messages into `numBuckets` equal-width time slices over the last
 * `windowMs` ending at `now`. Returns oldest → newest.
 */
export function bucketSubmissions(
  messages: Array<{
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>,
  now: Date,
  windowMs: number,
  numBuckets: number,
): SubmissionBucket[] {
  const buckets: SubmissionBucket[] = Array.from(
    { length: numBuckets },
    () => ({ real: 0, seeded: 0, total: 0 }),
  );
  const windowStart = now.getTime() - windowMs;
  const bucketWidth = windowMs / numBuckets;

  for (const m of messages) {
    const t = new Date(m.created_at).getTime();
    if (Number.isNaN(t)) continue;
    if (t < windowStart || t >= now.getTime()) continue;
    const idx = Math.min(
      numBuckets - 1,
      Math.floor((t - windowStart) / bucketWidth),
    );
    const source = classifySource(m);
    if (source === "seeded") buckets[idx].seeded += 1;
    else buckets[idx].real += 1;
    buckets[idx].total += 1;
  }
  return buckets;
}

/**
 * Trending arrow on approval rate. "up" if last 25 approval rate exceeds prior
 * 75 by >5 percentage points; "down" if reverse; "flat" otherwise. Requires
 * 100+ moderated messages to compute (otherwise "flat").
 */
export function trendingArrow(
  statuses: Array<"approved" | "denied" | string>,
): "up" | "down" | "flat" {
  if (statuses.length < 100) return "flat";
  const last25 = statuses.slice(-25);
  const prior75 = statuses.slice(-100, -25);
  const r = (xs: string[]) =>
    xs.filter((s) => s === "approved").length / xs.length;
  const lastRate = r(last25);
  const priorRate = r(prior75);
  const delta = lastRate - priorRate;
  if (delta > 0.05) return "up";
  if (delta < -0.05) return "down";
  return "flat";
}

/**
 * IPv4 → /24, IPv6 → /48. Anything we don't recognize comes back unchanged.
 * The dashboard shows this in lieu of full IPs to avoid splashing PII into
 * the UI for routine ops.
 */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    // IPv6: keep first 3 hextets (/48).
    const parts = ip.split(":");
    if (parts.length < 3) return ip;
    return `${parts.slice(0, 3).join(":")}::/48`;
  }
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return ip;
  return `${m[1]}.${m[2]}.${m[3]}.0/24`;
}

export function approvalRateOverLast(
  rows: Array<{ moderation_status: string }>,
): { rate: number | null; count: number } {
  const moderated = rows.filter(
    (r) =>
      r.moderation_status === "approved" || r.moderation_status === "denied",
  );
  if (moderated.length === 0) return { rate: null, count: 0 };
  const approved = moderated.filter(
    (r) => r.moderation_status === "approved",
  ).length;
  return { rate: approved / moderated.length, count: moderated.length };
}

/**
 * Heuristic from the spec: red if pending grew >10 in last hour while
 * approvals <5; amber if pending grew >10 but moderation kept up; otherwise
 * green.
 */
export function pendingHealth(input: {
  pending_now: number;
  pending_1h_ago: number;
  approved_in_last_1h: number;
}): "red" | "amber" | "green" {
  const growth = input.pending_now - input.pending_1h_ago;
  if (growth > 10 && input.approved_in_last_1h < 5) return "red";
  if (growth > 10) return "amber";
  return "green";
}

// ---------------------------------------------------------------------------
// DB-side helpers used by the dashboard. These intentionally match the style
// in digest.ts: thin wrappers, sequential awaits, no joins.
// ---------------------------------------------------------------------------

export async function listSubmissionsSince(
  db: Db,
  sinceIso: string,
): Promise<
  Array<{
    id: string;
    content: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    moderation_status: string;
  }>
> {
  const { data, error } = await db
    .from("messages")
    .select("id, content, created_at, metadata, moderation_status")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    content: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    moderation_status: string;
  }>;
}

export async function listRecentMessages(
  db: Db,
  limit: number,
): Promise<Message[]> {
  const { data, error } = await db
    .from("messages")
    .select("*")
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function fetchIngestionEventsForMessages(
  db: Db,
  messageIds: string[],
): Promise<IngestionEvent[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await db
    .from("ingestion_events")
    .select("*")
    .in("message_id", messageIds);
  if (error) throw error;
  return (data ?? []) as IngestionEvent[];
}

export async function fetchLastNModerated(
  db: Db,
  limit: number,
): Promise<
  Array<{
    moderation_status: string;
    approved_at: string | null;
    denied_at: string | null;
  }>
> {
  const { data, error } = await db
    .from("messages")
    .select("moderation_status, approved_at, denied_at")
    .in("moderation_status", ["approved", "denied"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    moderation_status: string;
    approved_at: string | null;
    denied_at: string | null;
  }>;
}

export async function countPending(db: Db): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function countCreatedSince(
  db: Db,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function countApprovedSince(
  db: Db,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .gte("approved_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

export async function countCreatedInWindow(
  db: Db,
  startIso: string,
  endIso: string,
): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (error) throw error;
  return count ?? 0;
}
