import type { Env, RateLimitResult } from '../types';

interface RateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  perMinute: 10,
  perHour: 30,
  perDay: 100,
};

function getWindowKeys(ipHash: string): { minute: string; hour: string; day: string } {
  const now = new Date();
  const minute = `${ipHash}:m:${now.toISOString().slice(0, 16)}`; // YYYY-MM-DDTHH:MM
  const hour = `${ipHash}:h:${now.toISOString().slice(0, 13)}`;   // YYYY-MM-DDTHH
  const day = `${ipHash}:d:${now.toISOString().slice(0, 10)}`;    // YYYY-MM-DD
  return { minute, hour, day };
}

export async function checkRateLimit(
  env: Env,
  ipHash: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
  const windows = getWindowKeys(ipHash);

  // Using D1 for rate limiting (fallback when KV not configured)
  try {
    // Get current counts
    const results = await env.DB.batch([
      env.DB.prepare(
        'SELECT count FROM rate_limits WHERE ip_hash = ? AND window = ?'
      ).bind(ipHash, windows.minute),
      env.DB.prepare(
        'SELECT count FROM rate_limits WHERE ip_hash = ? AND window = ?'
      ).bind(ipHash, windows.hour),
      env.DB.prepare(
        'SELECT count FROM rate_limits WHERE ip_hash = ? AND window = ?'
      ).bind(ipHash, windows.day),
    ]);

    const minuteCount = (results[0].results[0] as { count: number } | undefined)?.count ?? 0;
    const hourCount = (results[1].results[0] as { count: number } | undefined)?.count ?? 0;
    const dayCount = (results[2].results[0] as { count: number } | undefined)?.count ?? 0;

    // Check limits
    if (minuteCount >= config.perMinute) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'minute_limit_exceeded',
      };
    }

    if (hourCount >= config.perHour) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'hour_limit_exceeded',
      };
    }

    if (dayCount >= config.perDay) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'day_limit_exceeded',
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        config.perMinute - minuteCount - 1,
        config.perHour - hourCount - 1,
        config.perDay - dayCount - 1
      ),
    };
  } catch (error) {
    // If rate limiting fails, allow the request but log it
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: -1 };
  }
}

export async function incrementRateLimit(
  env: Env,
  ipHash: string
): Promise<void> {
  const windows = getWindowKeys(ipHash);

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO rate_limits (ip_hash, window, count) VALUES (?, ?, 1)
         ON CONFLICT (ip_hash, window) DO UPDATE SET count = count + 1`
      ).bind(ipHash, windows.minute),
      env.DB.prepare(
        `INSERT INTO rate_limits (ip_hash, window, count) VALUES (?, ?, 1)
         ON CONFLICT (ip_hash, window) DO UPDATE SET count = count + 1`
      ).bind(ipHash, windows.hour),
      env.DB.prepare(
        `INSERT INTO rate_limits (ip_hash, window, count) VALUES (?, ?, 1)
         ON CONFLICT (ip_hash, window) DO UPDATE SET count = count + 1`
      ).bind(ipHash, windows.day),
    ]);
  } catch (error) {
    console.error('Rate limit increment failed:', error);
  }
}

// Cleanup old rate limit entries (call periodically)
export async function cleanupRateLimits(env: Env): Promise<number> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString().slice(0, 10);

  try {
    const result = await env.DB.prepare(
      'DELETE FROM rate_limits WHERE window < ?'
    ).bind(cutoff).run();
    return result.meta.changes ?? 0;
  } catch (error) {
    console.error('Rate limit cleanup failed:', error);
    return 0;
  }
}
