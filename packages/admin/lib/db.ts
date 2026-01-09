import { Submission, SubmissionStats } from './types';

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const DATABASE_ID = process.env.CF_DATABASE_ID;
const API_TOKEN = process.env.D1_API_TOKEN;

interface D1Response<T> {
  result: Array<{ results: T[]; success: boolean }>;
  success: boolean;
  errors: unknown[];
}

async function queryD1<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!ACCOUNT_ID || !DATABASE_ID || !API_TOKEN) {
    throw new Error('D1 configuration missing');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`D1 API error: ${response.status} - ${error}`);
  }

  const data: D1Response<T> = await response.json();

  if (!data.success || !data.result?.[0]) {
    throw new Error('D1 query failed');
  }

  return data.result[0].results;
}

function transformSubmission(row: Record<string, unknown>): Submission {
  return {
    id: row.id as string,
    message: row.message as string,
    messageLength: row.message_length as number,
    author: row.author as string | undefined,
    model: row.model as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
    context: row.context as string | undefined,
    status: row.status as Submission['status'],
    submittedAt: row.submitted_at as string,
    moderatedAt: row.moderated_at as string | undefined,
    moderatedBy: row.moderated_by as string | undefined,
    moderationNotes: row.moderation_notes as string | undefined,
    publishedAt: row.published_at as string | undefined,
    slug: row.slug as string | undefined,
    featured: (row.featured as number) === 1,
    requestMethod: row.request_method as string,
    cfCountry: row.cf_country as string | undefined,
    cfCity: row.cf_city as string | undefined,
    userAgent: row.user_agent as string | undefined,
    cfBotScore: row.cf_bot_score as number | undefined,
  };
}

export async function getSubmissions(
  status?: Submission['status'],
  limit: number = 50,
  offset: number = 0
): Promise<Submission[]> {
  let sql = `
    SELECT id, message, message_length, author, model, tags, context,
           status, submitted_at, moderated_at, moderated_by, moderation_notes,
           published_at, slug, featured, request_method, cf_country, cf_city,
           user_agent, cf_bot_score
    FROM submissions
  `;

  const params: unknown[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await queryD1<Record<string, unknown>>(sql, params);
  return rows.map(transformSubmission);
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const rows = await queryD1<Record<string, unknown>>(
    `SELECT id, message, message_length, author, model, tags, context,
            status, submitted_at, moderated_at, moderated_by, moderation_notes,
            published_at, slug, featured, request_method, cf_country, cf_city,
            user_agent, cf_bot_score
     FROM submissions WHERE id = ? LIMIT 1`,
    [id]
  );

  if (rows.length === 0) return null;
  return transformSubmission(rows[0]);
}

export async function getStats(): Promise<SubmissionStats> {
  const rows = await queryD1<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM submissions GROUP BY status`
  );

  const stats: SubmissionStats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    spam: 0,
    total: 0,
  };

  for (const row of rows) {
    const status = row.status as keyof Omit<SubmissionStats, 'total'>;
    if (status in stats) {
      stats[status] = row.count;
      stats.total += row.count;
    }
  }

  return stats;
}

function generateSlug(message: string, id: string): string {
  const words = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join('-');

  const shortId = id.slice(-6);
  return words ? `${words}-${shortId}` : shortId;
}

export async function moderateSubmission(
  id: string,
  action: 'approve' | 'reject' | 'spam' | 'unreview',
  moderator: string,
  notes?: string,
  featured?: boolean
): Promise<void> {
  const now = new Date().toISOString();

  if (action === 'approve') {
    // Get the submission to generate slug
    const submission = await getSubmissionById(id);
    if (!submission) throw new Error('Submission not found');

    const slug = generateSlug(submission.message, id);

    await queryD1(
      `UPDATE submissions
       SET status = 'approved',
           moderated_at = ?,
           moderated_by = ?,
           moderation_notes = ?,
           published_at = ?,
           slug = ?,
           featured = ?
       WHERE id = ?`,
      [now, moderator, notes ?? null, now, slug, featured ? 1 : 0, id]
    );

    // Log the action
    await queryD1(
      `INSERT INTO moderation_log (id, submission_id, action, moderator, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, 'approved', moderator, notes ?? null, now]
    );
  } else if (action === 'unreview') {
    await queryD1(
      `UPDATE submissions
       SET status = 'pending',
           moderated_at = NULL,
           moderated_by = NULL,
           moderation_notes = NULL,
           published_at = NULL,
           slug = NULL,
           featured = 0
       WHERE id = ?`,
      [id]
    );

    await queryD1(
      `INSERT INTO moderation_log (id, submission_id, action, moderator, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, 'unreviewed', moderator, notes ?? null, now]
    );
  } else {
    await queryD1(
      `UPDATE submissions
       SET status = ?,
           moderated_at = ?,
           moderated_by = ?,
           moderation_notes = ?
       WHERE id = ?`,
      [action === 'spam' ? 'spam' : 'rejected', now, moderator, notes ?? null, id]
    );

    await queryD1(
      `INSERT INTO moderation_log (id, submission_id, action, moderator, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), id, action, moderator, notes ?? null, now]
    );
  }
}

export async function triggerBuild(moderator: string): Promise<string> {
  const deployHookUrl = process.env.CF_DEPLOY_HOOK_URL;

  if (!deployHookUrl) {
    throw new Error('Deploy hook URL not configured');
  }

  const buildId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Log the build
  await queryD1(
    `INSERT INTO builds (id, triggered_at, triggered_by, status)
     VALUES (?, ?, ?, 'pending')`,
    [buildId, now, moderator]
  );

  // Trigger the deploy hook
  const response = await fetch(deployHookUrl, { method: 'POST' });

  if (!response.ok) {
    await queryD1(
      `UPDATE builds SET status = 'failed' WHERE id = ?`,
      [buildId]
    );
    throw new Error(`Deploy hook failed: ${response.status}`);
  }

  await queryD1(
    `UPDATE builds SET status = 'building' WHERE id = ?`,
    [buildId]
  );

  return buildId;
}
