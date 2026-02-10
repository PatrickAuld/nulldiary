import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getApprovedMessageById } from "@/data/queries";

export const dynamic = "force-dynamic";

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const db = getDb();
  const message = await getApprovedMessageById(db, id);

  if (!message) {
    notFound();
  }

  const displayDate = message.approvedAt
    ? message.approvedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <>
      <nav style={{ marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        <a href="/">&larr; All messages</a>
      </nav>

      <article
        style={{
          padding: "1.5rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          background: "#fff",
        }}
      >
        <p
          style={{
            marginBottom: "1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: "1.125rem",
          }}
        >
          {message.content}
        </p>
        <footer style={{ fontSize: "0.875rem", color: "#6b7280" }}>
          {displayDate && <time>Approved {displayDate}</time>}
        </footer>
      </article>
    </>
  );
}
