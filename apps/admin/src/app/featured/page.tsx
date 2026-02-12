import { getDb } from "@/lib/db";
import { uuidv7 } from "uuidv7";

export default async function FeaturedSetsPage() {
  const db = getDb();

  const { data: sets, error } = await db
    .from("featured_sets")
    .select("*")
    .order("starts_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  async function createSet(formData: FormData) {
    "use server";

    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim() || null;
    const startsAt = String(formData.get("starts_at") ?? "").trim();
    const endsAt = String(formData.get("ends_at") ?? "").trim();

    if (!slug) throw new Error("slug is required");
    if (!startsAt) throw new Error("starts_at is required");
    if (!endsAt) throw new Error("ends_at is required");

    const db = getDb();
    const { error } = await db.from("featured_sets").insert({
      id: uuidv7(),
      slug,
      title,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    });

    if (error) throw error;
  }

  return (
    <div>
      <h1>Featured sets</h1>

      <p>
        Featured sets are time-windowed collections. The public home page shows
        the set whose <code>starts_at</code> / <code>ends_at</code> contains
        “now”.
      </p>

      <h2>Create a set</h2>
      <form action={createSet}>
        <div className="filters">
          <div>
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              name="slug"
              placeholder="todays-featured"
              required
            />
          </div>
          <div>
            <label htmlFor="title">Title (optional)</label>
            <input id="title" name="title" placeholder="Today’s featured" />
          </div>
          <div>
            <label htmlFor="starts_at">Starts (UTC)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" />
          </div>
          <div>
            <label htmlFor="ends_at">Ends (UTC)</label>
            <input id="ends_at" name="ends_at" type="datetime-local" />
          </div>
          <div>
            <button type="submit">Create</button>
          </div>
        </div>
      </form>

      <h2>Existing sets</h2>
      {(!sets || sets.length === 0) && <p>No featured sets yet.</p>}
      {sets && sets.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title</th>
              <th>Starts</th>
              <th>Ends</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id}>
                <td>
                  <code>{s.slug}</code>
                </td>
                <td>{s.title ?? ""}</td>
                <td>{new Date(s.starts_at).toISOString()}</td>
                <td>{new Date(s.ends_at).toISOString()}</td>
                <td>
                  <a href={`/featured/${s.id}`}>Edit</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
