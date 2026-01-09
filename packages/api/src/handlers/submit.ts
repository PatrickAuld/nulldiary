import type { Env, SubmissionInput, SubmissionResponse, RequestMetadata, SubmissionRecord } from '../types';
import { ulid } from '../lib/ulid';
import { hashIP } from '../lib/hash';
import { checkRateLimit, incrementRateLimit } from '../lib/rate-limit';
import { insertSubmission, logFailedRequest, isBlocked } from '../lib/db';

// Max lengths from spec
const MAX_MESSAGE_LENGTH_URL = 2000;
const MAX_MESSAGE_LENGTH_BODY = 10000;
const MAX_AUTHOR_LENGTH = 100;
const MAX_MODEL_LENGTH = 100;
const MAX_TAGS_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 500;
const MAX_BODY_SIZE = 16 * 1024; // 16KB

interface ParsedRequest {
  input: SubmissionInput;
  metadata: RequestMetadata;
}

function parseQueryParams(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

function getHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

async function extractCloudflareMetadata(request: Request): Promise<RequestMetadata['cf']> {
  const cf = request.cf as Record<string, unknown> | undefined;
  const ip = request.headers.get('cf-connecting-ip') ??
             request.headers.get('x-real-ip') ??
             'unknown';
  const ipHash = await hashIP(ip);

  return {
    ip,
    ipHash,
    country: cf?.country as string | undefined,
    city: cf?.city as string | undefined,
    region: cf?.region as string | undefined,
    regionCode: cf?.regionCode as string | undefined,
    postalCode: cf?.postalCode as string | undefined,
    latitude: cf?.latitude as string | undefined,
    longitude: cf?.longitude as string | undefined,
    timezone: cf?.timezone as string | undefined,
    asn: cf?.asn as number | undefined,
    asOrganization: cf?.asOrganization as string | undefined,
    colo: cf?.colo as string | undefined,
    continent: cf?.continent as string | undefined,
    httpProtocol: cf?.httpProtocol as string | undefined,
    tlsVersion: cf?.tlsVersion as string | undefined,
    tlsCipher: cf?.tlsCipher as string | undefined,
    botScore: (cf?.botManagement as Record<string, unknown>)?.score as number | undefined,
    verifiedBot: (cf?.botManagement as Record<string, unknown>)?.verifiedBot as boolean | undefined,
    raw: cf,
  };
}

function parseTags(tagsInput: unknown): string[] | undefined {
  if (!tagsInput) return undefined;

  if (Array.isArray(tagsInput)) {
    return tagsInput.filter(t => typeof t === 'string').slice(0, 10);
  }

  if (typeof tagsInput === 'string') {
    return tagsInput.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10);
  }

  return undefined;
}

