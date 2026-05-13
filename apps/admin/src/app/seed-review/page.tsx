import { getDb } from "@/lib/db";
import { getLatestPendingBatch, listPendingInBatch } from "@/data/seed-review";
import { SeedReviewClient } from "@/components/SeedReviewClient";

export const dynamic = "force-dynamic";

interface SearchParams {
  batch?: string;
}

export default async function SeedReviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const db = getDb();

  const batch = sp.batch || (await getLatestPendingBatch(db));

  if (!batch) {
    return (
      <div className="seed-review-empty">
        <h1>Seed review</h1>
        <p>
          No pending seeded messages found. When the seed harness runs and
          inserts pending messages with <code>metadata.seed.batch</code>, this
          page will surface them one at a time for fast triage.
        </p>
        <p>
          <a href="/messages">Back to messages</a>
        </p>
      </div>
    );
  }

  const messages = await listPendingInBatch(db, batch);

  return <SeedReviewClient batch={batch} initialMessages={messages} />;
}
