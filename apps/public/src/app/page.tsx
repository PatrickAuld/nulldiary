import { getDb } from "@/lib/db";
import { getApprovedMessages } from "@/data/queries";

const PAGE_SIZE = 50;

function secretSize(content: string): "large" | "medium" | "small" {
  if (content.length <= 80) return "large";
  if (content.length <= 200) return "medium";
  return "small";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function HomePage({
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

  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <p>The void is listening&hellip;</p>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, i) => (
        <a
          key={msg.id}
          href={`/messages/${msg.id}`}
          className="secret-item"
          data-size={secretSize(msg.content)}
        >
          <p className="secret-text">{msg.content}</p>
          <div className="secret-meta">
            <span className="secret-number">
              No. {String(total - offset - i).padStart(3, "0")}
            </span>
            {msg.approvedAt && <time>{formatDate(msg.approvedAt)}</time>}
          </div>
        </a>
      ))}

      {totalPages > 1 && (
        <nav className="pagination">
          {page > 1 && <a href={`?page=${page - 1}`}>&larr; Newer</a>}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages && <a href={`?page=${page + 1}`}>Older &rarr;</a>}
        </nav>
      )}
    </>
  );
}
