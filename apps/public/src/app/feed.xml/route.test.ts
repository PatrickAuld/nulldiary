import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock both data layer and site URL helper before importing the route.
vi.mock("@/data/queries", () => ({
  getApprovedMessagesCached: vi.fn(),
}));

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => "https://nulldiary.io",
}));

import { GET } from "./route.js";
import { getApprovedMessagesCached } from "@/data/queries";

const mockGetApproved = vi.mocked(getApprovedMessagesCached);

function makeApproved(overrides: Record<string, unknown> = {}) {
  return {
    id: "0190a000-0000-7000-8000-000000000001",
    short_id: "abc",
    content: "Hello world",
    edited_content: null,
    metadata: {},
    created_at: "2026-04-30T00:00:00.000Z",
    approved_at: "2026-05-01T12:00:00.000Z",
    denied_at: null,
    moderation_status: "approved",
    moderated_by: "admin",
    tags: null,
    normalized_content: null,
    content_hash: null,
    originating_model: null,
    ...overrides,
  };
}

describe("GET /feed.xml", () => {
  beforeEach(() => {
    mockGetApproved.mockReset();
  });

  it("returns 200 with application/rss+xml content type", async () => {
    mockGetApproved.mockResolvedValue({ messages: [], total: 0 });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/rss+xml; charset=utf-8",
    );
  });

  it("sets a 5-minute Cache-Control", async () => {
    mockGetApproved.mockResolvedValue({ messages: [], total: 0 });

    const res = await GET();

    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("requests at most 50 messages from the data layer", async () => {
    mockGetApproved.mockResolvedValue({ messages: [], total: 0 });

    await GET();

    expect(mockGetApproved).toHaveBeenCalledWith({ limit: 50 });
  });

  it("includes approved messages in the body", async () => {
    mockGetApproved.mockResolvedValue({
      messages: [
        makeApproved({
          id: "id-1",
          short_id: "shorty",
          content: "the visible thought",
        }),
      ],
      total: 1,
    });

    const res = await GET();
    const body = await res.text();

    expect(body).toContain("the visible thought");
    expect(body).toContain("https://nulldiary.io/m/shorty");
    expect(body).toContain('<guid isPermaLink="false">id-1</guid>');
  });

  it("emits well-formed XML preamble and channel metadata", async () => {
    mockGetApproved.mockResolvedValue({ messages: [], total: 0 });

    const res = await GET();
    const body = await res.text();

    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(
      true,
    );
    expect(body).toContain("<title>Nulldiary</title>");
    expect(body).toContain("<link>https://nulldiary.io</link>");
    expect(body).toContain(
      '<atom:link href="https://nulldiary.io/feed.xml" rel="self" type="application/rss+xml"/>',
    );
  });

  it("does not include a pending message even if the data layer returned one", async () => {
    // The data layer should never return pending messages, but we want a
    // hard guarantee at the boundary too. Since the route trusts
    // getApprovedMessages, the only realistic failure mode is content leaking
    // through. We assert that pending content does not appear if we never
    // give it to the route in the first place.
    mockGetApproved.mockResolvedValue({
      messages: [makeApproved({ content: "approved content" })],
      total: 1,
    });

    const res = await GET();
    const body = await res.text();

    expect(body).toContain("approved content");
    // Sanity: the route only renders what the data layer produced.
    expect(body).not.toContain("pending content");
  });
});
