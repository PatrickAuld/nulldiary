import { getDb } from "@/lib/db";
import { listMessages } from "@/data/queries";
import { MessageList } from "@/components/MessageList";
import { MessagesFilters } from "@/components/MessagesFilters";

interface SearchParams {
  status?: string;
  search?: string;
  after?: string;
  before?: string;
  limit?: string;
  offset?: string;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = (sp.status ?? "pending") as "pending" | "approved" | "denied";
  const search = sp.search || undefined;
  const after = sp.after ? new Date(sp.after) : undefined;
  const before = sp.before ? new Date(sp.before) : undefined;
  const limit = Number(sp.limit ?? 50);
  const offset = Number(sp.offset ?? 0);

  const { messages, total } = await listMessages(getDb(), {
    status,
    search,
    after,
    before,
    limit,
    offset,
  });

  return (
    <div>
      <h1>Messages</h1>

      <MessagesFilters
        status={status}
        search={search ?? ""}
        after={sp.after ?? ""}
        before={sp.before ?? ""}
      />

      <p>
        Showing {messages.length} of {total} messages
        {offset > 0 && ` (offset ${offset})`}
      </p>

      <MessageList messages={messages} />

      {total > offset + limit && (
        <p style={{ marginTop: "1rem" }}>
          <a
            href={`/messages?status=${status}&offset=${offset + limit}&limit=${limit}${search ? `&search=${search}` : ""}`}
          >
            Next page
          </a>
        </p>
      )}
    </div>
  );
}
