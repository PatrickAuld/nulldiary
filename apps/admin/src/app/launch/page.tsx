import { getDb } from "@/lib/db";
import {
  bucketSubmissions,
  classifySource,
  approvalRateOverLast,
  trendingArrow,
  truncateIp,
  pendingHealth,
  listSubmissionsSince,
  listRecentMessages,
  fetchIngestionEventsForMessages,
  fetchLastNModerated,
  countPending,
  countApprovedSince,
  countCreatedInWindow,
} from "@/data/launch";
import { fetchTopReferrers } from "@/data/page-views";
import {
  fetchHnSignal,
  fetchRedditSignal,
  fetchBlueskySignal,
  fetchMastodonSignal,
} from "@/data/external-signals";
import { Sparkline } from "@/components/Sparkline";
import { LaunchInline } from "@/components/LaunchInline";

export const dynamic = "force-dynamic";
// Auto-refresh every 60s. Next.js' segment-level revalidate is the simplest
// path; we render fully on each request and rely on the meta refresh to poll.
export const revalidate = 0;

function relativeTime(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  const ms = nowMs - t;
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function formatPct(p: number | null): string {
  if (p == null) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

export default async function LaunchDashboardPage() {
  const db = getDb();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3_600_000);
  const twentyFourHoursAgo = new Date(now.getTime() - 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  // Submissions feed for sparklines (24h window, 24 hourly buckets).
  const submissions24h = await listSubmissionsSince(
    db,
    twentyFourHoursAgo.toISOString(),
  );
  const buckets24h = bucketSubmissions(submissions24h, now, 86_400_000, 24);

  // Submissions feed for 7d sparkline (7 daily buckets).
  const submissions7d = await listSubmissionsSince(
    db,
    sevenDaysAgo.toISOString(),
  );
  const buckets7d = bucketSubmissions(submissions7d, now, 7 * 86_400_000, 7);

  // 1h sparkline: 12 buckets of 5 minutes.
  const buckets1h = bucketSubmissions(submissions24h, now, 3_600_000, 12);

  // Last-7-days baseline: median of daily totals (excluding today).
  const dailyTotals: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const end = new Date(now.getTime() - (i - 1) * 86_400_000);
    const start = new Date(end.getTime() - 86_400_000);
    dailyTotals.push(
      submissions7d.filter((m) => {
        const t = new Date(m.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      }).length,
    );
  }
  const sortedDaily = [...dailyTotals].sort((a, b) => a - b);
  const baselineMedian = sortedDaily[Math.floor(sortedDaily.length / 2)] ?? 0;
  const baselinePerHour = baselineMedian / 24;

  // Pending queue depth + health.
  const pendingNow = await countPending(db);
  const pendingCreatedInLastHour = await countCreatedInWindow(
    db,
    oneHourAgo.toISOString(),
    now.toISOString(),
  );
  const approvedInLastHour = await countApprovedSince(
    db,
    oneHourAgo.toISOString(),
  );
  // Heuristic for "pending 1h ago" without a snapshot table: pending now -
  // (created in last 1h) + (moderated in last 1h). We only have approvals
  // here; ignore denials for simplicity (denials also drain pending).
  const pending1hAgo =
    pendingNow - pendingCreatedInLastHour + approvedInLastHour;
  const pendingDelta = pendingNow - pending1hAgo;
  const health = pendingHealth({
    pending_now: pendingNow,
    pending_1h_ago: pending1hAgo,
    approved_in_last_1h: approvedInLastHour,
  });

  // Approval rate over the last 100 moderated.
  const last100 = await fetchLastNModerated(db, 100);
  // Statuses oldest-first for trending.
  const statusesOldestFirst = [...last100]
    .reverse()
    .map((r) => r.moderation_status);
  const approval = approvalRateOverLast(last100);
  const arrow = trendingArrow(statusesOldestFirst);

  // Top referrers.
  const [referrers1h, referrers24h] = await Promise.all([
    fetchTopReferrers(db, oneHourAgo.toISOString(), 5).catch(() => []),
    fetchTopReferrers(db, twentyFourHoursAgo.toISOString(), 5).catch(() => []),
  ]);

  // Recent submissions: last 10 pending. Pull ingestion events for IPs.
  const recent = await listRecentMessages(db, 10);
  const events = await fetchIngestionEventsForMessages(
    db,
    recent.map((m) => m.id),
  );
  const ipByMessage = new Map<string, string | null>();
  for (const m of recent) {
    const ev = events.find((e) => e.message_id === m.id);
    ipByMessage.set(m.id, ev?.source_ip ?? null);
  }

  // External signals.
  const hnId = process.env.HN_SUBMISSION_ID ?? "";
  const redditPermalink = process.env.REDDIT_POST_PERMALINK ?? "";
  const mastodonInstance = process.env.MASTODON_INSTANCE ?? "";
  const [hn, reddit, bsky, masto] = await Promise.all([
    fetchHnSignal(hnId),
    fetchRedditSignal(redditPermalink),
    fetchBlueskySignal("nulldiary.io"),
    mastodonInstance
      ? fetchMastodonSignal({
          instance: mastodonInstance,
          query: "nulldiary.io",
        })
      : Promise.resolve({ ok: false } as Awaited<
          ReturnType<typeof fetchMastodonSignal>
        >),
  ]);

  const nowMs = now.getTime();

  return (
    <div className="launch">
      <head>
        <meta httpEquiv="refresh" content="60" />
      </head>

      <header className="launch__header">
        <h1>launch</h1>
        <span className="launch__updated">
          updated {now.toISOString().slice(11, 19)}Z · auto-refresh 60s
        </span>
      </header>

      <section className="launch__grid">
        <div className="launch__card">
          <h2>submissions</h2>
          <div className="launch__sparks">
            <div>
              <span className="launch__small">last hour</span>
              <Sparkline
                label="last hour, 5-minute buckets"
                series={[
                  {
                    values: buckets1h.map((b) => b.real),
                    color: "var(--green)",
                  },
                  {
                    values: buckets1h.map((b) => b.seeded),
                    color: "var(--blue)",
                  },
                ]}
                baseline={baselinePerHour / 12}
              />
              <span className="launch__small">
                {buckets1h.reduce((a, b) => a + b.total, 0)} total
              </span>
            </div>
            <div>
              <span className="launch__small">last 24h</span>
              <Sparkline
                label="last 24 hours, hourly buckets"
                series={[
                  {
                    values: buckets24h.map((b) => b.real),
                    color: "var(--green)",
                  },
                  {
                    values: buckets24h.map((b) => b.seeded),
                    color: "var(--blue)",
                  },
                ]}
                baseline={baselinePerHour}
              />
              <span className="launch__small">
                {buckets24h.reduce((a, b) => a + b.total, 0)} total
                {" · "}
                baseline ~{baselinePerHour.toFixed(1)}/h
              </span>
            </div>
            <div>
              <span className="launch__small">last 7d</span>
              <Sparkline
                label="last 7 days, daily buckets"
                series={[
                  {
                    values: buckets7d.map((b) => b.real),
                    color: "var(--green)",
                  },
                  {
                    values: buckets7d.map((b) => b.seeded),
                    color: "var(--blue)",
                  },
                ]}
                baseline={baselineMedian}
              />
              <span className="launch__small">
                {buckets7d.reduce((a, b) => a + b.total, 0)} total · baseline
                median {baselineMedian}
              </span>
            </div>
          </div>
          <div className="launch__legend">
            <span>
              <i style={{ background: "var(--green)" }} /> real
            </span>
            <span>
              <i style={{ background: "var(--blue)" }} /> seeded
            </span>
            <span>
              <i className="dashed" /> baseline (median last 7d)
            </span>
          </div>
        </div>

        <div className="launch__card">
          <h2>pending queue</h2>
          <div className={`launch__big launch__big--${health}`}>
            {pendingNow}
          </div>
          <div className="launch__small">
            Δ {pendingDelta >= 0 ? "+" : ""}
            {pendingDelta} vs 1h ago · approved in last 1h: {approvedInLastHour}
          </div>
          <div className="launch__small">
            health:{" "}
            <strong className={`launch__pill launch__pill--${health}`}>
              {health}
            </strong>
          </div>
        </div>

        <div className="launch__card">
          <h2>approval rate</h2>
          <div className="launch__big">
            {formatPct(approval.rate)}{" "}
            <span aria-label={`trend ${arrow}`}>
              {arrow === "up" ? "↑" : arrow === "down" ? "↓" : "→"}
            </span>
          </div>
          <div className="launch__small">last {approval.count} moderated</div>
        </div>

        <div className="launch__card launch__card--wide">
          <h2>top referrers</h2>
          <div className="launch__refs">
            <div>
              <h3>last 1h</h3>
              <RefList rows={referrers1h} />
            </div>
            <div>
              <h3>last 24h</h3>
              <RefList rows={referrers24h} />
            </div>
          </div>
        </div>

        <div className="launch__card launch__card--wide">
          <h2>recent submissions</h2>
          <ul className="launch__recent">
            {recent.length === 0 && (
              <li className="launch__small">no pending messages</li>
            )}
            {recent.map((m) => {
              const ip = truncateIp(ipByMessage.get(m.id) ?? null);
              const preview = (m.content ?? "").slice(0, 80);
              const source = classifySource(m);
              return (
                <li key={m.id} className="launch__recent-row">
                  <div className="launch__recent-meta">
                    <span
                      className={`launch__pill launch__pill--${source === "seeded" ? "amber" : "green"}`}
                    >
                      {source}
                    </span>
                    <span className="launch__small">
                      {relativeTime(m.created_at, nowMs)}
                    </span>
                    <span className="launch__small">{ip ?? "—"}</span>
                  </div>
                  <div className="launch__recent-preview">{preview}</div>
                  <LaunchInline messageId={m.id} />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="launch__card launch__card--wide">
          <h2>external signals</h2>
          <div className="launch__signals">
            <SignalCard label="HN">
              {hn.ok ? (
                <>
                  <div className="launch__big-sm">{hn.score} pts</div>
                  <div className="launch__small">
                    {hn.comments} comments · id {hn.id}
                  </div>
                  <div className="launch__small">
                    <a
                      href={`https://news.ycombinator.com/item?id=${hn.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open thread
                    </a>
                  </div>
                </>
              ) : hnId ? (
                <span className="launch__small">n/a</span>
              ) : (
                <span className="launch__small">set HN_SUBMISSION_ID</span>
              )}
            </SignalCard>

            <SignalCard label="Reddit">
              {reddit.ok ? (
                <>
                  <div className="launch__big-sm">{reddit.score} pts</div>
                  <div className="launch__small">
                    {reddit.comments} comments
                  </div>
                  <div className="launch__small">
                    <a
                      href={`https://www.reddit.com${reddit.permalink}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open post
                    </a>
                  </div>
                </>
              ) : redditPermalink ? (
                <span className="launch__small">n/a</span>
              ) : (
                <span className="launch__small">set REDDIT_POST_PERMALINK</span>
              )}
            </SignalCard>

            <SignalCard label="Bluesky">
              {bsky.ok ? (
                <>
                  <div className="launch__big-sm">{bsky.count}</div>
                  <div className="launch__small">
                    mentions of nulldiary.io (last batch)
                  </div>
                  <ul className="launch__signal-recent">
                    {bsky.recent.map((p, i) => (
                      <li key={i} className="launch__small">
                        @{p.handle}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span className="launch__small">n/a</span>
              )}
            </SignalCard>

            <SignalCard label="Mastodon">
              {masto.ok ? (
                <>
                  <div className="launch__big-sm">{masto.count}</div>
                  <div className="launch__small">
                    mentions on {masto.instance}
                  </div>
                  <ul className="launch__signal-recent">
                    {masto.recent.map((p, i) => (
                      <li key={i} className="launch__small">
                        {p.acct}
                      </li>
                    ))}
                  </ul>
                </>
              ) : mastodonInstance ? (
                <span className="launch__small">n/a</span>
              ) : (
                <span className="launch__small">set MASTODON_INSTANCE</span>
              )}
            </SignalCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function RefList({
  rows,
}: {
  rows: Array<{ host: string; path: string; count: number; percent: number }>;
}) {
  if (rows.length === 0) {
    return <p className="launch__small">no referrer data</p>;
  }
  return (
    <ol className="launch__ref-list">
      {rows.map((r) => (
        <li key={`${r.host}${r.path}`}>
          <a
            href={`/messages?host=${encodeURIComponent(r.host)}`}
            title="filter messages by host (host filter is informational; the messages list ignores unknown query params)"
          >
            {r.host}
            <span className="launch__small">{r.path}</span>
          </a>
          <span className="launch__ref-count">
            {r.count} · {(r.percent * 100).toFixed(1)}%
          </span>
        </li>
      ))}
    </ol>
  );
}

function SignalCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="launch__signal">
      <h3>{label}</h3>
      {children}
    </div>
  );
}
