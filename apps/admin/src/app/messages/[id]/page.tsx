import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getMessageById, getIngestionEventsByMessageId } from "@/data/queries";
import { MessageDetail } from "@/components/MessageDetail";
import { ModerationForm } from "@/components/ModerationForm";
import { listFeaturedMemberships, listFeaturedSets } from "@/data/featured";
import { FeaturedSetsPicker } from "@/components/FeaturedSetsPicker";

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

  const featuredSets = await listFeaturedSets(db);
  const memberships = await listFeaturedMemberships(db, [id]);
  const selectedSetIds = memberships.map((m) => m.set_id);

  return (
    <div>
      <h1>Message Detail</h1>
      <p>
        <a href="/messages">&larr; Back to list</a>
      </p>

      <MessageDetail message={message} events={events} />

      {message.moderation_status === "approved" && (
        <div className="detail-section">
          <h2>Featured sets</h2>
          <FeaturedSetsPicker
            messageId={message.id}
            sets={featuredSets}
            selectedSetIds={selectedSetIds}
          />
        </div>
      )}

      {message.moderation_status !== "denied" && (
        <ModerationForm
          messageId={message.id}
          defaultEditedContent={
            message.edited_content && message.edited_content.trim().length > 0
              ? message.edited_content
              : message.content
          }
          canApprove={message.moderation_status === "pending"}
          canDeny
        />
      )}
    </div>
  );
}
