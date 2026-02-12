import { notFound } from "next/navigation";
import { uuidv7 } from "uuidv7";
import { getDb } from "@/lib/db";

export default async function FeaturedSetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const { data: set, error: setError } = await db
    .from("featured_sets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (setError) throw setError;
  if (!set) notFound();

  const { data: rows, error: rowsError } = await db
    .from("featured_set_messages")
    .select(
      "id, position, message:messages(id, content, edited_content, approved_at)",
    )
    .eq("set_id", id)
    .order("position", { ascending: true });

  if (rowsError) throw rowsError;

  async function addMessage(formData: FormData) {
    "use server";

    const messageId = String(formData.get("message_id") ?? "").trim();
    const position = Number(formData.get("position") ?? 0);

    if (!messageId) throw new Error("message_id is required");

    const db = getDb();

    const { error } = await db.from("featured_set_messages").insert({
      id: uuidv7(),
      set_id: id,
      message_id: messageId,
      position: Number.isFinite(position) ? position : 0,
    });

    if (error) throw error;
  }

  async function removeMessage(formData: FormData) {
    "use server";

    const rowId = String(formData.get("row_id") ?? "").trim();
    if (!rowId) throw new Error("row_id is required");

    const db = getDb();
    const { error } = await db
      .from("featured_set_messages")
      .delete()
      .eq("id", rowId)
      .eq("set_id", id);

    if (error) throw error;
  }

  async function updateSet(formData: FormData) {
    "use server";

    const title = String(formData.get("title") ?? "").trim() || null;
    const startsAt = String(formData.get("starts_at") ?? "").trim();
    const endsAt = String(formData.get("ends_at") ?? "").trim();

    const patch: Record<string, unknown> = {
      title,
      updated_at: new Date().toISOString(),
    };

    if (startsAt) patch.starts_at = new Date(startsAt).toISOString();
    if (endsAt) patch.ends_at = new Date(endsAt).toISOString();

    const db = getDb();
    const { error } = await db.from("featured_sets").update(patch).eq("id", id);

    if (error) throw error;
  }

  return (
    <div>
      <h1>Featured set</h1>
      <p>
        <a href="/featured">&larr; Back</a>
      </p>

      <div className="detail-section">
        <h2>Details</h2>
        <p>
          <strong>Slug:</strong> <code>{set.slug}</code>
        </p>

        <form action={updateSet}>
          <div className="filters">
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" defaultValue={set.title ?? ""} />
            </div>
            <div>
              <label htmlFor="starts_at">Starts (UTC)</label>
              <input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={new Date(set.starts_at)
                  .toISOString()
                  .slice(0, 16)}
              />
            </div>
            <div>
              <label htmlFor="ends_at">Ends (UTC)</label>
              <input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                defaultValue={new Date(set.ends_at).toISOString().slice(0, 16)}
              />
            </div>
            <div>
              <button type="submit">Update</button>
            </div>
          </div>
        </form>
      </div>

      <div className="detail-section">
        <h2>Add message</h2>
        <form action={addMessage}>
          <div className="filters">
            <div>
              <label htmlFor="message_id">Message ID</label>
              <input id="message_id" name="message_id" required />
            </div>
            <div>
              <label htmlFor="position">Position</label>
              <input
                id="position"
                name="position"
                type="number"
                defaultValue={0}
              />
            </div>
            <div>
              <button type="submit">Add</button>
            </div>
          </div>
        </form>
      </div>

      <div className="detail-section">
        <h2>Messages ({(rows ?? []).length})</h2>
        {(!rows || rows.length === 0) && <p>No messages in this set yet.</p>}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.position}</td>
                  <td>
                    <a href={`/messages/${(r as any).message?.id}`}>
                      {(r as any).message?.edited_content ??
                        (r as any).message?.content ??
                        "(missing)"}
                    </a>
                  </td>
                  <td>
                    <form action={removeMessage}>
                      <input type="hidden" name="row_id" value={r.id} />
                      <button type="submit">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
