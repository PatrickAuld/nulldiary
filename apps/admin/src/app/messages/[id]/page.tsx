import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getMessageById, getIngestionEventsByMessageId } from "@/data/queries";
import { MessageDetail } from "@/components/MessageDetail";
import { ModerationForm } from "@/components/ModerationForm";

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

  const events = await getIngestionEventsByMessageId(db, id);

  return (
    <div>
      <h1>Message Detail</h1>
      <p>
        <a href="/messages">&larr; Back to list</a>
      </p>

      <MessageDetail message={message} events={events} />

      {message.moderation_status !== "denied" && (
        <ModerationForm
          messageId={message.id}
          defaultEditedContent={message.edited_content ?? message.content}
          canApprove={message.moderation_status === "pending"}
          canDeny
        />
      )}
    </div>
  );
}
