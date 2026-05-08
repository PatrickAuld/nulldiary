import { getDb } from "@/lib/db";
import { listMessages } from "@/data/queries";
import type { AutoActionFilter } from "@/data/types";
import { MessageList } from "@/components/MessageList";
import { MessagesFilters } from "@/components/MessagesFilters";
import { listFeaturedMemberships, listFeaturedSets } from "@/data/featured";

interface SearchParams {
  status?: string;
  search?: string;
  after?: string;
  before?: string;
  limit?: string;
  offset?: string;
  autoAction?: string;
}

const VALID_AUTO_ACTIONS: AutoActionFilter[] = [
  "denied",
  "flagged",
  "cleared",
  "any-auto",
  "human-only",
];

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
  const autoAction = VALID_AUTO_ACTIONS.includes(
    sp.autoAction as AutoActionFilter,
  )
    ? (sp.autoAction as AutoActionFilter)
    : undefined;

  const db = getDb();

  const { messages, total } = await listMessages(db, {
    status,
    search,
    after,
    before,
    limit,
    offset,
    autoAction,
  });

  const featuredSets = await listFeaturedSets(db);
  const memberships = await listFeaturedMemberships(
    db,
    messages.map((m) => m.id),
  );

  const featuredMemberships: Record<string, string[]> = {};
  for (const row of memberships) {
    featuredMemberships[row.message_id] ??= [];
    featuredMemberships[row.message_id].push(row.set_id);
  }

  return (
    <div>
      <h1>Messages</h1>

      <MessagesFilters
        status={status}
        search={search ?? ""}
        after={sp.after ?? ""}
        before={sp.before ?? ""}
        autoAction={
          (autoAction as
            | ""
            | "any-auto"
            | "flagged"
            | "denied"
            | "human-only") ?? ""
        }
      />

      <p className="count-text">
        Showing {messages.length} of {total} messages
        {offset > 0 && ` (offset ${offset})`}
      </p>

      <MessageList
        messages={messages}
        featuredSets={featuredSets}
        featuredMemberships={featuredMemberships}
      />

      {total > offset + limit && (
        <p className="pagination">
          <a
            href={`/messages?status=${status}&offset=${offset + limit}&limit=${limit}${search ? `&search=${search}` : ""}${autoAction ? `&autoAction=${autoAction}` : ""}`}
          >
            Next page
          </a>
        </p>
      )}
    </div>
  );
}