async function parseRequestBody(request: Request): Promise<{
  bodyRaw?: string;
  bodyParsed?: unknown;
  message?: string;
  author?: string;
  model?: string;
  tags?: string[];
  context?: string;
}> {
  if (request.method !== 'POST') {
    return {};
  }

  const contentType = request.headers.get('content-type') ?? '';

  try {
    const bodyRaw = await request.text();
    if (!bodyRaw || bodyRaw.length === 0) {
      return {};
    }

    // Truncate body for storage
    const truncatedBody = bodyRaw.slice(0, MAX_BODY_SIZE);

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(bodyRaw);
        return {
          bodyRaw: truncatedBody,
          bodyParsed: parsed,
          message: typeof parsed.message === 'string' ? parsed.message : undefined,
          author: typeof parsed.author === 'string' ? parsed.author : undefined,
          model: typeof parsed.model === 'string' ? parsed.model : undefined,
          tags: parseTags(parsed.tags),
          context: typeof parsed.context === 'string' ? parsed.context : undefined,
        };
      } catch {
        return { bodyRaw: truncatedBody };
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = new URLSearchParams(bodyRaw);
        return {
          bodyRaw: truncatedBody,
          bodyParsed: Object.fromEntries(formData),
          message: formData.get('message') ?? undefined,
          author: formData.get('author') ?? undefined,
          model: formData.get('model') ?? undefined,
          tags: parseTags(formData.get('tags')),
          context: formData.get('context') ?? undefined,
        };
      } catch {
        return { bodyRaw: truncatedBody };
      }
    }

    // text/plain or other - treat entire body as message
    return {
      bodyRaw: truncatedBody,
      message: truncatedBody,
    };
  } catch {
    return {};
  }
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const url = new URL(request.url);
  const queryParams = parseQueryParams(url);
  const headers = getHeaders(request);
  const cf = await extractCloudflareMetadata(request);

  // Extract message from path: /s/{message}
  const pathMatch = url.pathname.match(/^\/s\/(.+)$/);
  const pathMessage = pathMatch ? decodeURIComponent(pathMatch[1]) : undefined;

  // Parse body for POST requests
  const bodyData = await parseRequestBody(request);

  // Priority: body > query > path
  const message = bodyData.message ?? queryParams.message ?? pathMessage ?? '';
  const author = bodyData.author ?? queryParams.author;
  const model = bodyData.model ?? queryParams.model;
  const tags = bodyData.tags ?? parseTags(queryParams.tags);
  const context = bodyData.context ?? queryParams.context;

  const input: SubmissionInput = {
    message,
    author,
    model,
    tags,
    context,
  };

  const metadata: RequestMetadata = {
    method: request.method,
    url: request.url,
    path: url.pathname,
    queryString: url.search,
    queryParams,
    headers,
    bodyRaw: bodyData.bodyRaw,
    bodyParsed: bodyData.bodyParsed,
    contentType: request.headers.get('content-type') ?? undefined,
    contentLength: request.headers.get('content-length')
      ? parseInt(request.headers.get('content-length')!, 10)
      : undefined,
    cf,
    userAgent: headers['user-agent'],
    referer: headers['referer'],
    origin: headers['origin'],
    acceptLanguage: headers['accept-language'],
  };

  return { input, metadata };
}

function validateInput(
  input: SubmissionInput,
  hasBody: boolean
): { valid: boolean; reason?: string } {
  const maxMessageLength = hasBody ? MAX_MESSAGE_LENGTH_BODY : MAX_MESSAGE_LENGTH_URL;

  if (!input.message || input.message.trim().length === 0) {
    return { valid: false, reason: 'message_required' };
  }

  if (input.message.length > maxMessageLength) {
    return { valid: false, reason: 'message_too_long' };
  }

  if (input.author && input.author.length > MAX_AUTHOR_LENGTH) {
    return { valid: false, reason: 'author_too_long' };
  }

  if (input.model && input.model.length > MAX_MODEL_LENGTH) {
    return { valid: false, reason: 'model_too_long' };
  }

  if (input.tags) {
    const tagsStr = JSON.stringify(input.tags);
    if (tagsStr.length > MAX_TAGS_LENGTH) {
      return { valid: false, reason: 'tags_too_long' };
    }
  }

  if (input.context && input.context.length > MAX_CONTEXT_LENGTH) {
    return { valid: false, reason: 'context_too_long' };
  }

  return { valid: true };
}

