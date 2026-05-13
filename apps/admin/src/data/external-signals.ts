/**
 * Per-process in-memory cache for external API responses. The launch dashboard
 * polls every 60s and we don't want to hammer HN/Reddit/Bluesky once per page
 * load — so wrap each call in `withCache(key, ttl, fn)`.
 *
 * No Redis. Per-process is fine: the only reader is the launch dashboard,
 * which is not horizontally scaled in any meaningful sense for one operator.
 */

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function __resetCacheForTests(): void {
  cache.clear();
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fn();
  cache.set(key, { expiresAt: now + ttlMs, value });
  return value;
}

const TTL = 60_000;

// ---------------------------------------------------------------------------
// HN
// ---------------------------------------------------------------------------

export type HnResult =
  | { ok: false }
  | {
      ok: true;
      id: string;
      score: number;
      comments: number;
      title: string;
      url: string | null;
    };

export async function fetchHnSignal(id: string): Promise<HnResult> {
  if (!id) return { ok: false };
  return withCache(`hn:${id}`, TTL, async () => {
    try {
      const res = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${encodeURIComponent(id)}.json`,
      );
      if (!res.ok) return { ok: false } as HnResult;
      const body = (await res.json()) as {
        id?: number;
        score?: number;
        descendants?: number;
        title?: string;
        url?: string;
      };
      return {
        ok: true,
        id,
        score: body.score ?? 0,
        comments: body.descendants ?? 0,
        title: body.title ?? "",
        url: body.url ?? null,
      } as HnResult;
    } catch {
      return { ok: false } as HnResult;
    }
  });
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

export type RedditResult =
  | { ok: false }
  | {
      ok: true;
      score: number;
      comments: number;
      title: string;
      permalink: string;
    };

export async function fetchRedditSignal(
  permalink: string,
): Promise<RedditResult> {
  if (!permalink) return { ok: false };
  return withCache(`reddit:${permalink}`, TTL, async () => {
    try {
      // Reddit's public JSON: append `.json` to any permalink.
      const url = permalink.startsWith("http")
        ? `${permalink.replace(/\/?$/, "")}.json`
        : `https://www.reddit.com${permalink.replace(/\/?$/, "")}.json`;
      const res = await fetch(url, {
        headers: { "User-Agent": "nulldiary-launch-dashboard/1.0" },
      });
      if (!res.ok) return { ok: false } as RedditResult;
      const body = (await res.json()) as Array<{
        data?: { children?: Array<{ data?: Record<string, unknown> }> };
      }>;
      const post = body?.[0]?.data?.children?.[0]?.data as
        | {
            score?: number;
            num_comments?: number;
            title?: string;
            permalink?: string;
          }
        | undefined;
      if (!post) return { ok: false } as RedditResult;
      return {
        ok: true,
        score: post.score ?? 0,
        comments: post.num_comments ?? 0,
        title: post.title ?? "",
        permalink: post.permalink ?? permalink,
      } as RedditResult;
    } catch {
      return { ok: false } as RedditResult;
    }
  });
}

// ---------------------------------------------------------------------------
// Bluesky public search
// ---------------------------------------------------------------------------

export type BlueskyResult =
  | { ok: false }
  | {
      ok: true;
      count: number;
      recent: Array<{ handle: string; text: string }>;
    };

export async function fetchBlueskySignal(
  query: string,
): Promise<BlueskyResult> {
  if (!query) return { ok: false };
  return withCache(`bsky:${query}`, TTL, async () => {
    try {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=10`;
      const res = await fetch(url);
      if (!res.ok) return { ok: false } as BlueskyResult;
      const body = (await res.json()) as {
        posts?: Array<{
          author?: { handle?: string };
          record?: { text?: string };
        }>;
      };
      const posts = body.posts ?? [];
      return {
        ok: true,
        count: posts.length,
        recent: posts.slice(0, 5).map((p) => ({
          handle: p.author?.handle ?? "",
          text: p.record?.text ?? "",
        })),
      } as BlueskyResult;
    } catch {
      return { ok: false } as BlueskyResult;
    }
  });
}

// ---------------------------------------------------------------------------
// Mastodon (instance search). Falls back to a "set up manually" notice if no
// instance is configured.
// ---------------------------------------------------------------------------

export type MastodonResult =
  | { ok: false }
  | {
      ok: true;
      instance: string;
      count: number;
      recent: Array<{ acct: string }>;
    };

export async function fetchMastodonSignal(input: {
  instance: string;
  query: string;
}): Promise<MastodonResult> {
  if (!input.instance || !input.query) return { ok: false };
  return withCache(
    `mastodon:${input.instance}:${input.query}`,
    TTL,
    async () => {
      try {
        const url = `https://${input.instance}/api/v2/search?q=${encodeURIComponent(input.query)}&type=statuses&resolve=false`;
        const res = await fetch(url);
        if (!res.ok) return { ok: false } as MastodonResult;
        const body = (await res.json()) as {
          statuses?: Array<{ account?: { acct?: string } }>;
        };
        const statuses = body.statuses ?? [];
        return {
          ok: true,
          instance: input.instance,
          count: statuses.length,
          recent: statuses
            .slice(0, 5)
            .map((s) => ({ acct: s.account?.acct ?? "" })),
        } as MastodonResult;
      } catch {
        return { ok: false } as MastodonResult;
      }
    },
  );
}
