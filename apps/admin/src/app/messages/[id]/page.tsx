import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getMessageById, getIngestionEventsByMessageId } from "@/data/queries";
import { MessageDetail } from "@/components/MessageDetail";
import { ModerationForm } from "@/components/ModerationForm";
import { TagsForm } from "@/components/TagsForm";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const message = await getMessageById(db, id);

  if (!message) {
    notFound();
  }

  let events = [];
  try {
    events = await getIngestionEventsByMessageId(db, id);
  } catch {
    // Avoid hard 500s if ingestion events query fails in production.
    events = [];
  }

  return (
    <div>
      <h1>Message Detail</h1>
      <p>
        <a href="/messages">&larr; Back to list</a>
      </p>

      <MessageDetail message={message} events={events} />

      <TagsForm messageId={message.id} initialTags={message.tags ?? []} />

      {message.moderationStatus === "pending" && (
        <ModerationForm messageId={message.id} />
      )}
    </div>
  );
}
