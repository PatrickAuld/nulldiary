import { getDb } from "@/lib/db";
import { getApprovedMessages } from "@/data/queries";

const PAGE_SIZE = 50;

function secretSize(content: string): "large" | "medium" | "small" {
  if (content.length <= 80) return "large";
  if (content.length <= 200) return "medium";
  return "small";
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
    <div className="page-content">
      <h1 className="page-heading">Archive</h1>
      <p className="page-description">
        All approved confessions. The curated selection is on the{" "}
        <a href="/">home page</a>.
      </p>

      {messages.length === 0 ? (
        <div className="empty-state">
          <p>Nothing here yet&hellip;</p>
        </div>
      ) : (
        messages.map((msg, i) => (
          <a
            key={msg.id}
            href={`/messages/${msg.id}`}
            className="secret-item"
            data-size={secretSize(msg.edited_content ?? msg.content)}
          >
            <p className="secret-text">{msg.edited_content ?? msg.content}</p>
            <div className="secret-meta">
              <span className="secret-number">
                No. {String(total - offset - i).padStart(3, "0")}
              </span>
              {msg.approved_at && <time>{formatDate(msg.approved_at)}</time>}
            </div>
          </a>
        ))
      )}

      {totalPages > 1 && (
        <nav className="pagination">
          {page > 1 && <a href={`?page=${page - 1}`}>&larr; Newer</a>}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages && <a href={`?page=${page + 1}`}>Older &rarr;</a>}
        </nav>
      )}
    </div>
  );
}
