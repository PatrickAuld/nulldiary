/**
 * RSS 2.0 feed building. Pure functions; no IO.
 *
 * Why hand-rolled instead of a library: RSS 2.0 is small enough that the
 * library surface (parsers, builders, plugins) is heavier than the spec we
 * need. Three element types, manual XML escaping, RFC 822 dates. Done.
 */

export interface FeedMessage {
  id: string;
  short_id: string | null;
  content: string;
  edited_content: string | null;
  approved_at: string | null;
}

export interface FeedChannel {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  language: string;
}

const XML_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&/g, "&amp;"],
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/"/g, "&quot;"],
  [/'/g, "&apos;"],
];

/**
 * Escape an arbitrary string for safe inclusion in XML element text or
 * attribute values. Treats input as plain text — does not detect existing
 * entities. Callers must pass raw, un-escaped content.
 */
export function escapeXml(input: string): string {
  let s = input;
  for (const [pattern, replacement] of XML_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

/**
 * Build the <title> for an item: first `max` chars of normalized content,
 * with an ellipsis if truncated. Whitespace-collapsed and trimmed first.
 */
export function buildFeedItemTitle(content: string, max: number): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * RFC 822 date format ("Fri, 01 May 2026 12:00:00 GMT"). Required by RSS 2.0.
 */
function formatRfc822(iso: string): string {
  const d = new Date(iso);
  const day = DAYS[d.getUTCDay()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTHS[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${day}, ${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss} GMT`;
}

const TITLE_MAX_CHARS = 60;

function buildItem(message: FeedMessage, siteUrl: string): string {
  const body = message.edited_content ?? message.content;
  const title = buildFeedItemTitle(body, TITLE_MAX_CHARS);
  const slug = message.short_id ?? message.id;
  const link = `${siteUrl}/m/${slug}`;
  // Spec says approved_at is the pubDate; we filter null upstream.
  const pubDate = formatRfc822(message.approved_at as string);

  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">${escapeXml(message.id)}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description>${escapeXml(body)}</description>`,
    "    </item>",
  ].join("\n");
}

export function buildRssFeed(input: {
  channel: FeedChannel;
  messages: FeedMessage[];
}): string {
  const { channel } = input;
  const items = input.messages
    .filter((m) => m.approved_at !== null)
    .map((m) => buildItem(m, channel.siteUrl));

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.siteUrl)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language)}</language>`,
    `    <atom:link href="${escapeXml(channel.feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
  ];

  return lines.join("\n");
}
