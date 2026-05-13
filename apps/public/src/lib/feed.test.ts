import { describe, it, expect } from "vitest";
import {
  escapeXml,
  buildFeedItemTitle,
  buildRssFeed,
  type FeedMessage,
} from "./feed.js";

function makeFeedMessage(overrides: Partial<FeedMessage> = {}): FeedMessage {
  return {
    id: "0190a000-0000-7000-8000-000000000001",
    short_id: "abc123",
    content: "Hello world",
    edited_content: null,
    approved_at: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("escapes ampersand, lt, gt, quote, apostrophe", () => {
    expect(escapeXml(`a & b < c > d "e" 'f'`)).toBe(
      "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;",
    );
  });

  it("does not double-encode an already-escaped ampersand", () => {
    // We escape input characters once. A literal '&' becomes '&amp;'.
    // We do not detect already-escaped entities; the input is treated as text.
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });

  it("returns empty string for empty input", () => {
    expect(escapeXml("")).toBe("");
  });
});

describe("buildFeedItemTitle", () => {
  it("returns content as-is when shorter than max", () => {
    expect(buildFeedItemTitle("short content", 60)).toBe("short content");
  });

  it("truncates and appends ellipsis at exact boundary", () => {
    const longContent = "a".repeat(80);
    const title = buildFeedItemTitle(longContent, 60);
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("collapses internal whitespace and newlines", () => {
    expect(buildFeedItemTitle("line one\n\nline   two", 60)).toBe(
      "line one line two",
    );
  });

  it("trims leading/trailing whitespace before measuring", () => {
    expect(buildFeedItemTitle("   spaced   ", 60)).toBe("spaced");
  });
});

describe("buildRssFeed", () => {
  const channel = {
    title: "Nulldiary",
    description: "Confessions from the machine.",
    siteUrl: "https://nulldiary.io",
    feedUrl: "https://nulldiary.io/feed.xml",
    language: "en",
  };

  it("includes the XML declaration and rss 2.0 root", () => {
    const xml = buildRssFeed({ channel, messages: [] });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("</rss>");
  });

  it("includes channel metadata", () => {
    const xml = buildRssFeed({ channel, messages: [] });
    expect(xml).toContain("<title>Nulldiary</title>");
    expect(xml).toContain(
      "<description>Confessions from the machine.</description>",
    );
    expect(xml).toContain("<link>https://nulldiary.io</link>");
    expect(xml).toContain("<language>en</language>");
  });

  it("emits one <item> per message, newest order preserved", () => {
    const messages = [
      makeFeedMessage({
        id: "id-1",
        short_id: "aaa",
        content: "first",
        approved_at: "2026-05-02T00:00:00.000Z",
      }),
      makeFeedMessage({
        id: "id-2",
        short_id: "bbb",
        content: "second",
        approved_at: "2026-05-01T00:00:00.000Z",
      }),
    ];
    const xml = buildRssFeed({ channel, messages });
    const items = xml.match(/<item>/g) ?? [];
    expect(items).toHaveLength(2);
    // Order: 'first' should appear before 'second'.
    expect(xml.indexOf("first")).toBeLessThan(xml.indexOf("second"));
  });

  it("uses message id as guid (isPermaLink=false) and short_id in the link", () => {
    const xml = buildRssFeed({
      channel,
      messages: [makeFeedMessage({ id: "the-uuid", short_id: "shorty" })],
    });
    expect(xml).toContain('<guid isPermaLink="false">the-uuid</guid>');
    expect(xml).toContain("<link>https://nulldiary.io/m/shorty</link>");
  });

  it("uses approved_at as pubDate in RFC 822", () => {
    const xml = buildRssFeed({
      channel,
      messages: [makeFeedMessage({ approved_at: "2026-05-01T12:00:00.000Z" })],
    });
    // Friday, 01 May 2026 12:00:00 GMT
    expect(xml).toContain("<pubDate>Fri, 01 May 2026 12:00:00 GMT</pubDate>");
  });

  it("HTML-escapes message content in description (single-encode)", () => {
    const xml = buildRssFeed({
      channel,
      messages: [
        makeFeedMessage({ content: "AT&T <script>alert(1)</script>" }),
      ],
    });
    expect(xml).toContain(
      "<description>AT&amp;T &lt;script&gt;alert(1)&lt;/script&gt;</description>",
    );
    // No double-encoding.
    expect(xml).not.toContain("&amp;amp;");
  });

  it("prefers edited_content over content when present", () => {
    const xml = buildRssFeed({
      channel,
      messages: [
        makeFeedMessage({ content: "raw", edited_content: "edited version" }),
      ],
    });
    expect(xml).toContain("<description>edited version</description>");
    expect(xml).not.toContain("<description>raw</description>");
  });

  it("title is the first 60 chars of content with ellipsis when long", () => {
    const long = "x".repeat(100);
    const xml = buildRssFeed({
      channel,
      messages: [makeFeedMessage({ content: long })],
    });
    // 59 'x' chars + ellipsis.
    expect(xml).toContain(`<title>${"x".repeat(59)}…</title>`);
  });

  it("falls back to message.id in link when short_id is missing", () => {
    const xml = buildRssFeed({
      channel,
      messages: [makeFeedMessage({ id: "fallback-id", short_id: null })],
    });
    // We only publish messages with short_ids in practice, but be defensive.
    expect(xml).toContain("<link>https://nulldiary.io/m/fallback-id</link>");
  });

  it("includes atom:link self reference for feed discovery", () => {
    const xml = buildRssFeed({ channel, messages: [] });
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain(
      '<atom:link href="https://nulldiary.io/feed.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  it("omits items with null approved_at defensively", () => {
    const xml = buildRssFeed({
      channel,
      messages: [
        makeFeedMessage({ id: "ok", approved_at: "2026-05-01T00:00:00.000Z" }),
        makeFeedMessage({ id: "missing-pub", approved_at: null }),
      ],
    });
    const items = xml.match(/<item>/g) ?? [];
    expect(items).toHaveLength(1);
    expect(xml).toContain("ok");
    expect(xml).not.toContain("missing-pub");
  });
});
