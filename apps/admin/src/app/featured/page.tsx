import { getDb } from "@/lib/db";
import { uuidv7 } from "uuidv7";

export const dynamic = "force-dynamic";

export default async function FeaturedSetsPage() {
  const db = getDb();

  const { data: sets, error } = await db
    .from("featured_sets")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  async function createSet(formData: FormData) {
    "use server";

    const slug = String(formData.get("slug") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim() || null;
    if (!slug) throw new Error("slug is required");

    const db = getDb();
    const { error } = await db.from("featured_sets").insert({
      id: uuidv7(),
      slug,
      title,
      pinned: false,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  }

  return (
    <div>
      <h1>Featured sets</h1>

      <p>
        Featured sets are named collections. One set can be pinned at a time;
        the public home page shows the pinned set.
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
          {/* Pinning replaces temporal windows. */}
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
              <th>Pinned</th>
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
                <td>{s.pinned ? "yes" : ""}</td>
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
