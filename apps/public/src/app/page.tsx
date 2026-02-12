import {
  getApprovedMessagesCached,
  getCurrentFeaturedSetWithMessagesCached,
} from "@/data/queries";

export const revalidate = 600;

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const featured = await getCurrentFeaturedSetWithMessagesCached();

  // If we have an active featured set, show it first.
  if (featured && featured.messages.length > 0) {
    return (
      <>
        <div className="page-content">
          <h1 className="page-heading">
            {featured.set.title ?? "Today\'s featured"}
          </h1>
          <p className="page-description">
            Curated selections that roll over automatically.
          </p>
        </div>

        {featured.messages.map((msg) => (
          <a
            key={msg.id}
            href={`/messages/${msg.id}`}
            className="secret-item"
            data-size={secretSize(msg.edited_content ?? msg.content)}
          >
            <p className="secret-text">{msg.edited_content ?? msg.content}</p>
          </a>
        ))}

        <div className="page-content" style={{ marginTop: "2rem" }}>
          <h2 className="page-heading" style={{ fontSize: "1.1rem" }}>
            Archive
          </h2>
          <p className="page-description">
            <a href="/archive">Browse all approved confessions</a>
          </p>
        </div>
      </>
    );
  }

  const { messages, total } = await getApprovedMessagesCached({
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
