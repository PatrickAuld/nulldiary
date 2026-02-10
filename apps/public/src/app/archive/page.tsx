import { getDb } from "@/lib/db";
import { getApprovedMessages } from "@/data/queries";
import { SiteHeader } from "@/components/SiteHeader";

const PAGE_SIZE = 50;

export const dynamic = "force-dynamic";

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();
  const { messages, total } = await getApprovedMessages(db, {
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <SiteHeader />
      <div className="container">
        <p className="small">
          Archive of approved messages. Curated selection is on the{" "}
          <a href="/">gallery</a>.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m) => (
            <article
              key={m.id}
              style={{
                border: "1px solid var(--hairline)",
                borderRadius: 14,
                padding: 16,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              <div className="meta">
                <span className="pill">anonymous</span>
                <a href={`/messages/${m.id}`}>open</a>
              </div>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <nav
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
              marginTop: 24,
              fontSize: 14,
              color: "var(--muted)",
            }}
          >
            {page > 1 && <a href={`?page=${page - 1}`}>Previous</a>}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && <a href={`?page=${page + 1}`}>Next</a>}
          </nav>
        )}
      </div>
    </>
  );
}
