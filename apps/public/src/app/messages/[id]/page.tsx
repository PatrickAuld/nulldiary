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

  const displayDate = message.approved_at
    ? new Date(message.approved_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <>
      <a href="/" className="detail-back">
        &larr; All confessions
      </a>

      <div className="detail-content">
        <article>
          <p className="detail-text">{message.content}</p>
          <div className="detail-meta">
            {displayDate && <time>{displayDate}</time>}
          </div>
        </article>
      </div>
    </>
  );
}
