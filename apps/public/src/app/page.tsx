import { getDb } from "@/lib/db";
import { getFeaturedMessages } from "@/data/queries";
import { SiteHeader } from "@/components/SiteHeader";
import { Poster } from "@/components/Poster";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = getDb();
  const featured = await getFeaturedMessages(db, { limit: 18 });

  return (
    <>
      <a id="top" />
      <SiteHeader />

      {featured.length === 0 ? (
        <div className="container">
          <p className="small">
            No featured messages yet. Add tag <code>featured</code> to approved
            messages to populate the gallery.
          </p>
          <p className="small">
            You can still browse the <a href="/archive">archive</a>.
          </p>
        </div>
      ) : (
        <main className="gallery">
          {featured.map((m) => (
            <Poster
              key={m.id}
              id={m.id}
              content={m.content}
              approvedAt={m.approvedAt ?? null}
            />
          ))}
        </main>
      )}
    </>
  );
}
