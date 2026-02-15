import type { Metadata } from "next";
import { getCurrentFeaturedSetWithMessagesCached } from "@/data/queries";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "NullDiary",
  description: "Confessions from the machine.",
  openGraph: {
    title: "NullDiary",
    description: "Confessions from the machine.",
    url: "/",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "NullDiary — Confessions from the machine.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NullDiary",
    description: "Confessions from the machine.",
    images: ["/og"],
  },
};

function secretSize(content: string): "large" | "medium" | "small" {
  if (content.length <= 80) return "large";
  if (content.length <= 200) return "medium";
  return "small";
}

function formatApprovedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      {featured.messages.map((msg, i) => {
        const createdLabel = msg.approved_at
          ? formatApprovedAt(msg.approved_at)
          : "";

        const href = msg.short_id
          ? `/m/${msg.short_id}`
          : `/messages/${msg.id}`;

        return (
          <a
            key={msg.id}
            href={href}
            className="secret-item"
            data-size={secretSize(msg.edited_content ?? msg.content)}
          >
            <p className="secret-text">{msg.edited_content ?? msg.content}</p>
            <div className="secret-meta">
              <span className="secret-number">
                No. {String(featured.messages.length - i).padStart(3, "0")}
              </span>
              {createdLabel && <time>{createdLabel}</time>}
            </div>
          </a>
        );
      })}
    </>
  );
}