function createResponse(data: SubmissionResponse, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function handleSubmit(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();
  const submissionId = ulid();
  const timestamp = new Date().toISOString();

  try {
    // Parse the request
    const { input, metadata } = await parseRequest(request);
    const ipHash = metadata.cf.ipHash;

    // Check blocklist
    if (await isBlocked(env, ipHash)) {
      await logFailedRequest(env, {
        id: ulid(),
        timestamp,
        requestMethod: metadata.method,
        requestUrl: metadata.url,
        requestHeaders: JSON.stringify(metadata.headers),
        requestBodyRaw: metadata.bodyRaw,
        cfIpHash: ipHash,
        cfCountry: metadata.cf.country,
        cfRaw: JSON.stringify(metadata.cf.raw),
        outcome: 'blocked',
        outcomeReason: 'ip_blocked',
        processingTimeMs: Date.now() - startTime,
      });
      // Return 200 to avoid leaking info
      return createResponse({ status: 'received', id: submissionId });
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(env, ipHash);
    if (!rateLimit.allowed) {
      await logFailedRequest(env, {
        id: ulid(),
        timestamp,
        requestMethod: metadata.method,
        requestUrl: metadata.url,
        requestHeaders: JSON.stringify(metadata.headers),
        requestBodyRaw: metadata.bodyRaw,
        cfIpHash: ipHash,
        cfCountry: metadata.cf.country,
        cfRaw: JSON.stringify(metadata.cf.raw),
        outcome: 'rate_limited',
        outcomeReason: rateLimit.reason,
        processingTimeMs: Date.now() - startTime,
      });
      // Return 200 to avoid leaking info
      return createResponse({ status: 'received', id: submissionId });
    }

    // Validate input
    const hasBody = !!metadata.bodyRaw;
    const validation = validateInput(input, hasBody);
    if (!validation.valid) {
      await logFailedRequest(env, {
        id: ulid(),
        timestamp,
        requestMethod: metadata.method,
        requestUrl: metadata.url,
        requestHeaders: JSON.stringify(metadata.headers),
        requestBodyRaw: metadata.bodyRaw,
        cfIpHash: ipHash,
        cfCountry: metadata.cf.country,
        cfRaw: JSON.stringify(metadata.cf.raw),
        outcome: 'validation_failed',
        outcomeReason: validation.reason,
        processingTimeMs: Date.now() - startTime,
      });
      return createResponse({ status: 'error', reason: validation.reason });
    }

    // Increment rate limit counter
    await incrementRateLimit(env, ipHash);

    // Create submission record
    const processingTimeMs = Date.now() - startTime;
    const submission: SubmissionRecord = {
      id: submissionId,
      message: input.message,
      messageLength: input.message.length,
      author: input.author,
      model: input.model,
      tags: input.tags ? JSON.stringify(input.tags) : undefined,
      context: input.context,
      requestMethod: metadata.method,
      requestUrl: metadata.url,
      requestPath: metadata.path,
      requestQueryString: metadata.queryString || undefined,
      requestQueryParams: Object.keys(metadata.queryParams).length > 0
        ? JSON.stringify(metadata.queryParams)
        : undefined,
      requestHeaders: JSON.stringify(metadata.headers),
      requestBodyRaw: metadata.bodyRaw,
      requestBodyParsed: metadata.bodyParsed
        ? JSON.stringify(metadata.bodyParsed)
        : undefined,
      requestContentType: metadata.contentType,
      requestContentLength: metadata.contentLength,
      cfIpHash: ipHash,
      cfCountry: metadata.cf.country,
      cfCity: metadata.cf.city,
      cfRegion: metadata.cf.region,
      cfRegionCode: metadata.cf.regionCode,
      cfPostalCode: metadata.cf.postalCode,
      cfLatitude: metadata.cf.latitude,
      cfLongitude: metadata.cf.longitude,
      cfTimezone: metadata.cf.timezone,
      cfAsn: metadata.cf.asn,
      cfAsOrganization: metadata.cf.asOrganization,
      cfColo: metadata.cf.colo,
      cfContinent: metadata.cf.continent,
      cfHttpProtocol: metadata.cf.httpProtocol,
      cfTlsVersion: metadata.cf.tlsVersion,
      cfTlsCipher: metadata.cf.tlsCipher,
      cfBotScore: metadata.cf.botScore,
      cfVerifiedBot: metadata.cf.verifiedBot ? 1 : undefined,
      cfRaw: metadata.cf.raw ? JSON.stringify(metadata.cf.raw) : undefined,
      userAgent: metadata.userAgent,
      referer: metadata.referer,
      origin: metadata.origin,
      acceptLanguage: metadata.acceptLanguage,
      status: 'pending',
      submittedAt: timestamp,
      processingTimeMs,
    };

    // Insert into database
    await insertSubmission(env, submission);

    return createResponse({ status: 'received', id: submissionId });
  } catch (error) {
    console.error('Submission error:', error);

    // Log error but return success to avoid leaking info
    try {
      await logFailedRequest(env, {
        id: ulid(),
        timestamp,
        requestMethod: request.method,
        requestUrl: request.url,
        requestHeaders: JSON.stringify(getHeaders(request)),
        cfIpHash: await hashIP(
          request.headers.get('cf-connecting-ip') ?? 'unknown'
        ),
        outcome: 'error',
        outcomeReason: error instanceof Error ? error.message : 'unknown',
        processingTimeMs: Date.now() - startTime,
      });
    } catch {
      // Ignore logging errors
    }

    return createResponse({ status: 'received', id: submissionId });
  }
}

export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
