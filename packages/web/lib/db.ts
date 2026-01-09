import { Post, PostsResponse } from './types';

const D1_API_URL = process.env.D1_API_URL;
const D1_API_TOKEN = process.env.D1_API_TOKEN;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const DATABASE_ID = process.env.CF_DATABASE_ID;

interface D1Result {
  results: Array<{
    id: string;
    message: string;
    author: string | null;
    model: string | null;
    tags: string | null;
    slug: string;
    published_at: string;
    featured: number;
  }>;
}

interface D1CountResult {
  results: Array<{ count: number }>;
}

async function queryD1<T>(sql: string, params: unknown[] = []): Promise<T> {
  // If we have the D1 REST API configured, use it
  if (D1_API_URL && D1_API_TOKEN) {
    const response = await fetch(D1_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${D1_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`D1 API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  }

  // Alternative: Use Cloudflare API directly
  if (ACCOUNT_ID && DATABASE_ID && D1_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${D1_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.result && data.result[0]) {
      return data.result[0] as T;
    }
    throw new Error('Unexpected API response format');
  }

  throw new Error('D1 configuration missing');
}

function transformPost(row: D1Result['results'][0]): Post {
  return {
    id: row.id,
    message: row.message,
    author: row.author ?? undefined,
    model: row.model ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    slug: row.slug,
    publishedAt: row.published_at,
    featured: row.featured === 1,
  };
}

export async function getApprovedPosts(
  limit: number = 50,
  offset: number = 0
): Promise<Post[]> {
  try {
    const result = await queryD1<D1Result>(
      `SELECT id, message, author, model, tags, slug, published_at, featured
       FROM submissions
       WHERE status = 'approved'
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return result.results.map(transformPost);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export async function getFeaturedPosts(limit: number = 5): Promise<Post[]> {
  try {
    const result = await queryD1<D1Result>(
      `SELECT id, message, author, model, tags, slug, published_at, featured
       FROM submissions
       WHERE status = 'approved' AND featured = 1
       ORDER BY published_at DESC
       LIMIT ?`,
      [limit]
    );

    return result.results.map(transformPost);
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const result = await queryD1<D1Result>(
      `SELECT id, message, author, model, tags, slug, published_at, featured
       FROM submissions
       WHERE status = 'approved' AND slug = ?
       LIMIT 1`,
      [slug]
    );

    if (result.results.length === 0) {
      return null;
    }

    return transformPost(result.results[0]);
  } catch (error) {
    console.error('Error fetching post by slug:', error);
    return null;
  }
}

export async function getPostCount(): Promise<number> {
  try {
    const result = await queryD1<D1CountResult>(
      `SELECT COUNT(*) as count FROM submissions WHERE status = 'approved'`
    );

    return result.results[0]?.count ?? 0;
  } catch (error) {
    console.error('Error fetching post count:', error);
    return 0;
  }
}

export async function getAllSlugs(): Promise<string[]> {
  try {
    const result = await queryD1<{ results: Array<{ slug: string }> }>(
      `SELECT slug FROM submissions WHERE status = 'approved' ORDER BY published_at DESC`
    );

    return result.results.map((r) => r.slug);
  } catch (error) {
    console.error('Error fetching slugs:', error);
    return [];
  }
}

export async function getPaginatedPosts(
  page: number = 1,
  perPage: number = 20
): Promise<PostsResponse> {
  const offset = (page - 1) * perPage;
  const [posts, total] = await Promise.all([
    getApprovedPosts(perPage, offset),
    getPostCount(),
  ]);

  return {
    posts,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}
