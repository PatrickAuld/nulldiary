import { getDb } from "@/lib/db";
import { listMessages } from "@/data/queries";
import { MessageList } from "@/components/MessageList";

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

      <form
        key={JSON.stringify(sp)}
        method="GET"
        action="/messages"
        className="filters"
      >
        <div>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </select>
        </div>
        <div>
          <label htmlFor="search">Search</label>
          <input
            id="search"
            name="search"
            type="text"
            defaultValue={search ?? ""}
            placeholder="Search content..."
          />
        </div>
        <div>
          <label htmlFor="after">After</label>
          <input
            id="after"
            name="after"
            type="date"
            defaultValue={sp.after ?? ""}
          />
        </div>
        <div>
          <label htmlFor="before">Before</label>
          <input
            id="before"
            name="before"
            type="date"
            defaultValue={sp.before ?? ""}
          />
        </div>
        <div>
          <button type="submit">Filter</button>
        </div>
      </form>

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
