import { notFound } from "next/navigation";
import { getApprovedMessageByShortIdCached } from "@/data/queries";

export const revalidate = 600;

export default async function ShortMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const message = await getApprovedMessageByShortIdCached(id);

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
          <p className="detail-text">
            {message.edited_content ?? message.content}
          </p>
          <div className="detail-meta">
            {displayDate && <time>{displayDate}</time>}
          </div>
        </article>
      </div>
    </>
  );
}
