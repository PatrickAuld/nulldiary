import { getCurrentFeaturedSetWithMessagesCached } from "@/data/queries";

export const revalidate = 600;

function secretSize(content: string): "large" | "medium" | "small" {
  if (content.length <= 80) return "large";
  if (content.length <= 200) return "medium";
  return "small";
}

export default async function HomePage() {
  let featured: Awaited<
    ReturnType<typeof getCurrentFeaturedSetWithMessagesCached>
  > = null;

  try {
    featured = await getCurrentFeaturedSetWithMessagesCached();
  } catch {
    // If env vars aren't configured in a build/test environment, fail closed.
    featured = null;
  }

  if (!featured || featured.messages.length === 0) {
    return (
      <div className="empty-state">
        <p>The void is listening&hellip;</p>
      </div>
    );
  }

  return (
    <>
      {featured.messages.map((msg) => (
        <a
          key={msg.id}
          href={`/messages/${msg.id}`}
          className="secret-item"
          data-size={secretSize(msg.edited_content ?? msg.content)}
        >
          <p className="secret-text">{msg.edited_content ?? msg.content}</p>
        </a>
      ))}
    </>
  );
}
