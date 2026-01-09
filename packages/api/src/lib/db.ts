import type { Env, SubmissionRecord } from '../types';

export async function insertSubmission(
  env: Env,
  submission: SubmissionRecord
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO submissions (
      id, message, message_length,
      author, model, tags, context,
      request_method, request_url, request_path,
      request_query_string, request_query_params,
      request_headers, request_body_raw, request_body_parsed,
      request_content_type, request_content_length,
      cf_ip_hash, cf_country, cf_city, cf_region, cf_region_code,
      cf_postal_code, cf_latitude, cf_longitude, cf_timezone,
      cf_asn, cf_as_organization, cf_colo, cf_continent,
      cf_http_protocol, cf_tls_version, cf_tls_cipher,
      cf_bot_score, cf_verified_bot, cf_raw,
      user_agent, referer, origin, accept_language,
      status, submitted_at, processing_time_ms
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )`
  )
    .bind(
      submission.id,
      submission.message,
      submission.messageLength,
      submission.author ?? null,
      submission.model ?? null,
      submission.tags ?? null,
      submission.context ?? null,
      submission.requestMethod,
      submission.requestUrl,
      submission.requestPath,
      submission.requestQueryString ?? null,
      submission.requestQueryParams ?? null,
      submission.requestHeaders,
      submission.requestBodyRaw ?? null,
      submission.requestBodyParsed ?? null,
      submission.requestContentType ?? null,
      submission.requestContentLength ?? null,
      submission.cfIpHash,
      submission.cfCountry ?? null,
      submission.cfCity ?? null,
      submission.cfRegion ?? null,
      submission.cfRegionCode ?? null,
      submission.cfPostalCode ?? null,
      submission.cfLatitude ?? null,
      submission.cfLongitude ?? null,
      submission.cfTimezone ?? null,
      submission.cfAsn ?? null,
      submission.cfAsOrganization ?? null,
      submission.cfColo ?? null,
      submission.cfContinent ?? null,
      submission.cfHttpProtocol ?? null,
      submission.cfTlsVersion ?? null,
      submission.cfTlsCipher ?? null,
      submission.cfBotScore ?? null,
      submission.cfVerifiedBot ?? null,
      submission.cfRaw ?? null,
      submission.userAgent ?? null,
      submission.referer ?? null,
      submission.origin ?? null,
      submission.acceptLanguage ?? null,
      submission.status,
      submission.submittedAt,
      submission.processingTimeMs ?? null
    )
    .run();
}

export async function logFailedRequest(
  env: Env,
  data: {
    id: string;
    timestamp: string;
    requestMethod: string;
    requestUrl: string;
    requestHeaders: string;
    requestBodyRaw?: string;
    cfIpHash: string;
    cfCountry?: string;
    cfRaw?: string;
    outcome: string;
    outcomeReason?: string;
    processingTimeMs?: number;
  }
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO request_log (
        id, timestamp, request_method, request_url, request_headers,
        request_body_raw, cf_ip_hash, cf_country, cf_raw,
        outcome, outcome_reason, processing_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.id,
        data.timestamp,
        data.requestMethod,
        data.requestUrl,
        data.requestHeaders,
        data.requestBodyRaw ?? null,
        data.cfIpHash,
        data.cfCountry ?? null,
        data.cfRaw ?? null,
        data.outcome,
        data.outcomeReason ?? null,
        data.processingTimeMs ?? null
      )
      .run();
  } catch (error) {
    console.error('Failed to log request:', error);
  }
}

export async function isBlocked(env: Env, ipHash: string): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      'SELECT 1 FROM blocklist WHERE pattern = ? LIMIT 1'
    )
      .bind(ipHash)
      .first();
    return result !== null;
  } catch (error) {
    console.error('Blocklist check failed:', error);
    return false;
  }
}
