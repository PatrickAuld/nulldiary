import { getDb } from "@/lib/db";
import { listSystemDenied } from "@/data/queries";
import { SystemDeniedRow } from "@/components/SystemDeniedRow";

interface SearchParams {
  limit?: string;
  offset?: string;
}

export default async function SystemDeniedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const limit = Number(sp.limit ?? 50);
  const offset = Number(sp.offset ?? 0);

  const db = getDb();
  const { messages, total } = await listSystemDenied(db, { limit, offset });

  return (
    <main className="page">
      <h1>System-denied messages</h1>
      <p className="page__subtitle">
        {total} message{total === 1 ? "" : "s"} were auto-denied by the
        moderation funnel. Override only if you disagree with the decision.
      </p>

      {messages.length === 0 ? (
        <p>No system-denied messages.</p>
      ) : (
        <ul className="system-denied-list">
          {messages.map((msg) => (
            <SystemDeniedRow key={msg.id} message={msg} />
          ))}
        </ul>
      )}
    </main>
  );
}
