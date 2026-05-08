import type { Db } from "@nulldiary/db";
import { checkRateLimit, findDupeByContentHash } from "@nulldiary/moderation";
import { extractRequest } from "./extract-request.js";
import { normalizeMessage, hashContent } from "./normalize.js";
import { parseMessage } from "./parse-message.js";
import { persistIngestion, type AutoDecision } from "./persistence.js";

function getClientIp(headers: Record<string, string>): string | null {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headers["x-real-ip"]?.trim();
  if (realIp) return realIp;

  const cfIp = headers["cf-connecting-ip"]?.trim();
  if (cfIp) return cfIp;

  return null;
}

async function isDeniedIp(db: Db, ip: string): Promise<boolean> {
  // Use a DB function so we can support both single IPs and CIDR ranges.
  const { data, error } = await db.rpc("ip_is_denied", { p_ip: ip });

  if (error) throw error;
  return Boolean(data);
}

export async function handleIngestion(
  request: Request,
  db: Db,
): Promise<Response> {
  const raw = await extractRequest(request);

  const ip = getClientIp(raw.headers);
  if (ip && (await isDeniedIp(db, ip))) {
    const parsed = {
      message: null,
      status: "denied_ip",
      source: "ip",
    } as const;
    await persistIngestion(db, raw, parsed);

    return Response.json(
      { status: parsed.status },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (ip) {
    const rate = await checkRateLimit({ ip, db });
    if (!rate.allowed) {
      const parsed = {
        message: null,
        status: "rate_limited",
        source: null,
      } as const;
      await persistIngestion(db, raw, parsed);

      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  const parsed = parseMessage(raw);

  let autoDecision: AutoDecision | undefined;
  if (parsed.status === "success") {
    // Fail-open on lookup failure: a flaky dupe query must not block ingestion
    // or cause spurious denials. Worst case the message lands in the human
    // queue, which is already the default.
    try {
      const contentHash = hashContent(normalizeMessage(parsed.message));
      const dupe = await findDupeByContentHash(db, contentHash);
      if (dupe?.status === "denied") {
        autoDecision = {
          action: "denied",
          reason: "dupe_of_denied",
          actor: "system:auto-mod@v1",
        };
      }
      // TODO(A4): cluster attachment for pending/approved dupes.
    } catch {
      // Swallow — see comment above.
    }
  }

  await persistIngestion(db, raw, parsed, autoDecision);

  if (parsed.status === "too_long") {
    return Response.json(
      { status: parsed.status },
      {
        status: 413,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return Response.json(
    { status: parsed.status },
    {
      status: 200,
      headers: {
        // Never cache ingestion responses.
        "Cache-Control": "no-store",
      },
    },
  );
}
