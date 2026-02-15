import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApprovedMessageByShortIdCached } from "@/data/queries";
import { truncateForDescription } from "@/lib/og";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const message = await getApprovedMessageByShortIdCached(id);

  if (!message) {
    return { title: "Not found" };
  }

  const display = message.edited_content ?? message.content;
  const desc = truncateForDescription(display, 220);
  const canonical = `/m/${id}`;
  const image = `/og/m/${id}`;

  return {
    title: desc,
    description: desc,
    alternates: { canonical },
    openGraph: {
      title: desc,
      description: desc,
      url: canonical,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: desc }],
    },
    twitter: {
      card: "summary_large_image",
      title: desc,
      description: desc,
      images: [image],
    },
  };
}

export default async function ShortMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const message = await getApprovedMessageByShortIdCached(id);

  if (!message) {
    notFound();
  }

  const displayDate = message.approved_at
    ? new Date(message.approved_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <>
      <a href="/" className="detail-back">
        &larr; All confessions
      </a>

      <div className="detail-content">
        <article>
          <p className="detail-text">
            {message.edited_content ?? message.content}
          </p>
          <div className="detail-meta">
            {displayDate && <time>{displayDate}</time>}
          </div>
        </article>
      </div>
    </>
  );
}
