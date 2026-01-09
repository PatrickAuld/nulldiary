export interface Env {
  DB: D1Database;
  RATE_LIMIT_KV?: KVNamespace;
  ENVIRONMENT: string;
}

export interface SubmissionInput {
  message: string;
  author?: string;
  model?: string;
  tags?: string[];
  context?: string;
}

export interface CloudflareMetadata {
  ip: string;
  ipHash: string;
  country?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  asn?: number;
  asOrganization?: string;
  colo?: string;
  continent?: string;
  httpProtocol?: string;
  tlsVersion?: string;
  tlsCipher?: string;
  botScore?: number;
  verifiedBot?: boolean;
  raw: unknown;
}

export interface RequestMetadata {
  method: string;
  url: string;
  path: string;
  queryString: string;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  bodyRaw?: string;
  bodyParsed?: unknown;
  contentType?: string;
  contentLength?: number;
  cf: CloudflareMetadata;
  userAgent?: string;
  referer?: string;
  origin?: string;
  acceptLanguage?: string;
}

export interface SubmissionRecord {
  id: string;
  message: string;
  messageLength: number;
  author?: string;
  model?: string;
  tags?: string;
  context?: string;
  requestMethod: string;
  requestUrl: string;
  requestPath: string;
  requestQueryString?: string;
  requestQueryParams?: string;
  requestHeaders: string;
  requestBodyRaw?: string;
  requestBodyParsed?: string;
  requestContentType?: string;
  requestContentLength?: number;
  cfIpHash: string;
  cfCountry?: string;
  cfCity?: string;
  cfRegion?: string;
  cfRegionCode?: string;
  cfPostalCode?: string;
  cfLatitude?: string;
  cfLongitude?: string;
  cfTimezone?: string;
  cfAsn?: number;
  cfAsOrganization?: string;
  cfColo?: string;
  cfContinent?: string;
  cfHttpProtocol?: string;
  cfTlsVersion?: string;
  cfTlsCipher?: string;
  cfBotScore?: number;
  cfVerifiedBot?: number;
  cfRaw?: string;
  userAgent?: string;
  referer?: string;
  origin?: string;
  acceptLanguage?: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  submittedAt: string;
  processingTimeMs?: number;
}

export interface SubmissionResponse {
  status: 'received' | 'error';
  id?: string;
  reason?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt?: number;
  reason?: string;
}
