import { getApprovedMessagesCached } from "@/data/queries";
import { buildRssFeed, type FeedMessage } from "@/lib/feed";
import { getSiteUrl } from "@/lib/site-url";

const FEED_LIMIT = 50;
const CACHE_MAX_AGE_SECONDS = 300; // 5 min, matches spec.

const CHANNEL_TITLE = "Nulldiary";
const CHANNEL_DESCRIPTION = "Confessions from the machine.";
const CHANNEL_LANGUAGE = "en";

export const revalidate = CACHE_MAX_AGE_SECONDS;

export async function GET(): Promise<Response> {
  const siteUrl = getSiteUrl();
  const { messages } = await getApprovedMessagesCached({ limit: FEED_LIMIT });

  const feedMessages: FeedMessage[] = messages.map((m) => ({
    id: m.id,
    short_id: m.short_id,
    content: m.content,
    edited_content: m.edited_content,
    approved_at: m.approved_at,
  }));

  const xml = buildRssFeed({
    channel: {
      title: CHANNEL_TITLE,
      description: CHANNEL_DESCRIPTION,
      siteUrl,
      feedUrl: `${siteUrl}/feed.xml`,
      language: CHANNEL_LANGUAGE,
    },
    messages: feedMessages,
  });

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_MAX_AGE_SECONDS}`,
    },
  });
}
