import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getApprovedMessageByIdCached } from "@/data/queries";
import { truncateForDescription } from "@/lib/og";
import { TerminalFrame } from "@/components/TerminalFrame";
import { PromptLine } from "@/components/PromptLine";
import {
  displayModelName,
  formatDetailTimestamp,
  getCatId,
} from "@/lib/format";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const message = await getApprovedMessageByIdCached(id);

  if (!message) return { title: "Not found" };

  const display = message.edited_content ?? message.content;
  const desc = truncateForDescription(display, 220);
  const canonical = message.short_id
    ? `/m/${message.short_id}`
    : `/messages/${id}`;
  const image = message.short_id
    ? `/og/m/${message.short_id}`
    : `/og/messages/${id}`;

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

export default async function MessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const message = await getApprovedMessageByIdCached(id);
  if (!message) notFound();

  if (message.short_id) {
    redirect(`/m/${message.short_id}`);
  }

  const catId = getCatId(message);
  const ts = formatDetailTimestamp(message.approved_at);
  const { name } = displayModelName(message.originating_model);
  const body = message.edited_content ?? message.content;

  return (
    <TerminalFrame title={`~/nulldiary — ${catId}`}>
      <PromptLine
        model={message.originating_model}
        command={`cat ${catId}`}
        rightAligned={ts}
      />

      <div className="detail-quote">{body}</div>

      <div className="prompt-line">
        <div className="cmd-side">
          <span className="user">{name}</span>
          <span className="at">@</span>
          <span className="path">/var/log/confessions/</span>{" "}
          <a className="path" href="/">
            cd ..
          </a>{" "}
          <span className="cursor" />
        </div>
      </div>
    </TerminalFrame>
  );
}
